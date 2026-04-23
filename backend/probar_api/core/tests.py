import datetime
from decimal import Decimal

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from core.models import (
	User,
	Cliente,
	Bartender,
	Evento,
	Pedido,
	Proposta,
	Chat,
	Mensagem,
)
from core.enums import TipoUsuario, PropostaStatus, PedidoStatus, MensagemTipo


@pytest.mark.django_db
def test_negotiation_flow_atomic_create_counter_accept():
	# criar usuários
	cliente_user = User.objects.create_user(email='cliente@example.com', password='pass', tipo=TipoUsuario.CLIENTE)
	bartender_user = User.objects.create_user(email='bartender@example.com', password='pass', tipo=TipoUsuario.BARTENDER)

	# perfis
	cliente = Cliente.objects.create(user=cliente_user)
	bartender = Bartender.objects.create(user=bartender_user, valor_hora=Decimal('100.00'))

	# evento do cliente
	evento = Evento.objects.create(
		cliente=cliente,
		nome='Festa Teste',
		data=datetime.date.today(),
		hora_inicio=datetime.time(20, 0),
		hora_fim=datetime.time(23, 0),
		quantidade_convidados=20,
	)

	client = APIClient()
	client.force_authenticate(user=cliente_user)

	# criar pedido (cria também proposta inicial e chat)
	url_pedidos = '/api/v1/pedidos/'
	resp = client.post(url_pedidos, data={
		'bartender': bartender.id,
		'evento': evento.id,
		'horas': 3,
	}, format='json')

	assert resp.status_code == 201, resp.data
	pedido_id = resp.data['id']

	pedido = Pedido.objects.get(pk=pedido_id)
	assert pedido.propostas.count() == 1
	proposta_inicial = pedido.propostas.first()
	assert proposta_inicial.remetente == cliente_user
	assert Chat.objects.filter(pedido=pedido).exists()

	# bartender cria contraproposta
	api_bartender = APIClient()
	api_bartender.force_authenticate(user=bartender_user)

	counter_url = f'/api/v1/propostas/{proposta_inicial.id}/counter/'
	resp2 = api_bartender.post(counter_url, data={'horas': 4, 'valor_adicional': '20.00'}, format='json')
	assert resp2.status_code == 201, resp2.data

	nova_proposta_id = resp2.data['id']
	nova = Proposta.objects.get(pk=nova_proposta_id)
	proposta_inicial.refresh_from_db()
	assert proposta_inicial.status == PropostaStatus.SUBSTITUIDA
	assert nova.horas == 4

	# cliente aceita a nova proposta
	resp3 = client.post(f'/api/v1/propostas/{nova.id}/accept/')
	assert resp3.status_code == 200, resp3.data

	pedido.refresh_from_db()
	assert pedido.status == PedidoStatus.ACEITO
	assert pedido.proposta_aprovada.id == nova.id
	assert pedido.valor_hora_aprovado == bartender.valor_hora
	assert pedido.horas_aprovadas == nova.horas
	# valor_total_aprovado deve bater com a proposta (Decimal)
	assert pedido.valor_total_aprovado == nova.valor_total

	# verificar mensagem de sistema no chat
	msgs = Mensagem.objects.filter(chat__pedido=pedido, tipo=MensagemTipo.STATUS_UPDATE)
	assert msgs.exists()
	last = msgs.last()
	assert int(last.payload.get('proposta_id')) == nova.id
