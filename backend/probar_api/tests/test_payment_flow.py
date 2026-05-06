import datetime
from decimal import Decimal
from uuid import uuid4

import pytest

from core.enums import PagamentoMetodo, PagamentoStatus, PedidoStatus, TipoUsuario
from core.models import Bartender, Cliente, Evento, Pagamento, Pedido, User
from core.services import stripe_service


class DummyIntent:
    def __init__(self, intent_id="pi_123", client_secret="secret", status="requires_capture"):
        self.id = intent_id
        self.client_secret = client_secret
        self.status = status


def _create_pedido(
    *,
    status=PedidoStatus.ACEITO,
    valor_total=Decimal("100.00"),
    onboarding=True,
    has_account=True,
):
    cliente_user = User.objects.create_user(
        email=f"cliente+{uuid4().hex}@example.com",
        password="pass",
        tipo=TipoUsuario.CLIENTE,
    )
    bartender_user = User.objects.create_user(
        email=f"bartender+{uuid4().hex}@example.com",
        password="pass",
        tipo=TipoUsuario.BARTENDER,
    )

    cliente, _ = Cliente.objects.get_or_create(user=cliente_user)
    bartender, _ = Bartender.objects.get_or_create(user=bartender_user)
    bartender.valor_hora = Decimal("100.00")
    bartender.stripe_account_id = "acct_123" if has_account else None
    bartender.stripe_onboarding_completo = onboarding
    bartender.save()

    evento = Evento.objects.create(
        cliente=cliente,
        nome="Evento pagamento",
        data=datetime.date.today(),
        hora_inicio=datetime.time(20, 0),
        hora_fim=datetime.time(23, 0),
        quantidade_convidados=20,
    )

    pedido = Pedido.objects.create(
        cliente=cliente,
        bartender=bartender,
        evento=evento,
        status=status,
        valor_total_aprovado=valor_total,
    )

    return pedido, cliente_user


@pytest.mark.django_db
def test_criar_pagamento_seguro_inclui_fee_e_metodo_stripe(monkeypatch, settings):
    settings.STRIPE_PLATFORM_FEE_PERCENT = 10
    pedido, cliente_user = _create_pedido()
    created = {}

    def fake_create(**kwargs):
        created.update(kwargs)
        return DummyIntent(intent_id="pi_test", client_secret="secret_test")

    monkeypatch.setattr(stripe_service.stripe.PaymentIntent, "create", fake_create)

    pagamento, intent = stripe_service.criar_pagamento_seguro(pedido.id, cliente_user)

    assert intent.client_secret == "secret_test"
    assert created["amount"] == 10000
    assert created["application_fee_amount"] == 1000
    assert created["transfer_data"]["destination"] == pedido.bartender.stripe_account_id
    assert pagamento.metodo_pagamento == PagamentoMetodo.STRIPE
    assert pagamento.status == PagamentoStatus.PENDENTE
    assert pagamento.stripe_payment_intent_id == "pi_test"


@pytest.mark.django_db
def test_criar_pagamento_seguro_bloqueia_onboarding_incompleto():
    pedido, cliente_user = _create_pedido(onboarding=False)

    with pytest.raises(ValueError, match="Onboarding do bartender incompleto"):
        stripe_service.criar_pagamento_seguro(pedido.id, cliente_user)


@pytest.mark.django_db
def test_capturar_pagamento_seguro_requires_capture(monkeypatch):
    pedido, _ = _create_pedido()
    pagamento = Pagamento.objects.create(
        pedido=pedido,
        valor=pedido.valor_total_aprovado,
        metodo_pagamento=PagamentoMetodo.STRIPE,
        stripe_payment_intent_id="pi_capture",
        finalizado_pelo_cliente=True,
    )

    def fake_retrieve(_intent_id):
        return DummyIntent(intent_id=_intent_id, status="requires_capture")

    captured_ids = []

    def fake_capture(intent_id):
        captured_ids.append(intent_id)

    monkeypatch.setattr(stripe_service.stripe.PaymentIntent, "retrieve", fake_retrieve)
    monkeypatch.setattr(stripe_service.stripe.PaymentIntent, "capture", fake_capture)

    stripe_service.capturar_pagamento_seguro(pagamento)

    pagamento.refresh_from_db()
    pedido.refresh_from_db()

    assert captured_ids == ["pi_capture"]
    assert pagamento.status == PagamentoStatus.PAGO
    assert pedido.status == PedidoStatus.PAGO


@pytest.mark.django_db
def test_capturar_pagamento_seguro_succeeded_nao_recaptura(monkeypatch):
    pedido, _ = _create_pedido()
    pagamento = Pagamento.objects.create(
        pedido=pedido,
        valor=pedido.valor_total_aprovado,
        metodo_pagamento=PagamentoMetodo.STRIPE,
        stripe_payment_intent_id="pi_succeeded",
        finalizado_pelo_cliente=True,
    )

    def fake_retrieve(_intent_id):
        return DummyIntent(intent_id=_intent_id, status="succeeded")

    monkeypatch.setattr(stripe_service.stripe.PaymentIntent, "retrieve", fake_retrieve)

    stripe_service.capturar_pagamento_seguro(pagamento)

    pagamento.refresh_from_db()
    pedido.refresh_from_db()

    assert pagamento.status == PagamentoStatus.PAGO
    assert pedido.status == PedidoStatus.PAGO


@pytest.mark.django_db
def test_capturar_pagamento_seguro_requires_payment_method(monkeypatch):
    pedido, _ = _create_pedido()
    pagamento = Pagamento.objects.create(
        pedido=pedido,
        valor=pedido.valor_total_aprovado,
        metodo_pagamento=PagamentoMetodo.STRIPE,
        stripe_payment_intent_id="pi_requires_method",
        finalizado_pelo_cliente=True,
    )

    def fake_retrieve(_intent_id):
        return DummyIntent(intent_id=_intent_id, status="requires_payment_method")

    monkeypatch.setattr(stripe_service.stripe.PaymentIntent, "retrieve", fake_retrieve)

    with pytest.raises(ValueError, match="Pagamento ainda não confirmado"):
        stripe_service.capturar_pagamento_seguro(pagamento)


@pytest.mark.django_db
def test_processar_pagamentos_pendentes_skip_requires_payment_method(monkeypatch):
    pedido, _ = _create_pedido()
    pagamento = Pagamento.objects.create(
        pedido=pedido,
        valor=pedido.valor_total_aprovado,
        metodo_pagamento=PagamentoMetodo.STRIPE,
        stripe_payment_intent_id="pi_pending",
        finalizado_pelo_cliente=True,
    )

    def fake_retrieve(_intent_id):
        return DummyIntent(intent_id=_intent_id, status="requires_payment_method")

    monkeypatch.setattr(stripe_service.stripe.PaymentIntent, "retrieve", fake_retrieve)

    stats = stripe_service.processar_pagamentos_pendentes()

    pagamento.refresh_from_db()

    assert stats["total"] == 1
    assert stats["captured"] == 0
    assert stats["skipped"] == 1
    assert stats["errors"] == 0
    assert pagamento.status == PagamentoStatus.PENDENTE
