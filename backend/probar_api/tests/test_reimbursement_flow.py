import datetime
from decimal import Decimal
from uuid import uuid4

import pytest
from django.db import IntegrityError, transaction
from rest_framework.test import APIClient

from core.enums import (
    PagamentoMetodo,
    PagamentoStatus,
    PedidoStatus,
    PresencaStatus,
    SolicitacaoReembolsoMotivo,
    SolicitacaoReembolsoStatus,
    SolicitacaoReembolsoTipo,
    TipoUsuario,
)
from core.models import Bartender, Cliente, Evento, Pagamento, Pedido, SolicitacaoReembolso, User
from core.services import reembolso_service, stripe_service


class DummyIntent:
    def __init__(self, intent_id="pi_reembolso", status="requires_capture"):
        self.id = intent_id
        self.status = status
        self.payment_method_types = ["card"]


def _results(data):
    if isinstance(data, dict) and "results" in data:
        return data["results"]
    return data


def _create_pedido_com_pagamento(
    *,
    pedido_status=PedidoStatus.ACEITO,
    pagamento_status=PagamentoStatus.PENDENTE,
    valor=Decimal("250.00"),
    stripe_payment_intent_id="pi_reembolso",
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

    evento = Evento.objects.create(
        cliente=cliente,
        nome="Evento reembolso",
        data=datetime.date.today() - datetime.timedelta(days=1),
        hora_inicio=datetime.time(14, 0),
        hora_fim=datetime.time(18, 0),
        quantidade_convidados=30,
    )

    pedido = Pedido.objects.create(
        cliente=cliente,
        bartender=bartender,
        evento=evento,
        status=pedido_status,
        horas_aprovadas=2,
        valor_total_aprovado=valor,
    )

    pagamento = Pagamento.objects.create(
        pedido=pedido,
        valor=valor,
        metodo_pagamento=PagamentoMetodo.STRIPE,
        status=pagamento_status,
        stripe_payment_intent_id=stripe_payment_intent_id,
    )

    return pedido, pagamento, cliente_user, bartender_user


def _registrar_ausencia(pedido, cliente_user, observacao="Bartender nao compareceu"):
    client = APIClient()
    client.force_authenticate(user=cliente_user)
    response = client.post(
        f"/api/v1/pedidos/{pedido.id}/registrar-ausencia/",
        data={"observacao": observacao},
        format="json",
    )
    assert response.status_code == 200, response.data
    return SolicitacaoReembolso.objects.get(pedido=pedido)


def _create_admin_user():
    return User.objects.create_user(
        email=f"admin+{uuid4().hex}@example.com",
        password="pass",
        tipo=TipoUsuario.CLIENTE,
        is_staff=True,
    )


def _aprovar_solicitacao(solicitacao, admin_user=None):
    admin_user = admin_user or _create_admin_user()
    client = APIClient()
    client.force_authenticate(user=admin_user)
    response = client.post(
        f"/api/v1/solicitacoes-reembolso/{solicitacao.id}/aprovar/",
        data={"decisao_admin": "Ausencia validada."},
        format="json",
    )
    assert response.status_code == 200, response.data
    solicitacao.refresh_from_db()
    return solicitacao, admin_user


@pytest.mark.django_db
def test_registrar_ausencia_cria_solicitacao_e_mantem_captura_bloqueada():
    pedido, pagamento, cliente_user, _ = _create_pedido_com_pagamento()

    solicitacao = _registrar_ausencia(pedido, cliente_user)

    pedido.refresh_from_db()
    pagamento.refresh_from_db()

    assert pedido.presenca_status == PresencaStatus.AUSENTE
    assert pagamento.status == PagamentoStatus.PENDENTE
    assert solicitacao.pedido == pedido
    assert solicitacao.pagamento == pagamento
    assert solicitacao.cliente == pedido.cliente
    assert solicitacao.bartender == pedido.bartender
    assert solicitacao.tipo == SolicitacaoReembolsoTipo.CANCELAMENTO_AUTORIZACAO
    assert solicitacao.motivo == SolicitacaoReembolsoMotivo.AUSENCIA_BARTENDER
    assert solicitacao.status == SolicitacaoReembolsoStatus.ABERTA
    assert solicitacao.valor_solicitado == Decimal("250.00")
    assert solicitacao.observacao_cliente == "Bartender nao compareceu"

    with pytest.raises(ValueError, match="ausencia"):
        stripe_service.capturar_pagamento_seguro(pagamento)


@pytest.mark.django_db
def test_solicitacao_ativa_bloqueia_captura_mesmo_sem_ausencia(monkeypatch):
    pedido, pagamento, _, _ = _create_pedido_com_pagamento()
    pedido.presenca_status = PresencaStatus.PRESENTE
    pedido.save(update_fields=["presenca_status"])
    SolicitacaoReembolso.objects.create(
        pedido=pedido,
        pagamento=pagamento,
        cliente=pedido.cliente,
        bartender=pedido.bartender,
        tipo=SolicitacaoReembolsoTipo.CANCELAMENTO_AUTORIZACAO,
        motivo=SolicitacaoReembolsoMotivo.AUSENCIA_BARTENDER,
        status=SolicitacaoReembolsoStatus.ABERTA,
        valor_solicitado=Decimal("250.00"),
    )

    def fail_capture(_intent_id):
        raise AssertionError("Nao deve capturar com solicitacao ativa")

    monkeypatch.setattr(stripe_service.stripe.PaymentIntent, "capture", fail_capture)

    with pytest.raises(ValueError, match="solicitacao de reembolso ativa"):
        stripe_service.capturar_pagamento_seguro(pagamento)

    pagamento.refresh_from_db()
    assert pagamento.status == PagamentoStatus.PENDENTE


@pytest.mark.django_db
def test_bartender_nao_registra_ausencia_nem_cria_solicitacao():
    pedido, _, _, bartender_user = _create_pedido_com_pagamento()

    client = APIClient()
    client.force_authenticate(user=bartender_user)

    response = client.post(
        f"/api/v1/pedidos/{pedido.id}/registrar-ausencia/",
        data={"observacao": "Tentativa invalida"},
        format="json",
    )

    pedido.refresh_from_db()

    assert response.status_code == 403
    assert pedido.presenca_status == PresencaStatus.PENDENTE
    assert SolicitacaoReembolso.objects.filter(pedido=pedido).count() == 0


@pytest.mark.django_db
def test_registrar_ausencia_nao_duplica_solicitacao_ativa():
    pedido, _, cliente_user, _ = _create_pedido_com_pagamento()

    primeira = _registrar_ausencia(pedido, cliente_user, observacao="Primeiro registro")
    segunda = _registrar_ausencia(pedido, cliente_user, observacao="Segundo registro")

    assert primeira.id == segunda.id
    assert SolicitacaoReembolso.objects.filter(pedido=pedido).count() == 1
    assert segunda.observacao_cliente == "Primeiro registro"


@pytest.mark.django_db
def test_registrar_ausencia_em_pagamento_pago_cria_caso_de_reembolso_capturado():
    pedido, pagamento, cliente_user, _ = _create_pedido_com_pagamento(
        pedido_status=PedidoStatus.PAGO,
        pagamento_status=PagamentoStatus.PAGO,
        stripe_payment_intent_id="pi_capturado",
    )

    solicitacao = _registrar_ausencia(pedido, cliente_user)

    pedido.refresh_from_db()
    pagamento.refresh_from_db()

    assert pedido.presenca_status == PresencaStatus.AUSENTE
    assert pagamento.status == PagamentoStatus.PAGO
    assert solicitacao.tipo == SolicitacaoReembolsoTipo.REEMBOLSO_CAPTURADO


@pytest.mark.django_db
def test_cliente_visualiza_solicitacao_atual_do_pedido():
    pedido, _, cliente_user, _ = _create_pedido_com_pagamento()
    solicitacao = _registrar_ausencia(pedido, cliente_user)

    client = APIClient()
    client.force_authenticate(user=cliente_user)

    response = client.get(f"/api/v1/pedidos/{pedido.id}/solicitacao-reembolso/")

    assert response.status_code == 200, response.data
    assert response.data["id"] == solicitacao.id
    assert response.data["pedido"] == pedido.id


@pytest.mark.django_db
def test_outro_cliente_nao_visualiza_solicitacao_do_pedido():
    pedido, _, cliente_user, _ = _create_pedido_com_pagamento()
    _registrar_ausencia(pedido, cliente_user)
    outro_user = User.objects.create_user(
        email=f"outro+{uuid4().hex}@example.com",
        password="pass",
        tipo=TipoUsuario.CLIENTE,
    )
    Cliente.objects.get_or_create(user=outro_user)

    client = APIClient()
    client.force_authenticate(user=outro_user)

    response = client.get(f"/api/v1/pedidos/{pedido.id}/solicitacao-reembolso/")

    assert response.status_code == 404


@pytest.mark.django_db
def test_bartender_responde_solicitacao():
    pedido, _, cliente_user, bartender_user = _create_pedido_com_pagamento()
    solicitacao = _registrar_ausencia(pedido, cliente_user)

    client = APIClient()
    client.force_authenticate(user=bartender_user)

    response = client.post(
        f"/api/v1/solicitacoes-reembolso/{solicitacao.id}/responder/",
        data={"resposta": "Estive no local e tenho comprovante."},
        format="json",
    )

    solicitacao.refresh_from_db()

    assert response.status_code == 200, response.data
    assert solicitacao.status == SolicitacaoReembolsoStatus.CONTESTADA
    assert solicitacao.resposta_bartender == "Estive no local e tenho comprovante."
    assert solicitacao.respondido_em is not None


@pytest.mark.django_db
def test_outro_bartender_nao_responde_solicitacao():
    pedido, _, cliente_user, _ = _create_pedido_com_pagamento()
    solicitacao = _registrar_ausencia(pedido, cliente_user)
    outro_bartender_user = User.objects.create_user(
        email=f"outro-bartender+{uuid4().hex}@example.com",
        password="pass",
        tipo=TipoUsuario.BARTENDER,
    )
    Bartender.objects.get_or_create(user=outro_bartender_user)

    client = APIClient()
    client.force_authenticate(user=outro_bartender_user)

    response = client.post(
        f"/api/v1/solicitacoes-reembolso/{solicitacao.id}/responder/",
        data={"resposta": "Tentativa invalida."},
        format="json",
    )

    solicitacao.refresh_from_db()

    assert response.status_code == 404
    assert solicitacao.status == SolicitacaoReembolsoStatus.ABERTA
    assert solicitacao.resposta_bartender == ""


@pytest.mark.django_db
def test_cliente_nao_responde_como_bartender():
    pedido, _, cliente_user, _ = _create_pedido_com_pagamento()
    solicitacao = _registrar_ausencia(pedido, cliente_user)

    client = APIClient()
    client.force_authenticate(user=cliente_user)

    response = client.post(
        f"/api/v1/solicitacoes-reembolso/{solicitacao.id}/responder/",
        data={"resposta": "Tentativa invalida."},
        format="json",
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_admin_lista_e_aprova_solicitacao_sem_acao_stripe():
    pedido, _, cliente_user, _ = _create_pedido_com_pagamento()
    solicitacao = _registrar_ausencia(pedido, cliente_user)
    admin_user = User.objects.create_user(
        email=f"admin+{uuid4().hex}@example.com",
        password="pass",
        tipo=TipoUsuario.CLIENTE,
        is_staff=True,
    )

    client = APIClient()
    client.force_authenticate(user=admin_user)

    list_response = client.get("/api/v1/solicitacoes-reembolso/")
    approve_response = client.post(
        f"/api/v1/solicitacoes-reembolso/{solicitacao.id}/aprovar/",
        data={"decisao_admin": "Ausencia validada.", "valor_aprovado": "200.00"},
        format="json",
    )

    solicitacao.refresh_from_db()

    assert list_response.status_code == 200, list_response.data
    assert any(item["id"] == solicitacao.id for item in _results(list_response.data))
    assert approve_response.status_code == 200, approve_response.data
    assert solicitacao.status == SolicitacaoReembolsoStatus.APROVADA
    assert solicitacao.valor_aprovado == Decimal("200.00")
    assert solicitacao.decisao_admin == "Ausencia validada."
    assert solicitacao.decidido_por == admin_user


@pytest.mark.django_db
def test_admin_executa_cancelamento_aprovado_requires_capture(monkeypatch):
    pedido, pagamento, cliente_user, _ = _create_pedido_com_pagamento(
        stripe_payment_intent_id="pi_cancelar"
    )
    solicitacao = _registrar_ausencia(pedido, cliente_user)
    solicitacao, admin_user = _aprovar_solicitacao(solicitacao)
    cancel_calls = []

    def fake_retrieve(intent_id):
        return DummyIntent(intent_id=intent_id, status="requires_capture")

    def fake_cancel(intent_id, **kwargs):
        cancel_calls.append((intent_id, kwargs))
        return DummyIntent(intent_id=intent_id, status="canceled")

    def fail_refund(*_args, **_kwargs):
        raise AssertionError("Etapa 6B nao deve criar Refund")

    monkeypatch.setattr(reembolso_service.stripe.PaymentIntent, "retrieve", fake_retrieve)
    monkeypatch.setattr(reembolso_service.stripe.PaymentIntent, "cancel", fake_cancel)
    if hasattr(reembolso_service.stripe, "Refund"):
        monkeypatch.setattr(reembolso_service.stripe.Refund, "create", fail_refund, raising=False)

    client = APIClient()
    client.force_authenticate(user=admin_user)

    response = client.post(
        f"/api/v1/solicitacoes-reembolso/{solicitacao.id}/executar-cancelamento/"
    )

    solicitacao.refresh_from_db()
    pagamento.refresh_from_db()
    pedido.refresh_from_db()

    assert response.status_code == 200, response.data
    assert cancel_calls == [
        (
            "pi_cancelar",
            {
                "cancellation_reason": "requested_by_customer",
                "idempotency_key": f"solicitacao_reembolso_{solicitacao.id}_cancelamento",
            },
        )
    ]
    assert solicitacao.status == SolicitacaoReembolsoStatus.CONCLUIDA
    assert solicitacao.stripe_payment_intent_id == "pi_cancelar"
    assert solicitacao.stripe_status == "canceled"
    assert solicitacao.stripe_idempotency_key == f"solicitacao_reembolso_{solicitacao.id}_cancelamento"
    assert solicitacao.stripe_erro == ""
    assert solicitacao.execucao_financeira_iniciada_em is not None
    assert solicitacao.execucao_financeira_concluida_em is not None
    assert pagamento.status == PagamentoStatus.CANCELADO
    assert pedido.status == PedidoStatus.ACEITO


@pytest.mark.django_db
def test_executar_cancelamento_concluido_nao_executa_duas_vezes(monkeypatch):
    pedido, pagamento, cliente_user, _ = _create_pedido_com_pagamento(
        stripe_payment_intent_id="pi_cancelar_uma_vez"
    )
    solicitacao = _registrar_ausencia(pedido, cliente_user)
    solicitacao, admin_user = _aprovar_solicitacao(solicitacao)
    cancel_calls = []

    def fake_retrieve(intent_id):
        return DummyIntent(intent_id=intent_id, status="requires_capture")

    def fake_cancel(intent_id, **kwargs):
        cancel_calls.append((intent_id, kwargs))
        return DummyIntent(intent_id=intent_id, status="canceled")

    monkeypatch.setattr(reembolso_service.stripe.PaymentIntent, "retrieve", fake_retrieve)
    monkeypatch.setattr(reembolso_service.stripe.PaymentIntent, "cancel", fake_cancel)

    client = APIClient()
    client.force_authenticate(user=admin_user)

    first_response = client.post(
        f"/api/v1/solicitacoes-reembolso/{solicitacao.id}/executar-cancelamento/"
    )
    second_response = client.post(
        f"/api/v1/solicitacoes-reembolso/{solicitacao.id}/executar-cancelamento/"
    )

    solicitacao.refresh_from_db()
    pagamento.refresh_from_db()

    assert first_response.status_code == 200, first_response.data
    assert second_response.status_code == 400
    assert len(cancel_calls) == 1
    assert solicitacao.status == SolicitacaoReembolsoStatus.CONCLUIDA
    assert pagamento.status == PagamentoStatus.CANCELADO
    assert reembolso_service.existe_solicitacao_ativa_para_pedido(pedido.id) is False


@pytest.mark.django_db
def test_executar_cancelamento_sincroniza_payment_intent_ja_cancelado(monkeypatch):
    pedido, pagamento, cliente_user, _ = _create_pedido_com_pagamento(
        stripe_payment_intent_id="pi_ja_cancelado"
    )
    solicitacao = _registrar_ausencia(pedido, cliente_user)
    solicitacao, admin_user = _aprovar_solicitacao(solicitacao)

    def fake_retrieve(intent_id):
        return DummyIntent(intent_id=intent_id, status="canceled")

    def fail_cancel(*_args, **_kwargs):
        raise AssertionError("Nao deve cancelar PaymentIntent ja cancelado")

    monkeypatch.setattr(reembolso_service.stripe.PaymentIntent, "retrieve", fake_retrieve)
    monkeypatch.setattr(reembolso_service.stripe.PaymentIntent, "cancel", fail_cancel)

    client = APIClient()
    client.force_authenticate(user=admin_user)

    response = client.post(
        f"/api/v1/solicitacoes-reembolso/{solicitacao.id}/executar-cancelamento/"
    )

    solicitacao.refresh_from_db()
    pagamento.refresh_from_db()

    assert response.status_code == 200, response.data
    assert solicitacao.status == SolicitacaoReembolsoStatus.CONCLUIDA
    assert solicitacao.stripe_status == "canceled"
    assert pagamento.status == PagamentoStatus.CANCELADO


@pytest.mark.django_db
def test_executar_cancelamento_nao_cancela_payment_intent_succeeded(monkeypatch):
    pedido, pagamento, cliente_user, _ = _create_pedido_com_pagamento(
        stripe_payment_intent_id="pi_capturado"
    )
    solicitacao = _registrar_ausencia(pedido, cliente_user)
    solicitacao, admin_user = _aprovar_solicitacao(solicitacao)

    def fake_retrieve(intent_id):
        return DummyIntent(intent_id=intent_id, status="succeeded")

    def fail_cancel(*_args, **_kwargs):
        raise AssertionError("Nao deve cancelar PaymentIntent ja capturado")

    monkeypatch.setattr(reembolso_service.stripe.PaymentIntent, "retrieve", fake_retrieve)
    monkeypatch.setattr(reembolso_service.stripe.PaymentIntent, "cancel", fail_cancel)

    client = APIClient()
    client.force_authenticate(user=admin_user)

    response = client.post(
        f"/api/v1/solicitacoes-reembolso/{solicitacao.id}/executar-cancelamento/"
    )

    solicitacao.refresh_from_db()
    pagamento.refresh_from_db()

    assert response.status_code == 200, response.data
    assert solicitacao.status == SolicitacaoReembolsoStatus.APROVADA
    assert solicitacao.tipo == SolicitacaoReembolsoTipo.REEMBOLSO_CAPTURADO
    assert solicitacao.stripe_status == "succeeded"
    assert "Etapa 6C" in solicitacao.stripe_erro
    assert solicitacao.execucao_financeira_concluida_em is None
    assert pagamento.status == PagamentoStatus.PENDENTE


@pytest.mark.django_db
def test_executar_cancelamento_falha_stripe_marca_solicitacao_falhou(monkeypatch):
    pedido, pagamento, cliente_user, _ = _create_pedido_com_pagamento(
        stripe_payment_intent_id="pi_falha_cancelamento"
    )
    solicitacao = _registrar_ausencia(pedido, cliente_user)
    solicitacao, admin_user = _aprovar_solicitacao(solicitacao)

    def fake_retrieve(intent_id):
        return DummyIntent(intent_id=intent_id, status="requires_capture")

    def fake_cancel(*_args, **_kwargs):
        raise RuntimeError("Stripe indisponivel")

    monkeypatch.setattr(reembolso_service.stripe.PaymentIntent, "retrieve", fake_retrieve)
    monkeypatch.setattr(reembolso_service.stripe.PaymentIntent, "cancel", fake_cancel)

    client = APIClient()
    client.force_authenticate(user=admin_user)

    response = client.post(
        f"/api/v1/solicitacoes-reembolso/{solicitacao.id}/executar-cancelamento/"
    )

    solicitacao.refresh_from_db()
    pagamento.refresh_from_db()

    assert response.status_code == 400, response.data
    assert solicitacao.status == SolicitacaoReembolsoStatus.FALHOU
    assert solicitacao.stripe_status == "requires_capture"
    assert solicitacao.stripe_payment_intent_id == "pi_falha_cancelamento"
    assert "Stripe indisponivel" in solicitacao.stripe_erro
    assert solicitacao.execucao_financeira_iniciada_em is not None
    assert solicitacao.execucao_financeira_concluida_em is not None
    assert pagamento.status == PagamentoStatus.PENDENTE


@pytest.mark.django_db
def test_retry_de_cancelamento_usa_mesma_idempotency_key(monkeypatch):
    pedido, pagamento, cliente_user, _ = _create_pedido_com_pagamento(
        stripe_payment_intent_id="pi_retry_cancelamento"
    )
    solicitacao = _registrar_ausencia(pedido, cliente_user)
    solicitacao, admin_user = _aprovar_solicitacao(solicitacao)
    cancel_calls = []

    def fake_retrieve(intent_id):
        return DummyIntent(intent_id=intent_id, status="requires_capture")

    def flaky_cancel(intent_id, **kwargs):
        cancel_calls.append((intent_id, kwargs))
        if len(cancel_calls) == 1:
            raise RuntimeError("falha temporaria")
        return DummyIntent(intent_id=intent_id, status="canceled")

    monkeypatch.setattr(reembolso_service.stripe.PaymentIntent, "retrieve", fake_retrieve)
    monkeypatch.setattr(reembolso_service.stripe.PaymentIntent, "cancel", flaky_cancel)

    client = APIClient()
    client.force_authenticate(user=admin_user)

    first_response = client.post(
        f"/api/v1/solicitacoes-reembolso/{solicitacao.id}/executar-cancelamento/"
    )
    solicitacao.refresh_from_db()
    key_after_failure = solicitacao.stripe_idempotency_key

    reapprove_response = client.post(
        f"/api/v1/solicitacoes-reembolso/{solicitacao.id}/aprovar/",
        data={"decisao_admin": "Retentar cancelamento aprovado."},
        format="json",
    )
    second_response = client.post(
        f"/api/v1/solicitacoes-reembolso/{solicitacao.id}/executar-cancelamento/"
    )

    solicitacao.refresh_from_db()
    pagamento.refresh_from_db()

    assert first_response.status_code == 400, first_response.data
    assert reapprove_response.status_code == 200, reapprove_response.data
    assert second_response.status_code == 200, second_response.data
    assert len(cancel_calls) == 2
    assert cancel_calls[0][1]["idempotency_key"] == key_after_failure
    assert cancel_calls[1][1]["idempotency_key"] == key_after_failure
    assert solicitacao.stripe_idempotency_key == key_after_failure
    assert solicitacao.status == SolicitacaoReembolsoStatus.CONCLUIDA
    assert pagamento.status == PagamentoStatus.CANCELADO


@pytest.mark.django_db
def test_executar_cancelamento_rejeita_status_ou_tipo_invalidos(monkeypatch):
    pedido, _, cliente_user, _ = _create_pedido_com_pagamento()
    solicitacao = _registrar_ausencia(pedido, cliente_user)
    admin_user = _create_admin_user()

    def fail_retrieve(*_args, **_kwargs):
        raise AssertionError("Nao deve consultar Stripe para solicitacao invalida")

    monkeypatch.setattr(reembolso_service.stripe.PaymentIntent, "retrieve", fail_retrieve)

    client = APIClient()
    client.force_authenticate(user=admin_user)

    response_aberta = client.post(
        f"/api/v1/solicitacoes-reembolso/{solicitacao.id}/executar-cancelamento/"
    )

    solicitacao.status = SolicitacaoReembolsoStatus.APROVADA
    solicitacao.tipo = SolicitacaoReembolsoTipo.REEMBOLSO_CAPTURADO
    solicitacao.save(update_fields=["status", "tipo"])

    response_tipo = client.post(
        f"/api/v1/solicitacoes-reembolso/{solicitacao.id}/executar-cancelamento/"
    )

    assert response_aberta.status_code == 400
    assert response_tipo.status_code == 400


@pytest.mark.django_db
def test_nao_admin_nao_executa_cancelamento_aprovado(monkeypatch):
    pedido, _, cliente_user, _ = _create_pedido_com_pagamento()
    solicitacao = _registrar_ausencia(pedido, cliente_user)
    _aprovar_solicitacao(solicitacao)

    def fail_retrieve(*_args, **_kwargs):
        raise AssertionError("Nao deve consultar Stripe sem permissao admin")

    monkeypatch.setattr(reembolso_service.stripe.PaymentIntent, "retrieve", fail_retrieve)

    client = APIClient()
    client.force_authenticate(user=cliente_user)

    response = client.post(
        f"/api/v1/solicitacoes-reembolso/{solicitacao.id}/executar-cancelamento/"
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_aprovar_e_negar_nao_executam_acao_financeira_stripe(monkeypatch):
    pedido_aprovar, _, cliente_user_aprovar, _ = _create_pedido_com_pagamento(
        stripe_payment_intent_id="pi_sem_acao_aprovar"
    )
    solicitacao_aprovar = _registrar_ausencia(pedido_aprovar, cliente_user_aprovar)
    pedido_negar, _, cliente_user_negar, _ = _create_pedido_com_pagamento(
        stripe_payment_intent_id="pi_sem_acao_negar"
    )
    solicitacao_negar = _registrar_ausencia(pedido_negar, cliente_user_negar)
    admin_user = User.objects.create_user(
        email=f"admin+{uuid4().hex}@example.com",
        password="pass",
        tipo=TipoUsuario.CLIENTE,
        is_staff=True,
    )

    def fail_stripe_action(*_args, **_kwargs):
        raise AssertionError("Etapa 6A nao deve executar acao financeira Stripe")

    monkeypatch.setattr(stripe_service.stripe.PaymentIntent, "capture", fail_stripe_action)
    monkeypatch.setattr(stripe_service.stripe.PaymentIntent, "cancel", fail_stripe_action, raising=False)
    if hasattr(stripe_service.stripe, "Refund"):
        monkeypatch.setattr(stripe_service.stripe.Refund, "create", fail_stripe_action, raising=False)

    client = APIClient()
    client.force_authenticate(user=admin_user)

    approve_response = client.post(
        f"/api/v1/solicitacoes-reembolso/{solicitacao_aprovar.id}/aprovar/",
        data={"decisao_admin": "Aprovado sem executar Stripe."},
        format="json",
    )
    deny_response = client.post(
        f"/api/v1/solicitacoes-reembolso/{solicitacao_negar.id}/negar/",
        data={"decisao_admin": "Negado sem executar Stripe."},
        format="json",
    )

    assert approve_response.status_code == 200, approve_response.data
    assert deny_response.status_code == 200, deny_response.data


@pytest.mark.django_db
def test_nao_admin_nao_aprova_ou_nega_solicitacao():
    pedido, _, cliente_user, _ = _create_pedido_com_pagamento()
    solicitacao = _registrar_ausencia(pedido, cliente_user)

    client = APIClient()
    client.force_authenticate(user=cliente_user)

    approve_response = client.post(
        f"/api/v1/solicitacoes-reembolso/{solicitacao.id}/aprovar/",
        data={"decisao_admin": "Tentativa invalida."},
        format="json",
    )
    deny_response = client.post(
        f"/api/v1/solicitacoes-reembolso/{solicitacao.id}/negar/",
        data={"decisao_admin": "Tentativa invalida."},
        format="json",
    )

    solicitacao.refresh_from_db()

    assert approve_response.status_code == 403
    assert deny_response.status_code == 403
    assert solicitacao.status == SolicitacaoReembolsoStatus.ABERTA


@pytest.mark.django_db
def test_admin_nega_solicitacao():
    pedido, _, cliente_user, _ = _create_pedido_com_pagamento()
    solicitacao = _registrar_ausencia(pedido, cliente_user)
    admin_user = User.objects.create_user(
        email=f"admin+{uuid4().hex}@example.com",
        password="pass",
        tipo=TipoUsuario.CLIENTE,
        is_staff=True,
    )

    client = APIClient()
    client.force_authenticate(user=admin_user)

    response = client.post(
        f"/api/v1/solicitacoes-reembolso/{solicitacao.id}/negar/",
        data={"decisao_admin": "Comprovante do bartender aceito."},
        format="json",
    )

    solicitacao.refresh_from_db()

    assert response.status_code == 200, response.data
    assert solicitacao.status == SolicitacaoReembolsoStatus.NEGADA
    assert solicitacao.valor_aprovado is None
    assert solicitacao.decisao_admin == "Comprovante do bartender aceito."

    client.force_authenticate(user=cliente_user)
    detail_response = client.get(f"/api/v1/pedidos/{pedido.id}/solicitacao-reembolso/")

    assert detail_response.status_code == 200, detail_response.data
    assert detail_response.data["status"] == SolicitacaoReembolsoStatus.NEGADA


@pytest.mark.django_db
def test_cliente_nao_lista_solicitacoes():
    pedido, _, cliente_user, _ = _create_pedido_com_pagamento()
    _registrar_ausencia(pedido, cliente_user)

    client = APIClient()
    client.force_authenticate(user=cliente_user)

    response = client.get("/api/v1/solicitacoes-reembolso/")

    assert response.status_code == 403


@pytest.mark.django_db
def test_constraint_impede_duas_solicitacoes_ativas_por_pedido():
    pedido, _, cliente_user, _ = _create_pedido_com_pagamento()
    _registrar_ausencia(pedido, cliente_user)

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            SolicitacaoReembolso.objects.create(
                pedido=pedido,
                pagamento=pedido.pagamento,
                cliente=pedido.cliente,
                bartender=pedido.bartender,
                tipo=SolicitacaoReembolsoTipo.CANCELAMENTO_AUTORIZACAO,
                motivo=SolicitacaoReembolsoMotivo.AUSENCIA_BARTENDER,
                status=SolicitacaoReembolsoStatus.ABERTA,
                valor_solicitado=Decimal("250.00"),
            )
