import datetime
from decimal import Decimal
from uuid import uuid4

import pytest
from rest_framework.test import APIClient

from core.enums import MensagemTipo, PedidoStatus, PropostaStatus, TipoUsuario
from core.models import Bartender, Chat, Cliente, Evento, Mensagem, Pedido, Proposta, User


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
