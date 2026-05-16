import datetime
from decimal import Decimal
from uuid import uuid4

import pytest
from django.core.exceptions import ValidationError
from rest_framework.test import APIClient

from core.enums import MensagemTipo, PedidoStatus, PropostaStatus, TipoUsuario
from core.models import Bartender, Chat, Cliente, Evento, Mensagem, Pedido, Proposta, User


def _criar_pedido_com_proposta_inicial():
    cliente_user = User.objects.create_user(email=f'cliente+{uuid4().hex}@example.com', password='pass', tipo=TipoUsuario.CLIENTE)
    bartender_user = User.objects.create_user(email=f'bartender+{uuid4().hex}@example.com', password='pass', tipo=TipoUsuario.BARTENDER)

    cliente, _ = Cliente.objects.get_or_create(user=cliente_user)
    bartender, _ = Bartender.objects.get_or_create(user=bartender_user)
    bartender.valor_hora = Decimal('100.00')
    bartender.save()

    evento = Evento.objects.create(
        cliente=cliente,
        nome='Evento negociacao',
        data=datetime.date.today(),
        hora_inicio=datetime.time(18, 0),
        hora_fim=datetime.time(22, 0),
        quantidade_convidados=30,
    )

    api_cliente = APIClient()
    api_cliente.force_authenticate(user=cliente_user)
    api_bartender = APIClient()
    api_bartender.force_authenticate(user=bartender_user)

    response = api_cliente.post(
        '/api/v1/pedidos/',
        data={'bartender': bartender.user.id, 'evento': evento.id, 'horas': 2},
        format='json',
    )
    assert response.status_code == 201, response.data

    pedido = Pedido.objects.get(pk=response.data['id'])
    proposta = pedido.propostas.first()
    return pedido, proposta, api_cliente, api_bartender


@pytest.mark.django_db
def test_pedido_criado_com_mensagens_iniciais_do_chat():
    cliente_user = User.objects.create_user(email=f'cliente+{uuid4().hex}@example.com', password='pass', tipo=TipoUsuario.CLIENTE)
    bartender_user = User.objects.create_user(email=f'bartender+{uuid4().hex}@example.com', password='pass', tipo=TipoUsuario.BARTENDER)

    cliente, _ = Cliente.objects.get_or_create(user=cliente_user)
    bartender, _ = Bartender.objects.get_or_create(user=bartender_user)
    bartender.valor_hora = Decimal('100.00')
    bartender.save()

    evento = Evento.objects.create(
        cliente=cliente,
        nome='Evento com mensagens',
        data=datetime.date.today(),
        hora_inicio=datetime.time(18, 0),
        hora_fim=datetime.time(22, 0),
        quantidade_convidados=30,
    )

    client = APIClient()
    client.force_authenticate(user=cliente_user)

    resp = client.post('/api/v1/pedidos/', data={'bartender': bartender.user.id, 'evento': evento.id, 'horas': 2}, format='json')
    assert resp.status_code == 201, resp.data

    pedido = Pedido.objects.get(pk=resp.data['id'])
    chat = Chat.objects.get(pedido=pedido)
    mensagens = list(Mensagem.objects.filter(chat=chat).order_by('criado_em'))

    assert len(mensagens) == 3
    assert mensagens[0].tipo == MensagemTipo.STATUS_UPDATE
    assert mensagens[1].tipo == MensagemTipo.CARD_EVENTO
    assert mensagens[2].tipo == MensagemTipo.CARD_PROPOSTA
    assert mensagens[0].payload['evento_id'] == evento.id
    assert mensagens[2].payload['pedido_id'] == pedido.id


@pytest.mark.django_db
def test_numero_bartender_e_sequencial_por_bartender_na_api():
    cliente_user = User.objects.create_user(email=f'cliente+{uuid4().hex}@example.com', password='pass', tipo=TipoUsuario.CLIENTE)
    bartender_user_a = User.objects.create_user(email=f'bartender-a+{uuid4().hex}@example.com', password='pass', tipo=TipoUsuario.BARTENDER)
    bartender_user_b = User.objects.create_user(email=f'bartender-b+{uuid4().hex}@example.com', password='pass', tipo=TipoUsuario.BARTENDER)

    cliente, _ = Cliente.objects.get_or_create(user=cliente_user)
    bartender_a, _ = Bartender.objects.get_or_create(user=bartender_user_a)
    bartender_b, _ = Bartender.objects.get_or_create(user=bartender_user_b)
    bartender_a.valor_hora = Decimal('100.00')
    bartender_b.valor_hora = Decimal('120.00')
    bartender_a.save()
    bartender_b.save()

    evento = Evento.objects.create(
        cliente=cliente,
        nome='Evento numeracao',
        data=datetime.date.today(),
        hora_inicio=datetime.time(18, 0),
        hora_fim=datetime.time(22, 0),
        quantidade_convidados=30,
    )

    api_cliente = APIClient()
    api_cliente.force_authenticate(user=cliente_user)

    response_a1 = api_cliente.post('/api/v1/pedidos/', data={'bartender': bartender_a.user.id, 'evento': evento.id, 'horas': 2}, format='json')
    response_a2 = api_cliente.post('/api/v1/pedidos/', data={'bartender': bartender_a.user.id, 'evento': evento.id, 'horas': 3}, format='json')
    response_b1 = api_cliente.post('/api/v1/pedidos/', data={'bartender': bartender_b.user.id, 'evento': evento.id, 'horas': 2}, format='json')

    assert response_a1.status_code == 201, response_a1.data
    assert response_a2.status_code == 201, response_a2.data
    assert response_b1.status_code == 201, response_b1.data
    assert response_a1.data['numero_bartender'] == 1
    assert response_a2.data['numero_bartender'] == 2
    assert response_b1.data['numero_bartender'] == 1


@pytest.mark.django_db
def test_reject_encerrra_negociacao_e_cria_mensagem():
    cliente_user = User.objects.create_user(email=f'cliente+{uuid4().hex}@example.com', password='pass', tipo=TipoUsuario.CLIENTE)
    bartender_user = User.objects.create_user(email=f'bartender+{uuid4().hex}@example.com', password='pass', tipo=TipoUsuario.BARTENDER)

    cliente, _ = Cliente.objects.get_or_create(user=cliente_user)
    bartender, _ = Bartender.objects.get_or_create(user=bartender_user)
    bartender.valor_hora = Decimal('100.00')
    bartender.save()

    evento = Evento.objects.create(
        cliente=cliente,
        nome='Evento recusa',
        data=datetime.date.today(),
        hora_inicio=datetime.time(18, 0),
        hora_fim=datetime.time(22, 0),
        quantidade_convidados=30,
    )

    client = APIClient()
    client.force_authenticate(user=cliente_user)
    resp = client.post('/api/v1/pedidos/', data={'bartender': bartender.user.id, 'evento': evento.id, 'horas': 2}, format='json')
    assert resp.status_code == 201, resp.data

    pedido = Pedido.objects.get(pk=resp.data['id'])
    proposta = pedido.propostas.first()

    api_bartender = APIClient()
    api_bartender.force_authenticate(user=bartender_user)
    resp_reject = api_bartender.post(f'/api/v1/propostas/{proposta.id}/reject/')
    assert resp_reject.status_code == 200, resp_reject.data

    pedido.refresh_from_db()
    proposta.refresh_from_db()
    assert pedido.status == PedidoStatus.RECUSADO
    assert proposta.status == PropostaStatus.RECUSADA

    msg = Mensagem.objects.filter(chat__pedido=pedido, tipo=MensagemTipo.STATUS_UPDATE).order_by('-criado_em').first()
    assert msg is not None
    assert 'recusada' in msg.conteudo.lower()

    # após recusa, novas contrapropostas não devem ser aceitas
    resp_counter = api_bartender.post(f'/api/v1/propostas/{proposta.id}/counter/', data={'horas': 3, 'valor_adicional': '10.00'}, format='json')
    assert resp_counter.status_code == 400
    assert 'não está em negociação' in resp_counter.data['detail'].lower()


@pytest.mark.django_db
def test_cancel_only_by_author_when_pending():
    cliente_user = User.objects.create_user(email=f'cliente+{uuid4().hex}@example.com', password='pass', tipo=TipoUsuario.CLIENTE)
    bartender_user = User.objects.create_user(email=f'bartender+{uuid4().hex}@example.com', password='pass', tipo=TipoUsuario.BARTENDER)

    cliente, _ = Cliente.objects.get_or_create(user=cliente_user)
    bartender, _ = Bartender.objects.get_or_create(user=bartender_user)
    bartender.valor_hora = Decimal('100.00')
    bartender.save()

    evento = Evento.objects.create(
        cliente=cliente,
        nome='Evento cancelamento',
        data=datetime.date.today(),
        hora_inicio=datetime.time(18, 0),
        hora_fim=datetime.time(22, 0),
        quantidade_convidados=30,
    )

    client = APIClient()
    client.force_authenticate(user=cliente_user)
    resp = client.post('/api/v1/pedidos/', data={'bartender': bartender.user.id, 'evento': evento.id, 'horas': 2}, format='json')
    assert resp.status_code == 201, resp.data

    pedido = Pedido.objects.get(pk=resp.data['id'])
    proposta = pedido.propostas.first()

    resp_cancel = client.post(f'/api/v1/propostas/{proposta.id}/cancel/')
    assert resp_cancel.status_code == 200, resp_cancel.data

    proposta.refresh_from_db()
    assert proposta.status == PropostaStatus.CANCELADA


@pytest.mark.django_db
def test_remetente_nao_pode_aceitar_propria_proposta():
    pedido, proposta, api_cliente, _ = _criar_pedido_com_proposta_inicial()

    response = api_cliente.post(f'/api/v1/propostas/{proposta.id}/accept/')

    pedido.refresh_from_db()
    proposta.refresh_from_db()

    assert response.status_code == 403
    assert 'remetente nao pode aceitar' in response.data['detail'].lower()
    assert pedido.status == PedidoStatus.EM_NEGOCIACAO
    assert proposta.status == PropostaStatus.PENDENTE


@pytest.mark.django_db
def test_destinatario_pode_aceitar_proposta_pendente():
    pedido, proposta, _, api_bartender = _criar_pedido_com_proposta_inicial()

    response = api_bartender.post(f'/api/v1/propostas/{proposta.id}/accept/')

    pedido.refresh_from_db()
    proposta.refresh_from_db()

    assert response.status_code == 200, response.data
    assert pedido.status == PedidoStatus.ACEITO
    assert pedido.proposta_aprovada_id == proposta.id
    assert proposta.status == PropostaStatus.ACEITA


@pytest.mark.django_db
def test_nao_aceita_proposta_cancelada():
    pedido, proposta, api_cliente, api_bartender = _criar_pedido_com_proposta_inicial()

    cancel_response = api_cliente.post(f'/api/v1/propostas/{proposta.id}/cancel/')
    assert cancel_response.status_code == 200, cancel_response.data

    response = api_bartender.post(f'/api/v1/propostas/{proposta.id}/accept/')

    pedido.refresh_from_db()
    proposta.refresh_from_db()

    assert response.status_code == 400
    assert 'somente propostas pendentes' in response.data['detail'].lower()
    assert pedido.status == PedidoStatus.EM_NEGOCIACAO
    assert proposta.status == PropostaStatus.CANCELADA


@pytest.mark.django_db
def test_nao_aceita_proposta_substituida():
    pedido, proposta, _, api_bartender = _criar_pedido_com_proposta_inicial()

    counter_response = api_bartender.post(
        f'/api/v1/propostas/{proposta.id}/counter/',
        data={'horas': 3, 'valor_adicional': '10.00'},
        format='json',
    )
    assert counter_response.status_code == 201, counter_response.data

    response = api_bartender.post(f'/api/v1/propostas/{proposta.id}/accept/')

    pedido.refresh_from_db()
    proposta.refresh_from_db()

    assert response.status_code == 400
    assert 'somente propostas pendentes' in response.data['detail'].lower()
    assert pedido.status == PedidoStatus.EM_NEGOCIACAO
    assert proposta.status == PropostaStatus.SUBSTITUIDA


@pytest.mark.django_db
def test_nao_aceita_proposta_pendente_antiga():
    pedido, proposta, _, api_bartender = _criar_pedido_com_proposta_inicial()

    segunda_response = api_bartender.post(
        '/api/v1/propostas/',
        data={
            'pedido': pedido.id,
            'tipo': 'adicional',
            'horas': 3,
            'valor_adicional': '10.00',
            'desconto': '0.00',
        },
        format='json',
    )
    assert segunda_response.status_code == 201, segunda_response.data

    response = api_bartender.post(f'/api/v1/propostas/{proposta.id}/accept/')

    pedido.refresh_from_db()
    proposta.refresh_from_db()
    segunda = Proposta.objects.get(pk=segunda_response.data['id'])

    assert response.status_code == 400
    assert 'proposta vigente' in response.data['detail'].lower()
    assert pedido.status == PedidoStatus.EM_NEGOCIACAO
    assert proposta.status == PropostaStatus.PENDENTE
    assert segunda.status == PropostaStatus.PENDENTE


@pytest.mark.django_db
def test_proposta_mantem_snapshot_financeiro_apos_alterar_valor_hora_do_bartender():
    pedido, proposta, _, api_bartender = _criar_pedido_com_proposta_inicial()
    bartender = pedido.bartender

    assert proposta.valor_hora == Decimal('100.00')
    assert proposta.valor_total == Decimal('200.00')

    bartender.valor_hora = Decimal('300.00')
    bartender.save(update_fields=['valor_hora'])

    proposta.refresh_from_db()
    assert proposta.valor_hora == Decimal('100.00')
    assert proposta.valor_total == Decimal('200.00')

    response = api_bartender.post(f'/api/v1/propostas/{proposta.id}/accept/')
    assert response.status_code == 200, response.data

    pedido.refresh_from_db()
    assert pedido.valor_hora_aprovado == Decimal('100.00')
    assert pedido.valor_total_aprovado == Decimal('200.00')

    mensagem_proposta = Mensagem.objects.filter(
        chat__pedido=pedido,
        tipo=MensagemTipo.CARD_PROPOSTA,
        payload__proposta_id=proposta.id,
    ).first()
    assert mensagem_proposta.payload['valor_total'] == '200.00'


@pytest.mark.django_db
def test_campos_financeiros_da_proposta_sao_imutaveis_apos_criacao():
    _, proposta, _, _ = _criar_pedido_com_proposta_inicial()

    proposta.horas = 8

    with pytest.raises(ValidationError):
        proposta.save()


@pytest.mark.django_db
def test_api_nao_permite_alterar_campos_financeiros_da_proposta():
    _, proposta, api_cliente, _ = _criar_pedido_com_proposta_inicial()

    response = api_cliente.patch(
        f'/api/v1/propostas/{proposta.id}/',
        data={'horas': 8},
        format='json',
    )

    proposta.refresh_from_db()

    assert response.status_code == 400
    assert proposta.horas == 2
    assert proposta.valor_total == Decimal('200.00')
