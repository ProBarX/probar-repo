import stripe
from django.conf import settings
from django.utils import timezone
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP

from core.models import Pagamento
from core.enums import (
    PedidoStatus,
    PagamentoStatus,
    PagamentoMetodo,
    PresencaStatus,
    PresencaOrigem,
)
from core.services import reembolso_service
from django.db import transaction


stripe.api_key = settings.STRIPE_SECRET_KEY

ACCOUNT_CAPABILITIES = {
    "card_payments": {"requested": True},
    "transfers": {"requested": True},
}


# =========================
# ONBOARDING
# =========================

def _stripe_attr(obj, key, default=None):
    if hasattr(obj, "get"):
        return obj.get(key, default)
    return getattr(obj, key, default)


def criar_conta_express(email: str):
    return stripe.Account.create(
        type="express",
        country="BR",
        email=email,
        capabilities=ACCOUNT_CAPABILITIES,
    ).id


def garantir_capacidades_pagamento(account_id: str):
    return stripe.Account.modify(
        account_id,
        capabilities=ACCOUNT_CAPABILITIES,
    )


def criar_link_onboarding(account_id: str, *, return_url=None, refresh_url=None):
    return stripe.AccountLink.create(
        account=account_id,
        refresh_url=refresh_url or settings.STRIPE_REFRESH_URL,
        return_url=return_url or settings.STRIPE_RETURN_URL,
        type="account_onboarding",
    )


def verificar_onboarding(bartender):
    if not bartender.stripe_account_id:
        return False

    account = stripe.Account.retrieve(bartender.stripe_account_id)

    completo = bool(_stripe_attr(account, "details_submitted")) and (
        bool(_stripe_attr(account, "payouts_enabled"))
        or bool(_stripe_attr(account, "charges_enabled"))
    )

    if completo and not bartender.stripe_onboarding_completo:
        bartender.stripe_onboarding_completo = True
        bartender.save(update_fields=["stripe_onboarding_completo"])

    return completo


# =========================
# PAGAMENTO
# =========================

def validar_pagamento(pedido, user):
    if not hasattr(user, "cliente"):
        raise PermissionError("Apenas clientes podem pagar pedidos")

    if pedido.cliente.user_id != user.id:
        raise PermissionError("Você não pode pagar este pedido")

    if pedido.status not in [PedidoStatus.ACEITO, PedidoStatus.PAGO]:
        raise ValueError("Pedido não está aceito")

    if pedido.presenca_status == PresencaStatus.AUSENTE:
        raise ValueError("Pedido marcado com ausencia do bartender")

    if not pedido.bartender.stripe_account_id:
        raise ValueError("Bartender sem conta Stripe")

    if not pedido.bartender.stripe_onboarding_completo:
        raise ValueError("Onboarding do bartender incompleto")


def _manual_capture_window():
    return timedelta(
        days=int(getattr(settings, "STRIPE_MANUAL_CAPTURE_WINDOW_DAYS", 5))
    )


def _aware(dt):
    if timezone.is_aware(dt):
        return dt
    return timezone.make_aware(dt)


def periodo_evento(evento):
    inicio = datetime.combine(evento.data, evento.hora_inicio)
    fim = datetime.combine(evento.data, evento.hora_fim)

    if fim <= inicio:
        fim = fim + timedelta(days=1)

    return _aware(inicio), _aware(fim)


def evento_esta_na_janela_autorizacao(evento):
    inicio_evento, fim_evento = periodo_evento(evento)
    agora = timezone.now()

    return (
        agora >= inicio_evento - _manual_capture_window()
        and agora <= fim_evento + timedelta(hours=2)
    )


def servico_fim_previsto(pedido):
    return pedido.servico_fim_previsto


def liberacao_automatica_em(pedido):
    return pedido.liberacao_automatica_em


def garantir_stripe_customer(cliente):
    if cliente.stripe_customer_id:
        return cliente.stripe_customer_id

    customer = stripe.Customer.create(
        email=cliente.user.email,
        name=cliente.user.name or None,
        metadata={"cliente_user_id": str(cliente.user_id)},
    )

    cliente.stripe_customer_id = customer.id
    cliente.save(update_fields=["stripe_customer_id"])

    return customer.id

def reativar_pagamento(pagamento, intent):
    pagamento.status = PagamentoStatus.PENDENTE
    pagamento.stripe_payment_intent_id = intent.id
    pagamento.stripe_setup_intent_id = None
    pagamento.stripe_payment_method_id = None
    pagamento.stripe_payment_method_type = None
    pagamento.finalizado_pelo_cliente = False
    pagamento.save(
        update_fields=[
            "status",
            "stripe_payment_intent_id",
            "stripe_setup_intent_id",
            "stripe_payment_method_id",
            "stripe_payment_method_type",
            "finalizado_pelo_cliente",
        ]
    )
    return pagamento, intent


def ativar_setup_pagamento(pagamento, setup_intent):
    pagamento.status = PagamentoStatus.PENDENTE
    pagamento.stripe_payment_intent_id = None
    pagamento.stripe_setup_intent_id = setup_intent.id
    pagamento.stripe_payment_method_id = None
    pagamento.stripe_payment_method_type = None
    pagamento.finalizado_pelo_cliente = False
    pagamento.save(
        update_fields=[
            "status",
            "stripe_payment_intent_id",
            "stripe_setup_intent_id",
            "stripe_payment_method_id",
            "stripe_payment_method_type",
            "finalizado_pelo_cliente",
        ]
    )
    return pagamento, setup_intent


def criar_pagamento_seguro(pedido_id, user):
    from core.models import Pedido

    with transaction.atomic():
        # trava a linha no banco
        pedido = (
            Pedido.objects
            .select_for_update()
            .select_related("cliente__user", "bartender", "evento")
            .get(id=pedido_id)
        )

        # validação
        validar_pagamento(pedido, user)

        # double-check (segurança extra)
        if hasattr(pedido, "pagamento"):
            pagamento_existente = pedido.pagamento

            if pagamento_existente.status == PagamentoStatus.PAGO:
                raise ValueError("Pedido ja foi pago")

            if pagamento_existente.status == PagamentoStatus.CANCELADO:
                return criar_sessao_pagamento_para_pedido(
                    pedido,
                    pagamento=pagamento_existente,
                    idempotency_suffix=f"retry_{pagamento_existente.id}",
                )

            if not pagamento_existente.stripe_payment_intent_id:
                if pagamento_existente.stripe_setup_intent_id:
                    setup_intent = stripe.SetupIntent.retrieve(
                        pagamento_existente.stripe_setup_intent_id
                    )
                    setup_status = _stripe_attr(setup_intent, "status")
                    sincronizar_setup_pagamento(pagamento_existente, setup_intent)

                    if (
                        pagamento_existente.status == PagamentoStatus.CANCELADO
                        or setup_status == "canceled"
                    ):
                        return criar_sessao_pagamento_para_pedido(
                            pedido,
                            pagamento=pagamento_existente,
                            idempotency_suffix=f"retry_{pagamento_existente.id}",
                        )

                    if (
                        evento_esta_na_janela_autorizacao(pedido.evento)
                        and pagamento_existente.stripe_payment_method_id
                    ):
                        intent = criar_intent_com_payment_method_salvo(
                            pagamento_existente,
                            idempotency_key=(
                                f"pedido_{pedido.id}_scheduled_"
                                f"{pagamento_existente.id}"
                            ),
                        )
                        return pagamento_existente, intent

                    return pagamento_existente, setup_intent

                return criar_sessao_pagamento_para_pedido(
                    pedido,
                    pagamento=pagamento_existente,
                    idempotency_suffix=f"repair_{pagamento_existente.id}",
                )

            intent = stripe.PaymentIntent.retrieve(
                pagamento_existente.stripe_payment_intent_id
            )

            if intent.status == "canceled":
                return criar_sessao_pagamento_para_pedido(
                    pedido,
                    pagamento=pagamento_existente,
                    idempotency_suffix=f"retry_{pagamento_existente.id}",
                )

            return pagamento_existente, intent

        return criar_sessao_pagamento_para_pedido(pedido)


def criar_sessao_pagamento_para_pedido(pedido, *, pagamento=None, idempotency_suffix=None):
    from core.models import Pagamento

    idempotency_key = (
        f"pedido_{pedido.id}_{idempotency_suffix}"
        if idempotency_suffix
        else None
    )

    if evento_esta_na_janela_autorizacao(pedido.evento):
        intent = criar_pagamento_intent(
            pedido,
            idempotency_key=idempotency_key,
        )

        if pagamento:
            return reativar_pagamento(pagamento, intent)

        pagamento = Pagamento.objects.create(
            pedido=pedido,
            valor=pedido.valor_total_aprovado,
            metodo_pagamento=PagamentoMetodo.STRIPE,
            stripe_payment_intent_id=intent.id,
        )

        return pagamento, intent

    customer_id = garantir_stripe_customer(pedido.cliente)
    setup_intent = criar_setup_intent(
        pedido,
        customer_id=customer_id,
        idempotency_key=(
            f"pedido_{pedido.id}_setup_{idempotency_suffix}"
            if idempotency_suffix
            else None
        ),
    )

    if pagamento:
        return ativar_setup_pagamento(pagamento, setup_intent)

    pagamento = Pagamento.objects.create(
        pedido=pedido,
        valor=pedido.valor_total_aprovado,
        metodo_pagamento=PagamentoMetodo.STRIPE,
        stripe_setup_intent_id=setup_intent.id,
    )

    return pagamento, setup_intent


def criar_pagamento_intent(
    pedido,
    *,
    idempotency_key=None,
    customer_id=None,
    payment_method_id=None,
    confirm=False,
    off_session=False,
):
    amount = _to_cents(pedido.valor_total_aprovado)
    fee_amount = _calcular_taxa_plataforma(amount)

    params = {
        "amount": amount,
        "currency": "brl",
        "capture_method": "manual",
        "payment_method_types": ["card"],
        "transfer_data": {
            "destination": pedido.bartender.stripe_account_id
        },
        "application_fee_amount": fee_amount,
    }

    if customer_id:
        params["customer"] = customer_id

    if payment_method_id:
        params["payment_method"] = payment_method_id

    if confirm:
        params["confirm"] = True
        params["off_session"] = off_session

    return stripe.PaymentIntent.create(
        **params,
        idempotency_key=idempotency_key or f"pedido_{pedido.id}",
    )


def criar_setup_intent(pedido, *, customer_id, idempotency_key=None):
    return stripe.SetupIntent.create(
        customer=customer_id,
        payment_method_types=["card"],
        usage="off_session",
        metadata={"pedido_id": str(pedido.id)},
        idempotency_key=idempotency_key or f"pedido_{pedido.id}_setup",
    )


def _stripe_object_id(value):
    if not value:
        return None

    if isinstance(value, str):
        return value

    return _stripe_attr(value, "id")


def _extrair_payment_method_id(setup_intent):
    if hasattr(setup_intent, "get"):
        value = setup_intent.get("payment_method")
    else:
        value = getattr(setup_intent, "payment_method", None)

    return _stripe_object_id(value)


def sincronizar_setup_pagamento(pagamento, setup_intent=None):
    if not setup_intent:
        if not pagamento.stripe_setup_intent_id:
            raise ValueError("Pagamento sem SetupIntent")

        setup_intent = stripe.SetupIntent.retrieve(
            pagamento.stripe_setup_intent_id
        )

    status = _stripe_attr(setup_intent, "status")

    if status == "succeeded":
        update_fields = []
        payment_method_id = _extrair_payment_method_id(setup_intent)
        metodo_stripe = _extrair_metodo_pagamento_stripe(setup_intent)

        if payment_method_id and pagamento.stripe_payment_method_id != payment_method_id:
            pagamento.stripe_payment_method_id = payment_method_id
            update_fields.append("stripe_payment_method_id")

        if metodo_stripe and pagamento.stripe_payment_method_type != metodo_stripe:
            pagamento.stripe_payment_method_type = metodo_stripe
            update_fields.append("stripe_payment_method_type")

        if update_fields:
            pagamento.save(update_fields=update_fields)

    elif status == "canceled":
        marcar_pagamento_cancelado(pagamento)

    return pagamento, setup_intent


def sincronizar_payment_intent_autorizado(pagamento, intent=None):
    if not pagamento.stripe_payment_intent_id:
        raise ValueError("Pagamento sem PaymentIntent")

    if not intent:
        intent = stripe.PaymentIntent.retrieve(
            pagamento.stripe_payment_intent_id
        )

    status = _stripe_attr(intent, "status")
    metodo_stripe = _extrair_metodo_pagamento_stripe(intent)
    update_fields = []

    if metodo_stripe and pagamento.stripe_payment_method_type != metodo_stripe:
        pagamento.stripe_payment_method_type = metodo_stripe
        update_fields.append("stripe_payment_method_type")

    if status == "requires_capture":
        if not pagamento.finalizado_pelo_cliente:
            pagamento.finalizado_pelo_cliente = True
            update_fields.append("finalizado_pelo_cliente")

        if update_fields:
            pagamento.save(update_fields=update_fields)

        return pagamento, intent

    if update_fields:
        pagamento.save(update_fields=update_fields)

    if status == "succeeded":
        raise ValueError(
            "PaymentIntent ja foi capturado; use o fluxo de liberacao para sincronizar o pagamento"
        )

    if status == "canceled":
        marcar_pagamento_cancelado(pagamento)
        return pagamento, intent

    raise ValueError("Pagamento ainda nao autorizado")


def criar_intent_com_payment_method_salvo(pagamento, *, idempotency_key=None):
    pagamento, _ = sincronizar_setup_pagamento(pagamento)

    if not pagamento.stripe_payment_method_id:
        raise ValueError("Cartao ainda nao salvo para cobranca futura")

    pedido = pagamento.pedido
    customer_id = (
        pagamento.pedido.cliente.stripe_customer_id
        or garantir_stripe_customer(pagamento.pedido.cliente)
    )

    intent = criar_pagamento_intent(
        pedido,
        customer_id=customer_id,
        payment_method_id=pagamento.stripe_payment_method_id,
        confirm=True,
        off_session=True,
        idempotency_key=idempotency_key
        or f"pedido_{pedido.id}_scheduled_{pagamento.id}",
    )

    update_fields = ["stripe_payment_intent_id"]
    pagamento.stripe_payment_intent_id = intent.id

    metodo_stripe = _extrair_metodo_pagamento_stripe(intent)
    if metodo_stripe and pagamento.stripe_payment_method_type != metodo_stripe:
        pagamento.stripe_payment_method_type = metodo_stripe
        update_fields.append("stripe_payment_method_type")

    pagamento.save(update_fields=update_fields)

    return intent


def _to_cents(valor):
    if valor is None:
        raise ValueError("Valor total do pedido não definido")

    return int(
        (Decimal(valor) * Decimal("100")).quantize(
            Decimal("1"),
            rounding=ROUND_HALF_UP,
        )
    )


def _calcular_taxa_plataforma(amount_cents):
    fee_percent = Decimal(str(settings.STRIPE_PLATFORM_FEE_PERCENT))

    return int(
        (Decimal(amount_cents) * fee_percent / Decimal("100")).quantize(
            Decimal("1"),
            rounding=ROUND_HALF_UP,
        )
    )


def _extrair_metodo_pagamento_stripe(intent):
    if hasattr(intent, "get"):
        charges = intent.get("charges", {})
    else:
        charges = getattr(intent, "charges", {})
    if isinstance(charges, dict):
        data = charges.get("data") or []
        if data:
            details = data[0].get("payment_method_details") or {}
            metodo = details.get("type")
            if metodo:
                return metodo

    if hasattr(intent, "get"):
        tipos = intent.get("payment_method_types") or []
    else:
        tipos = getattr(intent, "payment_method_types", None) or []
    if tipos:
        return tipos[0]

    return None


# =========================
# REGRAS DE LIBERAÇÃO
# =========================

def _validar_cliente_dono_pedido(pedido, user):
    if not hasattr(user, "cliente"):
        raise PermissionError("Apenas clientes podem registrar presenca")

    if pedido.cliente.user_id != user.id:
        raise PermissionError("Voce nao pode registrar presenca neste pedido")


def _validar_servico_finalizado(pedido, *, agora=None):
    agora = agora or timezone.now()
    if agora < pedido.servico_fim_previsto:
        raise ValueError("A presenca so pode ser registrada apos o fim previsto do servico")


def _registrar_presenca(pedido, *, status, origem, user=None, observacao="", agora=None):
    agora = agora or timezone.now()
    pedido.presenca_status = status
    pedido.presenca_origem = origem
    pedido.presenca_registrada_em = agora
    pedido.presenca_registrada_por = user
    pedido.presenca_observacao = observacao or ""
    pedido.save(
        update_fields=[
            "presenca_status",
            "presenca_origem",
            "presenca_registrada_em",
            "presenca_registrada_por",
            "presenca_observacao",
            "atualizado_em",
        ]
    )
    return pedido


def _captura_liberada_por_presenca(pedido, *, persistir_automatica=False, agora=None):
    agora = agora or timezone.now()

    if pedido.presenca_status == PresencaStatus.AUSENTE:
        raise ValueError("Pagamento bloqueado porque o cliente registrou ausencia do bartender")

    if reembolso_service.existe_solicitacao_ativa_para_pedido(pedido.id):
        raise ValueError("Pagamento bloqueado porque existe solicitacao de reembolso ativa")

    if pedido.presenca_status == PresencaStatus.PRESENTE:
        return True

    if agora >= pedido.liberacao_automatica_em:
        if persistir_automatica:
            _registrar_presenca(
                pedido,
                status=PresencaStatus.PRESENTE,
                origem=PresencaOrigem.AUTOMATICA,
                user=None,
                observacao="Liberacao automatica apos ausencia de confirmacao do cliente.",
                agora=agora,
            )
        return True

    return False


def pode_capturar(pagamento):
    try:
        return _captura_liberada_por_presenca(
            pagamento.pedido,
            persistir_automatica=False,
        )
    except ValueError:
        return False


def confirmar_presenca_pedido(pedido_id, user, *, observacao=""):
    from core.models import Pedido, Pagamento

    pagamento_id = None

    with transaction.atomic():
        pedido = (
            Pedido.objects
            .select_for_update()
            .select_related("cliente__user", "evento")
            .get(pk=pedido_id)
        )
        _validar_cliente_dono_pedido(pedido, user)
        _validar_servico_finalizado(pedido)

        if pedido.presenca_status == PresencaStatus.AUSENTE:
            raise ValueError("Nao e possivel confirmar presenca apos registrar ausencia")

        if pedido.presenca_status == PresencaStatus.PENDENTE:
            _registrar_presenca(
                pedido,
                status=PresencaStatus.PRESENTE,
                origem=PresencaOrigem.CLIENTE,
                user=user,
                observacao=observacao,
            )

        pagamento = (
            Pagamento.objects
            .select_for_update()
            .filter(pedido=pedido)
            .first()
        )
        if (
            pagamento
            and pagamento.status == PagamentoStatus.PENDENTE
            and pagamento.stripe_payment_intent_id
        ):
            pagamento_id = pagamento.id

    if pagamento_id:
        capturar_pagamento_seguro(Pagamento.objects.get(pk=pagamento_id))

    return (
        Pedido.objects
        .select_related("cliente__user", "bartender__user", "evento", "pagamento")
        .prefetch_related("propostas")
        .get(pk=pedido_id)
    )


def registrar_ausencia_pedido(pedido_id, user, *, observacao=""):
    from core.models import Pedido, Pagamento

    with transaction.atomic():
        pedido = (
            Pedido.objects
            .select_for_update()
            .select_related("cliente__user", "evento")
            .get(pk=pedido_id)
        )
        _validar_cliente_dono_pedido(pedido, user)
        _validar_servico_finalizado(pedido)

        if pedido.presenca_status == PresencaStatus.PRESENTE:
            raise ValueError("Nao e possivel registrar ausencia apos confirmar presenca")

        pagamento = (
            Pagamento.objects
            .select_for_update()
            .filter(pedido=pedido)
            .first()
        )

        if pedido.presenca_status == PresencaStatus.PENDENTE:
            _registrar_presenca(
                pedido,
                status=PresencaStatus.AUSENTE,
                origem=PresencaOrigem.CLIENTE,
                user=user,
                observacao=observacao,
            )

        reembolso_service.criar_solicitacao_ausencia_locked(
            pedido,
            pagamento,
            observacao_cliente=observacao,
        )

    return (
        Pedido.objects
        .select_related("cliente__user", "bartender__user", "evento", "pagamento")
        .prefetch_related("propostas")
        .get(pk=pedido_id)
    )


# =========================
# CAPTURA
# =========================

def capturar_pagamento(pagamento):
    if pagamento.status == PagamentoStatus.PAGO:
        return pagamento

    if pagamento.status != PagamentoStatus.PENDENTE:
        raise ValueError("Pagamento não está pendente")

    if not _captura_liberada_por_presenca(pagamento.pedido, persistir_automatica=True):
        raise ValueError("Pagamento ainda nao pode ser liberado")

    stripe.PaymentIntent.capture(pagamento.stripe_payment_intent_id)

    marcar_pagamento_pago(pagamento)
    marcar_pedido_pago(pagamento)

    return pagamento


def marcar_pagamento_pago(pagamento):
    if pagamento.status != PagamentoStatus.PAGO:
        pagamento.status = PagamentoStatus.PAGO
        pagamento.save(update_fields=["status"])


def marcar_pedido_pago(pagamento):
    pedido = pagamento.pedido

    if pedido.status != PedidoStatus.PAGO:
        pedido.status = PedidoStatus.PAGO
        pedido.save(update_fields=["status"])


def marcar_pagamento_cancelado(pagamento):
    if pagamento.status != PagamentoStatus.CANCELADO:
        pagamento.status = PagamentoStatus.CANCELADO
        pagamento.save(update_fields=["status"])


def _capturar_pagamento_seguro_legacy(pagamento):
    return capturar_pagamento_seguro(pagamento)


# =========================
# PROCESSAMENTO AUTOMÁTICO
# =========================

def capturar_pagamento_seguro(pagamento):
    from core.models import Pedido, Pagamento

    with transaction.atomic():
        pedido = (
            Pedido.objects
            .select_for_update()
            .select_related("evento")
            .get(pk=pagamento.pedido_id)
        )
        pagamento = (
            Pagamento.objects
            .select_for_update()
            .select_related("pedido__evento")
            .get(pk=pagamento.pk)
        )
        pagamento.pedido = pedido

        if not _captura_liberada_por_presenca(pedido, persistir_automatica=True):
            raise ValueError("Pagamento ainda nao pode ser liberado")

        if not pagamento.stripe_payment_intent_id:
            raise ValueError("Pagamento sem PaymentIntent")

        intent = stripe.PaymentIntent.retrieve(
            pagamento.stripe_payment_intent_id
        )

        metodo_stripe = _extrair_metodo_pagamento_stripe(intent)
        if metodo_stripe and pagamento.stripe_payment_method_type != metodo_stripe:
            pagamento.stripe_payment_method_type = metodo_stripe
            pagamento.save(update_fields=["stripe_payment_method_type"])

        if intent.status == "requires_capture":
            return capturar_pagamento(pagamento)

        if intent.status == "succeeded":
            marcar_pagamento_pago(pagamento)
            marcar_pedido_pago(pagamento)
            return pagamento

        if intent.status == "canceled":
            marcar_pagamento_cancelado(pagamento)
            return pagamento

    raise ValueError("Pagamento ainda nao confirmado")


def processar_pagamentos_agendados(logger=None):
    pagamentos = (
        Pagamento.objects
        .filter(
            status=PagamentoStatus.PENDENTE,
            stripe_payment_intent_id__isnull=True,
            stripe_setup_intent_id__isnull=False,
        )
        .select_related(
            "pedido__evento",
            "pedido__cliente__user",
            "pedido__bartender",
        )
    )
    total = 0
    authorized = 0
    skipped = 0
    errors = 0

    for pagamento in pagamentos:
        total += 1
        try:
            if pagamento.pedido.presenca_status == PresencaStatus.AUSENTE:
                skipped += 1
                continue

            if not evento_esta_na_janela_autorizacao(pagamento.pedido.evento):
                skipped += 1
                continue

            setup_intent = stripe.SetupIntent.retrieve(
                pagamento.stripe_setup_intent_id
            )
            sincronizar_setup_pagamento(pagamento, setup_intent)

            if pagamento.status == PagamentoStatus.CANCELADO:
                skipped += 1
                continue

            setup_status = _stripe_attr(setup_intent, "status")
            if setup_status != "succeeded":
                skipped += 1
                if logger:
                    logger.info(
                        "Pagamento id=%s aguardando cartao salvo status=%s",
                        pagamento.id,
                        setup_status,
                    )
                continue

            intent = criar_intent_com_payment_method_salvo(pagamento)

            if intent.status == "requires_capture":
                authorized += 1
            elif intent.status == "succeeded":
                try:
                    pagamento = capturar_pagamento_seguro(pagamento)
                except ValueError:
                    skipped += 1
                    continue

                if pagamento.status == PagamentoStatus.PAGO:
                    authorized += 1
                else:
                    skipped += 1
            elif intent.status == "canceled":
                marcar_pagamento_cancelado(pagamento)
                skipped += 1
            else:
                skipped += 1
                if logger:
                    logger.info(
                        "Pagamento id=%s sem autorizacao status=%s",
                        pagamento.id,
                        intent.status,
                    )
        except Exception:
            errors += 1
            if logger:
                logger.exception(
                    "Erro ao autorizar pagamento agendado id=%s",
                    pagamento.id,
                )

    return {
        "total": total,
        "authorized": authorized,
        "skipped": skipped,
        "errors": errors,
    }


def processar_pagamentos_pendentes(logger=None):
    scheduled_stats = processar_pagamentos_agendados(logger=logger)

    pagamentos = (
        Pagamento.objects
        .filter(status=PagamentoStatus.PENDENTE)
        .exclude(stripe_payment_intent_id__isnull=True)
        .select_related("pedido__evento", "pedido__cliente", "pedido__bartender")
    )

    total = scheduled_stats["total"]
    captured = 0
    skipped = scheduled_stats["skipped"]
    errors = scheduled_stats["errors"]

    for pagamento in pagamentos:
        total += 1
        try:
            if not pode_capturar(pagamento):
                skipped += 1
                continue

            pagamento = capturar_pagamento_seguro(pagamento)
            if pagamento.status == PagamentoStatus.PAGO:
                captured += 1
            else:
                skipped += 1
                if logger:
                    logger.info(
                        "Pagamento id=%s sem captura status=%s",
                        pagamento.id,
                        pagamento.status,
                    )
        except ValueError:
            skipped += 1
            if logger:
                logger.info("Pagamento id=%s ainda sem captura", pagamento.id)
        except Exception:
            errors += 1
            if logger:
                logger.exception(
                    "Erro ao processar pagamento id=%s",
                    pagamento.id,
                )

    return {
        "total": total,
        "authorized": scheduled_stats["authorized"],
        "captured": captured,
        "skipped": skipped,
        "errors": errors,
    }


# =========================
# WEBHOOK (IDEMPOTENTE)
# =========================

def processar_webhook(event):
    tipo = event["type"]
    data = event["data"]["object"]

    if tipo == "payment_intent.succeeded":
        pagamento_ref = Pagamento.objects.filter(
            stripe_payment_intent_id=data["id"]
        ).values("id", "pedido_id").first()

        if not pagamento_ref:
            return

        from core.models import Pedido

        with transaction.atomic():
            pedido = Pedido.objects.select_for_update().get(pk=pagamento_ref["pedido_id"])
            pagamento = (
                Pagamento.objects
                .select_for_update()
                .select_related("pedido")
                .get(pk=pagamento_ref["id"])
            )

            if pagamento.status == PagamentoStatus.PAGO:
                return

            try:
                if not _captura_liberada_por_presenca(pedido, persistir_automatica=True):
                    return
            except ValueError:
                return

            update_fields = ["status"]
            metodo_stripe = _extrair_metodo_pagamento_stripe(data)
            if metodo_stripe and pagamento.stripe_payment_method_type != metodo_stripe:
                pagamento.stripe_payment_method_type = metodo_stripe
                update_fields.append("stripe_payment_method_type")

            pagamento.status = PagamentoStatus.PAGO
            pagamento.save(update_fields=update_fields)

            pedido.status = PedidoStatus.PAGO
            pedido.save(update_fields=["status"])

    elif tipo in ["payment_intent.payment_failed", "payment_intent.canceled"]:
        Pagamento.objects.filter(
            stripe_payment_intent_id=data["id"]
        ).update(status=PagamentoStatus.CANCELADO)

    elif tipo == "setup_intent.succeeded":
        pagamento = Pagamento.objects.filter(
            stripe_setup_intent_id=data["id"]
        ).first()

        if pagamento:
            sincronizar_setup_pagamento(pagamento, data)

    elif tipo == "setup_intent.canceled":
        Pagamento.objects.filter(
            stripe_setup_intent_id=data["id"],
            stripe_payment_intent_id__isnull=True,
        ).update(status=PagamentoStatus.CANCELADO)
