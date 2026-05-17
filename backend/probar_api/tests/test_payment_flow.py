import datetime
from decimal import Decimal
from uuid import uuid4

import pytest
from rest_framework.test import APIClient

from core.enums import PagamentoMetodo, PagamentoStatus, PedidoStatus, PresencaOrigem, PresencaStatus, TipoUsuario
from core.models import Bartender, Cliente, Evento, Pagamento, Pedido, User
from core.services import stripe_service


class DummyIntent:
    def __init__(self, intent_id="pi_123", client_secret="secret", status="requires_capture"):
        self.id = intent_id
        self.client_secret = client_secret
        self.status = status
        self.payment_method_types = ["card"]


class DummySetupIntent:
    def __init__(
        self,
        intent_id="seti_123",
        client_secret="seti_secret",
        status="requires_payment_method",
        payment_method=None,
    ):
        self.id = intent_id
        self.client_secret = client_secret
        self.status = status
        self.payment_method = payment_method
        self.payment_method_types = ["card"]


class DummyCustomer:
    def __init__(self, customer_id="cus_123"):
        self.id = customer_id


def _create_pedido(
    *,
    status=PedidoStatus.ACEITO,
    valor_total=Decimal("100.00"),
    onboarding=True,
    has_account=True,
    event_date=None,
    hora_inicio=datetime.time(20, 0),
    hora_fim=datetime.time(23, 0),
    horas_aprovadas=3,
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
        data=event_date or datetime.date.today(),
        hora_inicio=hora_inicio,
        hora_fim=hora_fim,
        quantidade_convidados=20,
    )

    pedido = Pedido.objects.create(
        cliente=cliente,
        bartender=bartender,
        evento=evento,
        status=status,
        valor_total_aprovado=valor_total,
        horas_aprovadas=horas_aprovadas,
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
def test_confirmar_pagamento_autorizado_sincroniza_requires_capture(monkeypatch):
    pedido, cliente_user = _create_pedido()
    pagamento = Pagamento.objects.create(
        pedido=pedido,
        valor=Decimal("100.00"),
        status=PagamentoStatus.PENDENTE,
        stripe_payment_intent_id="pi_autorizado",
    )

    def fake_retrieve(payment_intent_id):
        assert payment_intent_id == "pi_autorizado"
        return DummyIntent(intent_id=payment_intent_id, status="requires_capture")

    monkeypatch.setattr(stripe_service.stripe.PaymentIntent, "retrieve", fake_retrieve)

    client = APIClient()
    client.force_authenticate(cliente_user)
    response = client.post(f"/api/v1/stripe/pagamento-autorizado/{pagamento.id}/")

    assert response.status_code == 200, response.data
    pagamento.refresh_from_db()
    assert pagamento.status == PagamentoStatus.PENDENTE
    assert pagamento.finalizado_pelo_cliente is True
    assert response.data["stripe_status"] == "requires_capture"
    assert response.data["finalizado_pelo_cliente"] is True


@pytest.mark.django_db
def test_confirmar_pagamento_autorizado_nao_marca_pago_quando_intent_succeeded(monkeypatch):
    pedido, cliente_user = _create_pedido()
    pagamento = Pagamento.objects.create(
        pedido=pedido,
        valor=Decimal("100.00"),
        status=PagamentoStatus.PENDENTE,
        stripe_payment_intent_id="pi_succeeded_antes_presenca",
    )

    def fake_retrieve(payment_intent_id):
        assert payment_intent_id == "pi_succeeded_antes_presenca"
        return DummyIntent(intent_id=payment_intent_id, status="succeeded")

    monkeypatch.setattr(stripe_service.stripe.PaymentIntent, "retrieve", fake_retrieve)

    client = APIClient()
    client.force_authenticate(cliente_user)
    response = client.post(f"/api/v1/stripe/pagamento-autorizado/{pagamento.id}/")

    assert response.status_code == 400, response.data
    pagamento.refresh_from_db()
    pedido.refresh_from_db()
    assert pagamento.status == PagamentoStatus.PENDENTE
    assert pagamento.finalizado_pelo_cliente is False
    assert pedido.status == PedidoStatus.ACEITO


@pytest.mark.django_db
def test_criar_pagamento_seguro_bloqueia_onboarding_incompleto():
    pedido, cliente_user = _create_pedido(onboarding=False)

    with pytest.raises(ValueError, match="Onboarding do bartender incompleto"):
        stripe_service.criar_pagamento_seguro(pedido.id, cliente_user)


@pytest.mark.django_db
def test_criar_pagamento_seguro_evento_distante_salva_cartao(monkeypatch, settings):
    settings.STRIPE_MANUAL_CAPTURE_WINDOW_DAYS = 5
    pedido, cliente_user = _create_pedido(
        event_date=datetime.date.today() + datetime.timedelta(days=30)
    )
    created_setup = {}

    def fake_customer_create(**kwargs):
        return DummyCustomer("cus_future")

    def fake_setup_create(**kwargs):
        created_setup.update(kwargs)
        return DummySetupIntent(
            intent_id="seti_future",
            client_secret="seti_secret_future",
        )

    def fail_payment_intent_create(**_kwargs):
        raise AssertionError("PaymentIntent nao deve ser criado para evento distante")

    monkeypatch.setattr(stripe_service.stripe.Customer, "create", fake_customer_create)
    monkeypatch.setattr(stripe_service.stripe.SetupIntent, "create", fake_setup_create)
    monkeypatch.setattr(
        stripe_service.stripe.PaymentIntent,
        "create",
        fail_payment_intent_create,
    )

    pagamento, setup_intent = stripe_service.criar_pagamento_seguro(
        pedido.id,
        cliente_user,
    )

    pedido.cliente.refresh_from_db()
    assert setup_intent.client_secret == "seti_secret_future"
    assert created_setup["customer"] == "cus_future"
    assert created_setup["usage"] == "off_session"
    assert pagamento.status == PagamentoStatus.PENDENTE
    assert pagamento.stripe_setup_intent_id == "seti_future"
    assert pagamento.stripe_payment_intent_id is None
    assert pedido.cliente.stripe_customer_id == "cus_future"


@pytest.mark.django_db
def test_capturar_pagamento_seguro_requires_capture(monkeypatch):
    pedido, _ = _create_pedido()
    pedido.presenca_status = PresencaStatus.PRESENTE
    pedido.save(update_fields=["presenca_status"])
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
    pedido.presenca_status = PresencaStatus.PRESENTE
    pedido.save(update_fields=["presenca_status"])
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
    pedido.presenca_status = PresencaStatus.PRESENTE
    pedido.save(update_fields=["presenca_status"])
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

    with pytest.raises(ValueError, match="Pagamento ainda nao confirmado"):
        stripe_service.capturar_pagamento_seguro(pagamento)


@pytest.mark.django_db
def test_processar_pagamentos_pendentes_skip_requires_payment_method(monkeypatch):
    pedido, _ = _create_pedido()
    pedido.presenca_status = PresencaStatus.PRESENTE
    pedido.save(update_fields=["presenca_status"])
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


@pytest.mark.django_db
def test_processar_pagamentos_agendados_autoriza_cartao_salvo(monkeypatch):
    pedido, _ = _create_pedido(
        event_date=datetime.date.today() + datetime.timedelta(days=1)
    )
    pedido.cliente.stripe_customer_id = "cus_saved"
    pedido.cliente.save(update_fields=["stripe_customer_id"])
    pagamento = Pagamento.objects.create(
        pedido=pedido,
        valor=pedido.valor_total_aprovado,
        metodo_pagamento=PagamentoMetodo.STRIPE,
        stripe_setup_intent_id="seti_saved",
    )
    created_intent = {}

    def fake_setup_retrieve(_setup_id):
        return DummySetupIntent(
            intent_id=_setup_id,
            status="succeeded",
            payment_method="pm_saved",
        )

    def fake_intent_create(**kwargs):
        created_intent.update(kwargs)
        return DummyIntent(intent_id="pi_scheduled", status="requires_capture")

    monkeypatch.setattr(stripe_service.stripe.SetupIntent, "retrieve", fake_setup_retrieve)
    monkeypatch.setattr(stripe_service.stripe.PaymentIntent, "create", fake_intent_create)

    stats = stripe_service.processar_pagamentos_agendados()

    pagamento.refresh_from_db()

    assert stats["total"] == 1
    assert stats["authorized"] == 1
    assert stats["skipped"] == 0
    assert stats["errors"] == 0
    assert created_intent["customer"] == "cus_saved"
    assert created_intent["payment_method"] == "pm_saved"
    assert created_intent["confirm"] is True
    assert created_intent["off_session"] is True
    assert created_intent["capture_method"] == "manual"
    assert pagamento.stripe_payment_intent_id == "pi_scheduled"
    assert pagamento.stripe_payment_method_id == "pm_saved"


@pytest.mark.django_db
def test_criar_pagamento_seguro_recria_setup_cancelado(monkeypatch, settings):
    settings.STRIPE_MANUAL_CAPTURE_WINDOW_DAYS = 5
    pedido, cliente_user = _create_pedido(
        event_date=datetime.date.today() + datetime.timedelta(days=30)
    )
    pagamento = Pagamento.objects.create(
        pedido=pedido,
        valor=pedido.valor_total_aprovado,
        metodo_pagamento=PagamentoMetodo.STRIPE,
        stripe_setup_intent_id="seti_cancelado",
    )

    def fake_setup_retrieve(_setup_id):
        return DummySetupIntent(
            intent_id=_setup_id,
            status="canceled",
        )

    def fake_customer_create(**_kwargs):
        return DummyCustomer("cus_retry")

    def fake_setup_create(**_kwargs):
        return DummySetupIntent(
            intent_id="seti_retry",
            client_secret="seti_retry_secret",
        )

    def fail_payment_intent_create(**_kwargs):
        raise AssertionError("PaymentIntent nao deve ser criado para evento distante")

    monkeypatch.setattr(stripe_service.stripe.SetupIntent, "retrieve", fake_setup_retrieve)
    monkeypatch.setattr(stripe_service.stripe.Customer, "create", fake_customer_create)
    monkeypatch.setattr(stripe_service.stripe.SetupIntent, "create", fake_setup_create)
    monkeypatch.setattr(
        stripe_service.stripe.PaymentIntent,
        "create",
        fail_payment_intent_create,
    )

    pagamento_atualizado, setup_intent = stripe_service.criar_pagamento_seguro(
        pedido.id,
        cliente_user,
    )

    pagamento.refresh_from_db()

    assert pagamento_atualizado.id == pagamento.id
    assert setup_intent.id == "seti_retry"
    assert pagamento.status == PagamentoStatus.PENDENTE
    assert pagamento.stripe_setup_intent_id == "seti_retry"
    assert pagamento.stripe_payment_intent_id is None


@pytest.mark.django_db
def test_finalizar_pagamento_nao_marca_finalizado_quando_captura_falha(monkeypatch):
    pedido, cliente_user = _create_pedido(
        event_date=datetime.date.today() - datetime.timedelta(days=1)
    )
    pagamento = Pagamento.objects.create(
        pedido=pedido,
        valor=pedido.valor_total_aprovado,
        metodo_pagamento=PagamentoMetodo.STRIPE,
        stripe_payment_intent_id="pi_falha",
    )

    def fake_capture(_pagamento):
        raise ValueError("Pagamento ainda nao confirmado")

    monkeypatch.setattr(stripe_service, "capturar_pagamento_seguro", fake_capture)

    client = APIClient()
    client.force_authenticate(user=cliente_user)

    response = client.post(f"/api/v1/stripe/finalizar/{pagamento.id}/")

    pagamento.refresh_from_db()

    assert response.status_code == 400
    assert pagamento.status == PagamentoStatus.PENDENTE
    assert pagamento.finalizado_pelo_cliente is False
    pedido.refresh_from_db()
    assert pedido.presenca_status == PresencaStatus.PRESENTE


@pytest.mark.django_db
def test_finalizar_pagamento_salva_finalizado_depois_da_captura(monkeypatch):
    pedido, cliente_user = _create_pedido(
        event_date=datetime.date.today() - datetime.timedelta(days=1)
    )
    pagamento = Pagamento.objects.create(
        pedido=pedido,
        valor=pedido.valor_total_aprovado,
        metodo_pagamento=PagamentoMetodo.STRIPE,
        stripe_payment_intent_id="pi_ok",
    )

    def fake_capture(pagamento_para_capturar):
        pagamento_para_capturar.status = PagamentoStatus.PAGO
        pagamento_para_capturar.save(update_fields=["status"])

    monkeypatch.setattr(stripe_service, "capturar_pagamento_seguro", fake_capture)

    client = APIClient()
    client.force_authenticate(user=cliente_user)

    response = client.post(f"/api/v1/stripe/finalizar/{pagamento.id}/")

    pagamento.refresh_from_db()

    assert response.status_code == 200
    assert pagamento.status == PagamentoStatus.PAGO
    assert pagamento.finalizado_pelo_cliente is True
    pedido.refresh_from_db()
    assert pedido.presenca_status == PresencaStatus.PRESENTE


@pytest.mark.django_db
def test_fim_servico_contratado_usa_inicio_evento_mais_horas_aprovadas():
    pedido, _ = _create_pedido(
        event_date=datetime.date.today(),
        hora_inicio=datetime.time(14, 0),
        hora_fim=datetime.time(18, 0),
        horas_aprovadas=2,
    )

    assert pedido.servico_inicio_previsto.time() == datetime.time(14, 0)
    assert pedido.servico_fim_previsto.time() == datetime.time(16, 0)
    assert pedido.liberacao_automatica_em.time() == datetime.time(16, 5)


@pytest.mark.django_db
def test_pedido_antigo_sem_horas_aprovadas_usa_fim_do_evento():
    pedido, _ = _create_pedido(
        event_date=datetime.date.today(),
        hora_inicio=datetime.time(14, 0),
        hora_fim=datetime.time(18, 0),
        horas_aprovadas=None,
    )

    assert pedido.servico_fim_previsto.time() == datetime.time(18, 0)
    assert pedido.liberacao_automatica_em.time() == datetime.time(18, 5)


@pytest.mark.django_db
def test_fim_servico_contratado_funciona_em_evento_que_passa_da_meia_noite():
    event_date = datetime.date.today()
    pedido, _ = _create_pedido(
        event_date=event_date,
        hora_inicio=datetime.time(22, 0),
        hora_fim=datetime.time(2, 0),
        horas_aprovadas=3,
    )

    assert pedido.servico_fim_previsto.date() == event_date + datetime.timedelta(days=1)
    assert pedido.servico_fim_previsto.time() == datetime.time(1, 0)
    assert pedido.liberacao_automatica_em.time() == datetime.time(1, 5)


@pytest.mark.django_db
def test_cliente_confirma_presenca_e_captura_pagamento(monkeypatch):
    pedido, cliente_user = _create_pedido(
        event_date=datetime.date.today() - datetime.timedelta(days=1)
    )
    pagamento = Pagamento.objects.create(
        pedido=pedido,
        valor=pedido.valor_total_aprovado,
        metodo_pagamento=PagamentoMetodo.STRIPE,
        stripe_payment_intent_id="pi_presenca",
    )

    def fake_retrieve(_intent_id):
        return DummyIntent(intent_id=_intent_id, status="requires_capture")

    captured_ids = []

    def fake_capture(intent_id):
        captured_ids.append(intent_id)

    monkeypatch.setattr(stripe_service.stripe.PaymentIntent, "retrieve", fake_retrieve)
    monkeypatch.setattr(stripe_service.stripe.PaymentIntent, "capture", fake_capture)

    client = APIClient()
    client.force_authenticate(user=cliente_user)

    response = client.post(f"/api/v1/pedidos/{pedido.id}/confirmar-presenca/", data={}, format="json")

    pedido.refresh_from_db()
    pagamento.refresh_from_db()

    assert response.status_code == 200, response.data
    assert pedido.presenca_status == PresencaStatus.PRESENTE
    assert pedido.presenca_origem == PresencaOrigem.CLIENTE
    assert pagamento.status == PagamentoStatus.PAGO
    assert pedido.status == PedidoStatus.PAGO
    assert captured_ids == ["pi_presenca"]


@pytest.mark.django_db
def test_bartender_nao_pode_confirmar_presenca():
    pedido, _ = _create_pedido(
        event_date=datetime.date.today() - datetime.timedelta(days=1)
    )

    client = APIClient()
    client.force_authenticate(user=pedido.bartender.user)

    response = client.post(f"/api/v1/pedidos/{pedido.id}/confirmar-presenca/", data={}, format="json")

    pedido.refresh_from_db()

    assert response.status_code == 403
    assert pedido.presenca_status == PresencaStatus.PENDENTE


@pytest.mark.django_db
def test_registrar_ausencia_bloqueia_captura(monkeypatch):
    pedido, cliente_user = _create_pedido(
        event_date=datetime.date.today() - datetime.timedelta(days=1)
    )
    pagamento = Pagamento.objects.create(
        pedido=pedido,
        valor=pedido.valor_total_aprovado,
        metodo_pagamento=PagamentoMetodo.STRIPE,
        stripe_payment_intent_id="pi_ausente",
    )

    def fake_retrieve(_intent_id):
        return DummyIntent(intent_id=_intent_id, status="requires_capture")

    monkeypatch.setattr(stripe_service.stripe.PaymentIntent, "retrieve", fake_retrieve)

    client = APIClient()
    client.force_authenticate(user=cliente_user)

    response = client.post(
        f"/api/v1/pedidos/{pedido.id}/registrar-ausencia/",
        data={"observacao": "Nao compareceu"},
        format="json",
    )

    pedido.refresh_from_db()

    assert response.status_code == 200, response.data
    assert pedido.presenca_status == PresencaStatus.AUSENTE
    assert pedido.presenca_origem == PresencaOrigem.CLIENTE

    with pytest.raises(ValueError, match="ausencia"):
        stripe_service.capturar_pagamento_seguro(pagamento)

    pagamento.refresh_from_db()
    assert pagamento.status == PagamentoStatus.PENDENTE


@pytest.mark.django_db
def test_endpoint_finalizar_respeita_ausencia_registrada():
    pedido, cliente_user = _create_pedido(
        event_date=datetime.date.today() - datetime.timedelta(days=1)
    )
    pagamento = Pagamento.objects.create(
        pedido=pedido,
        valor=pedido.valor_total_aprovado,
        metodo_pagamento=PagamentoMetodo.STRIPE,
        stripe_payment_intent_id="pi_finalizar_ausente",
    )
    pedido.presenca_status = PresencaStatus.AUSENTE
    pedido.presenca_origem = PresencaOrigem.CLIENTE
    pedido.save(update_fields=["presenca_status", "presenca_origem"])

    client = APIClient()
    client.force_authenticate(user=cliente_user)

    response = client.post(f"/api/v1/stripe/finalizar/{pagamento.id}/")

    pagamento.refresh_from_db()

    assert response.status_code == 400
    assert pagamento.status == PagamentoStatus.PENDENTE


@pytest.mark.django_db
def test_endpoint_capturar_respeita_ausencia_registrada():
    pedido, cliente_user = _create_pedido(
        event_date=datetime.date.today() - datetime.timedelta(days=1)
    )
    pagamento = Pagamento.objects.create(
        pedido=pedido,
        valor=pedido.valor_total_aprovado,
        metodo_pagamento=PagamentoMetodo.STRIPE,
        stripe_payment_intent_id="pi_capturar_ausente",
    )
    pedido.presenca_status = PresencaStatus.AUSENTE
    pedido.presenca_origem = PresencaOrigem.CLIENTE
    pedido.save(update_fields=["presenca_status", "presenca_origem"])

    client = APIClient()
    client.force_authenticate(user=cliente_user)

    response = client.post(f"/api/v1/stripe/capturar/{pagamento.id}/")

    pagamento.refresh_from_db()

    assert response.status_code == 400
    assert pagamento.status == PagamentoStatus.PENDENTE


@pytest.mark.django_db
def test_processar_pagamentos_pendentes_libera_automaticamente_apos_5_minutos(monkeypatch):
    pedido, _ = _create_pedido(
        event_date=datetime.date.today() - datetime.timedelta(days=1),
        hora_inicio=datetime.time(14, 0),
        hora_fim=datetime.time(18, 0),
        horas_aprovadas=2,
    )
    pagamento = Pagamento.objects.create(
        pedido=pedido,
        valor=pedido.valor_total_aprovado,
        metodo_pagamento=PagamentoMetodo.STRIPE,
        stripe_payment_intent_id="pi_auto",
    )

    def fake_retrieve(_intent_id):
        return DummyIntent(intent_id=_intent_id, status="requires_capture")

    captured_ids = []

    def fake_capture(intent_id):
        captured_ids.append(intent_id)

    monkeypatch.setattr(stripe_service.stripe.PaymentIntent, "retrieve", fake_retrieve)
    monkeypatch.setattr(stripe_service.stripe.PaymentIntent, "capture", fake_capture)

    stats = stripe_service.processar_pagamentos_pendentes()

    pedido.refresh_from_db()
    pagamento.refresh_from_db()

    assert stats["captured"] == 1
    assert pedido.presenca_status == PresencaStatus.PRESENTE
    assert pedido.presenca_origem == PresencaOrigem.AUTOMATICA
    assert pagamento.status == PagamentoStatus.PAGO
    assert captured_ids == ["pi_auto"]


@pytest.mark.django_db
def test_processar_pagamentos_agendados_nao_marca_pago_antes_da_liberacao(monkeypatch, settings):
    settings.STRIPE_MANUAL_CAPTURE_WINDOW_DAYS = 5
    pedido, _ = _create_pedido(
        event_date=datetime.date.today() + datetime.timedelta(days=1),
        hora_inicio=datetime.time(14, 0),
        hora_fim=datetime.time(18, 0),
        horas_aprovadas=2,
    )
    pedido.cliente.stripe_customer_id = "cus_scheduled"
    pedido.cliente.save(update_fields=["stripe_customer_id"])
    pagamento = Pagamento.objects.create(
        pedido=pedido,
        valor=pedido.valor_total_aprovado,
        metodo_pagamento=PagamentoMetodo.STRIPE,
        stripe_setup_intent_id="seti_scheduled",
    )

    def fake_setup_retrieve(_intent_id):
        return DummySetupIntent(
            intent_id="seti_scheduled",
            status="succeeded",
            payment_method="pm_scheduled",
        )

    def fake_payment_create(**_kwargs):
        return DummyIntent(intent_id="pi_scheduled", status="succeeded")

    monkeypatch.setattr(stripe_service.stripe.SetupIntent, "retrieve", fake_setup_retrieve)
    monkeypatch.setattr(stripe_service.stripe.PaymentIntent, "create", fake_payment_create)

    stats = stripe_service.processar_pagamentos_pendentes()

    pedido.refresh_from_db()
    pagamento.refresh_from_db()

    assert stats["authorized"] == 0
    assert stats["captured"] == 0
    assert stats["errors"] == 0
    assert pagamento.status == PagamentoStatus.PENDENTE
    assert pedido.status == PedidoStatus.ACEITO
    assert pedido.presenca_status == PresencaStatus.PENDENTE


@pytest.mark.django_db
def test_webhook_succeeded_respeita_ausencia_registrada():
    pedido, _ = _create_pedido(
        event_date=datetime.date.today() - datetime.timedelta(days=1)
    )
    pagamento = Pagamento.objects.create(
        pedido=pedido,
        valor=pedido.valor_total_aprovado,
        metodo_pagamento=PagamentoMetodo.STRIPE,
        stripe_payment_intent_id="pi_webhook_ausente",
    )
    pedido.presenca_status = PresencaStatus.AUSENTE
    pedido.presenca_origem = PresencaOrigem.CLIENTE
    pedido.save(update_fields=["presenca_status", "presenca_origem"])

    stripe_service.processar_webhook(
        {
            "type": "payment_intent.succeeded",
            "data": {
                "object": {
                    "id": "pi_webhook_ausente",
                    "status": "succeeded",
                    "payment_method_types": ["card"],
                }
            },
        }
    )

    pedido.refresh_from_db()
    pagamento.refresh_from_db()

    assert pedido.status == PedidoStatus.ACEITO
    assert pedido.presenca_status == PresencaStatus.AUSENTE
    assert pagamento.status == PagamentoStatus.PENDENTE


@pytest.mark.django_db
def test_webhook_succeeded_antes_da_liberacao_nao_marca_pago():
    pedido, _ = _create_pedido(
        event_date=datetime.date.today() + datetime.timedelta(days=1),
        hora_inicio=datetime.time(14, 0),
        hora_fim=datetime.time(18, 0),
        horas_aprovadas=2,
    )
    pagamento = Pagamento.objects.create(
        pedido=pedido,
        valor=pedido.valor_total_aprovado,
        metodo_pagamento=PagamentoMetodo.STRIPE,
        stripe_payment_intent_id="pi_webhook_early",
    )

    stripe_service.processar_webhook(
        {
            "type": "payment_intent.succeeded",
            "data": {
                "object": {
                    "id": "pi_webhook_early",
                    "status": "succeeded",
                    "payment_method_types": ["card"],
                }
            },
        }
    )

    pedido.refresh_from_db()
    pagamento.refresh_from_db()

    assert pedido.status == PedidoStatus.ACEITO
    assert pedido.presenca_status == PresencaStatus.PENDENTE
    assert pagamento.status == PagamentoStatus.PENDENTE
