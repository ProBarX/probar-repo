from decimal import Decimal

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
import stripe

from core.enums import (
    PagamentoStatus,
    SolicitacaoReembolsoMotivo,
    SolicitacaoReembolsoStatus,
    SolicitacaoReembolsoTipo,
)
from core.models import Pagamento, Pedido, SolicitacaoReembolso


stripe.api_key = settings.STRIPE_SECRET_KEY

STATUS_SOLICITACAO_ATIVA = SolicitacaoReembolso.STATUS_ATIVOS


def _stripe_attr(obj, key, default=None):
    if hasattr(obj, "get"):
        return obj.get(key, default)
    return getattr(obj, key, default)


def existe_solicitacao_ativa_para_pedido(pedido_id):
    return SolicitacaoReembolso.objects.filter(
        pedido_id=pedido_id,
        status__in=STATUS_SOLICITACAO_ATIVA,
    ).exists()


def _tipo_por_pagamento(pagamento):
    if not pagamento:
        return SolicitacaoReembolsoTipo.SEM_COBRANCA

    if pagamento.status == PagamentoStatus.PAGO:
        return SolicitacaoReembolsoTipo.REEMBOLSO_CAPTURADO

    if pagamento.stripe_payment_intent_id:
        return SolicitacaoReembolsoTipo.CANCELAMENTO_AUTORIZACAO

    return SolicitacaoReembolsoTipo.SEM_COBRANCA


def _valor_base(pedido, pagamento):
    if pagamento and pagamento.valor is not None:
        return pagamento.valor

    if pedido.valor_total_aprovado is not None:
        return pedido.valor_total_aprovado

    return Decimal("0.00")


def criar_solicitacao_ausencia_locked(pedido, pagamento=None, *, observacao_cliente=""):
    solicitacao = (
        SolicitacaoReembolso.objects
        .select_for_update()
        .filter(pedido=pedido, status__in=STATUS_SOLICITACAO_ATIVA)
        .first()
    )

    if solicitacao:
        return solicitacao

    try:
        return SolicitacaoReembolso.objects.create(
            pedido=pedido,
            pagamento=pagamento,
            cliente=pedido.cliente,
            bartender=pedido.bartender,
            tipo=_tipo_por_pagamento(pagamento),
            motivo=SolicitacaoReembolsoMotivo.AUSENCIA_BARTENDER,
            status=SolicitacaoReembolsoStatus.ABERTA,
            valor_solicitado=_valor_base(pedido, pagamento),
            moeda="brl",
            observacao_cliente=observacao_cliente or "",
        )
    except IntegrityError:
        return (
            SolicitacaoReembolso.objects
            .select_for_update()
            .get(pedido=pedido, status__in=STATUS_SOLICITACAO_ATIVA)
        )


def _validar_admin(user):
    if not user or not user.is_staff:
        raise PermissionError("Apenas administradores podem decidir solicitacoes de reembolso")


def _idempotency_key_cancelamento(solicitacao):
    if solicitacao.stripe_idempotency_key:
        return solicitacao.stripe_idempotency_key

    return f"solicitacao_reembolso_{solicitacao.id}_cancelamento"


def _registrar_falha_stripe(solicitacao, erro):
    solicitacao.status = SolicitacaoReembolsoStatus.FALHOU
    solicitacao.stripe_erro = str(erro)
    solicitacao.execucao_financeira_concluida_em = timezone.now()
    solicitacao.save(update_fields=[
        "status",
        "stripe_erro",
        "execucao_financeira_concluida_em",
        "atualizado_em",
    ])
    return solicitacao


def _sincronizar_pagamento_cancelado(solicitacao, pagamento, stripe_status):
    if pagamento and pagamento.status != PagamentoStatus.CANCELADO:
        pagamento.status = PagamentoStatus.CANCELADO
        pagamento.save(update_fields=["status"])

    solicitacao.status = SolicitacaoReembolsoStatus.CONCLUIDA
    solicitacao.stripe_status = stripe_status
    solicitacao.stripe_erro = ""
    solicitacao.execucao_financeira_concluida_em = timezone.now()
    solicitacao.save(update_fields=[
        "status",
        "stripe_status",
        "stripe_erro",
        "execucao_financeira_concluida_em",
        "atualizado_em",
    ])
    return solicitacao


def _lock_solicitacao_context(solicitacao_id):
    solicitacao_ref = SolicitacaoReembolso.objects.values(
        "pedido_id",
        "pagamento_id",
    ).get(pk=solicitacao_id)

    Pedido.objects.select_for_update().get(pk=solicitacao_ref["pedido_id"])

    if solicitacao_ref["pagamento_id"]:
        Pagamento.objects.select_for_update().get(pk=solicitacao_ref["pagamento_id"])

    return (
        SolicitacaoReembolso.objects
        .select_for_update()
        .select_related(
            "pedido",
            "pagamento",
            "cliente__user",
            "bartender__user",
            "decidido_por",
        )
        .get(pk=solicitacao_id)
    )


def responder_solicitacao(solicitacao_id, user, *, resposta):
    if not hasattr(user, "bartender"):
        raise PermissionError("Apenas o bartender do pedido pode responder a solicitacao")

    with transaction.atomic():
        solicitacao = _lock_solicitacao_context(solicitacao_id)

        if solicitacao.bartender.user_id != user.id:
            raise PermissionError("Voce nao pode responder esta solicitacao")

        if solicitacao.status in [
            SolicitacaoReembolsoStatus.APROVADA,
            SolicitacaoReembolsoStatus.NEGADA,
            SolicitacaoReembolsoStatus.CONCLUIDA,
        ]:
            raise ValueError("Solicitacao de reembolso ja foi encerrada")

        solicitacao.resposta_bartender = resposta or ""
        solicitacao.respondido_em = timezone.now()
        solicitacao.status = SolicitacaoReembolsoStatus.CONTESTADA
        solicitacao.save(update_fields=[
            "resposta_bartender",
            "respondido_em",
            "status",
            "atualizado_em",
        ])

        return solicitacao


def aprovar_solicitacao(solicitacao_id, user, *, decisao_admin="", valor_aprovado=None):
    _validar_admin(user)

    with transaction.atomic():
        solicitacao = _lock_solicitacao_context(solicitacao_id)

        if solicitacao.status in [
            SolicitacaoReembolsoStatus.APROVADA,
            SolicitacaoReembolsoStatus.NEGADA,
            SolicitacaoReembolsoStatus.CONCLUIDA,
        ]:
            raise ValueError("Solicitacao de reembolso ja foi encerrada")

        valor = valor_aprovado if valor_aprovado is not None else solicitacao.valor_solicitado
        valor = Decimal(str(valor))

        if valor <= 0:
            raise ValueError("Valor aprovado deve ser maior que zero")

        if valor > solicitacao.valor_solicitado:
            raise ValueError("Valor aprovado nao pode exceder o valor solicitado")

        solicitacao.status = SolicitacaoReembolsoStatus.APROVADA
        solicitacao.valor_aprovado = valor
        solicitacao.decisao_admin = decisao_admin or ""
        solicitacao.decidido_por = user
        solicitacao.decidido_em = timezone.now()
        solicitacao.save(update_fields=[
            "status",
            "valor_aprovado",
            "decisao_admin",
            "decidido_por",
            "decidido_em",
            "atualizado_em",
        ])

        return solicitacao


def negar_solicitacao(solicitacao_id, user, *, decisao_admin=""):
    _validar_admin(user)

    with transaction.atomic():
        solicitacao = _lock_solicitacao_context(solicitacao_id)

        if solicitacao.status in [
            SolicitacaoReembolsoStatus.APROVADA,
            SolicitacaoReembolsoStatus.CONCLUIDA,
        ]:
            raise ValueError("Solicitacao de reembolso ja foi encerrada")

        solicitacao.status = SolicitacaoReembolsoStatus.NEGADA
        solicitacao.valor_aprovado = None
        solicitacao.decisao_admin = decisao_admin or ""
        solicitacao.decidido_por = user
        solicitacao.decidido_em = timezone.now()
        solicitacao.save(update_fields=[
            "status",
            "valor_aprovado",
            "decisao_admin",
            "decidido_por",
            "decidido_em",
            "atualizado_em",
        ])

        return solicitacao


def executar_cancelamento_autorizacao(solicitacao_id, user):
    _validar_admin(user)

    with transaction.atomic():
        solicitacao = _lock_solicitacao_context(solicitacao_id)
        pagamento = solicitacao.pagamento

        if solicitacao.status != SolicitacaoReembolsoStatus.APROVADA:
            raise ValueError("Solicitacao precisa estar aprovada para executar cancelamento")

        if solicitacao.tipo != SolicitacaoReembolsoTipo.CANCELAMENTO_AUTORIZACAO:
            raise ValueError("Solicitacao nao e de cancelamento de autorizacao")

        if not pagamento:
            raise ValueError("Solicitacao sem pagamento associado")

        if not pagamento.stripe_payment_intent_id:
            solicitacao.stripe_payment_intent_id = None
            solicitacao.stripe_status = ""
            solicitacao.execucao_financeira_iniciada_em = timezone.now()
            solicitacao.save(update_fields=[
                "stripe_payment_intent_id",
                "stripe_status",
                "execucao_financeira_iniciada_em",
                "atualizado_em",
            ])
            return _registrar_falha_stripe(
                solicitacao,
                "Pagamento sem PaymentIntent para cancelamento",
            )

        idempotency_key = _idempotency_key_cancelamento(solicitacao)
        solicitacao.stripe_payment_intent_id = pagamento.stripe_payment_intent_id
        solicitacao.stripe_idempotency_key = idempotency_key
        solicitacao.stripe_erro = ""
        solicitacao.execucao_financeira_iniciada_em = timezone.now()
        solicitacao.save(update_fields=[
            "stripe_payment_intent_id",
            "stripe_idempotency_key",
            "stripe_erro",
            "execucao_financeira_iniciada_em",
            "atualizado_em",
        ])

        try:
            intent = stripe.PaymentIntent.retrieve(pagamento.stripe_payment_intent_id)
            intent_status = _stripe_attr(intent, "status", "")
            solicitacao.stripe_status = intent_status
            solicitacao.save(update_fields=["stripe_status", "atualizado_em"])

            if intent_status == "requires_capture":
                intent = stripe.PaymentIntent.cancel(
                    pagamento.stripe_payment_intent_id,
                    cancellation_reason="requested_by_customer",
                    idempotency_key=idempotency_key,
                )
                intent_status = _stripe_attr(intent, "status", "")
                solicitacao.stripe_status = intent_status
                solicitacao.save(update_fields=["stripe_status", "atualizado_em"])

                if intent_status == "canceled":
                    return _sincronizar_pagamento_cancelado(
                        solicitacao,
                        pagamento,
                        intent_status,
                    )

                return _registrar_falha_stripe(
                    solicitacao,
                    f"Cancelamento nao confirmado pela Stripe: status {intent_status}",
                )

            if intent_status == "canceled":
                return _sincronizar_pagamento_cancelado(
                    solicitacao,
                    pagamento,
                    intent_status,
                )

            if intent_status == "succeeded":
                solicitacao.tipo = SolicitacaoReembolsoTipo.REEMBOLSO_CAPTURADO
                solicitacao.stripe_erro = (
                    "PaymentIntent ja capturado; tratar reembolso na Etapa 6C"
                )
                solicitacao.save(update_fields=[
                    "tipo",
                    "stripe_erro",
                    "atualizado_em",
                ])
                return solicitacao

            return _registrar_falha_stripe(
                solicitacao,
                f"PaymentIntent nao esta em requires_capture: status {intent_status}",
            )

        except Exception as e:
            return _registrar_falha_stripe(solicitacao, e)
