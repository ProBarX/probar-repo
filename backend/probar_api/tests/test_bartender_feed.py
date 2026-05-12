import datetime
from uuid import uuid4

import pytest
from rest_framework.test import APIClient

from core.enums import PedidoStatus, TipoUsuario
from core.models import Avaliacao, Bartender, Cliente, Evento, Pedido, User


def create_bartender_with_rating(nome, nota=None):
    user = User.objects.create_user(
        email=f"bartender+{uuid4().hex}@example.com",
        password="pass",
        name=nome,
        tipo=TipoUsuario.BARTENDER,
    )
    bartender, _ = Bartender.objects.get_or_create(user=user)
    bartender.valor_hora = "100.00"
    bartender.save(update_fields=["valor_hora"])

    if nota is not None:
        cliente_user = User.objects.create_user(
            email=f"cliente+{uuid4().hex}@example.com",
            password="pass",
            tipo=TipoUsuario.CLIENTE,
        )
        cliente, _ = Cliente.objects.get_or_create(user=cliente_user)
        evento = Evento.objects.create(
            cliente=cliente,
            nome=f"Evento {nome}",
            data=datetime.date.today(),
            hora_inicio=datetime.time(18, 0),
            hora_fim=datetime.time(22, 0),
            quantidade_convidados=30,
        )
        pedido = Pedido.objects.create(
            cliente=cliente,
            bartender=bartender,
            evento=evento,
            status=PedidoStatus.CONCLUIDO,
        )
        Avaliacao.objects.create(pedido=pedido, nota=nota)

    return bartender


@pytest.mark.django_db
def test_bartenders_feed_orders_by_highest_rating():
    low = create_bartender_with_rating("Media 3", 3)
    unrated = create_bartender_with_rating("Sem avaliacao")
    high = create_bartender_with_rating("Media 5", 5)

    response = APIClient().get("/api/v1/bartenders/")

    assert response.status_code == 200, response.data

    results = response.data["results"]
    ordered_ids = [item["user_id"] for item in results]

    assert ordered_ids.index(high.user_id) < ordered_ids.index(low.user_id)
    assert ordered_ids.index(low.user_id) < ordered_ids.index(unrated.user_id)
    assert results[ordered_ids.index(high.user_id)]["media_avaliacoes"] == 5.0
