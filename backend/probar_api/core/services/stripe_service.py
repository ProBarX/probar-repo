import stripe
from django.conf import settings
from django.utils import timezone
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP

from core.models import Pagamento
from core.enums import PedidoStatus, PagamentoStatus, PagamentoMetodo
from django.db import transaction


stripe.api_key = settings.STRIPE_SECRET_KEY


# =========================
# ONBOARDING
# =========================

def criar_conta_express(email: str):
    return stripe.Account.create(
        type="express",
        country="BR",
        email=email,
    ).id


def criar_link_onboarding(account_id: str):
    return stripe.AccountLink.create(
        account=account_id,
        refresh_url=settings.STRIPE_REFRESH_URL,
        return_url=settings.STRIPE_RETURN_URL,
        type="account_onboarding",
    )


def verificar_onboarding(bartender):
    if not bartender.stripe_account_id:
        return False

    account = stripe.Account.retrieve(bartender.stripe_account_id)

    completo = account.details_submitted and account.charges_enabled

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

    if hasattr(pedido, "pagamento"):
        raise ValueError("Pedido já possui pagamento")

    if pedido.status != PedidoStatus.ACEITO:
        raise ValueError("Pedido não está aceito")

    if not pedido.bartender.stripe_account_id:
        raise ValueError("Bartender sem conta Stripe")

    if not pedido.bartender.stripe_onboarding_completo:
        raise ValueError("Onboarding do bartender incompleto")
    

def criar_pagamento_seguro(pedido_id, user):
    from core.models import Pedido, Pagamento

    with transaction.atomic():
        # trava a linha no banco
        pedido = (
            Pedido.objects
            .select_for_update()
            .select_related("cliente", "bartender")
            .get(id=pedido_id)
        )

        # validação
        validar_pagamento(pedido, user)

        # double-check (segurança extra)
        if hasattr(pedido, "pagamento"):
            pagamento_existente = pedido.pagamento

            if not pagamento_existente.stripe_payment_intent_id:
                raise ValueError("Pagamento existente sem PaymentIntent")

            intent = stripe.PaymentIntent.retrieve(
                pagamento_existente.stripe_payment_intent_id
            )

            return pagamento_existente, intent

        intent = criar_pagamento_intent(pedido)

        pagamento = Pagamento.objects.create(
            pedido=pedido,
            valor=pedido.valor_total_aprovado,
            metodo_pagamento=PagamentoMetodo.STRIPE,
            stripe_payment_intent_id=intent.id
        )

        return pagamento, intent


def criar_pagamento_intent(pedido):
    amount = _to_cents(pedido.valor_total_aprovado)
    fee_amount = _calcular_taxa_plataforma(amount)

    return stripe.PaymentIntent.create(
        amount=amount,
        currency="brl",
        capture_method="manual",
        transfer_data={
            "destination": pedido.bartender.stripe_account_id
        },
        application_fee_amount=fee_amount,
        idempotency_key=f"pedido_{pedido.id}"
    )


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

def pode_capturar(pagamento):
    pedido = pagamento.pedido
    evento = pedido.evento

    fim_evento = timezone.make_aware(
        datetime.combine(evento.data, evento.hora_fim)
    )

    agora = timezone.now()

    return (
        getattr(pagamento, "finalizado_pelo_cliente", False)
        or agora >= fim_evento + timedelta(hours=2)
    )


# =========================
# CAPTURA
# =========================

def capturar_pagamento(pagamento):
    if pagamento.status == PagamentoStatus.PAGO:
        return pagamento

    if pagamento.status != PagamentoStatus.PENDENTE:
        raise ValueError("Pagamento não está pendente")

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


def capturar_pagamento_seguro(pagamento):
    if not pode_capturar(pagamento):
        raise ValueError("Pagamento ainda não pode ser liberado")

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

    raise ValueError("Pagamento ainda não confirmado")


# =========================
# PROCESSAMENTO AUTOMÁTICO
# =========================

def processar_pagamentos_pendentes(logger=None):
    pagamentos = Pagamento.objects.filter(status=PagamentoStatus.PENDENTE)
    total = 0
    captured = 0
    skipped = 0
    errors = 0

    for pagamento in pagamentos:
        total += 1
        try:
            if not pode_capturar(pagamento):
                skipped += 1
                continue

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
                capturar_pagamento(pagamento)
                captured += 1
            elif intent.status == "succeeded":
                marcar_pagamento_pago(pagamento)
                marcar_pedido_pago(pagamento)
                captured += 1
            elif intent.status == "canceled":
                marcar_pagamento_cancelado(pagamento)
                skipped += 1
            else:
                skipped += 1
                if logger:
                    logger.info(
                        "Pagamento id=%s sem captura status=%s",
                        pagamento.id,
                        intent.status,
                    )
        except Exception:
            errors += 1
            if logger:
                logger.exception(
                    "Erro ao processar pagamento id=%s",
                    pagamento.id,
                )

    return {
        "total": total,
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
        pagamento = Pagamento.objects.filter(
            stripe_payment_intent_id=data["id"]
        ).select_related("pedido").first()

        if not pagamento or pagamento.status == PagamentoStatus.PAGO:
            return

        update_fields = ["status"]
        metodo_stripe = _extrair_metodo_pagamento_stripe(data)
        if metodo_stripe and pagamento.stripe_payment_method_type != metodo_stripe:
            pagamento.stripe_payment_method_type = metodo_stripe
            update_fields.append("stripe_payment_method_type")

        pagamento.status = PagamentoStatus.PAGO
        pagamento.save(update_fields=update_fields)

        pedido = pagamento.pedido
        pedido.status = PedidoStatus.PAGO
        pedido.save(update_fields=["status"])

    elif tipo == "payment_intent.payment_failed":
        Pagamento.objects.filter(
            stripe_payment_intent_id=data["id"]
        ).update(status=PagamentoStatus.CANCELADO)