from django.db import models

class TipoUsuario(models.TextChoices):
    CLIENTE = 'cliente', 'Cliente'
    BARTENDER = 'bartender', 'Bartender'


class Especialidade(models.TextChoices):
    SHOWMAN = 'showman', 'Showman'
    MIXOLOGISTA = 'mixologista', 'Mixologista'
    TRADICIONAL = 'tradicional', 'Tradicional'
    NIGHT_CLUB = 'night_club', 'Night Club'


class TipoTermo(models.TextChoices):
    CLIENTE = 'cliente', 'Termos para Clientes'
    BARTENDER = 'bartender', 'Termos para Bartenders'


class StatusEvento(models.TextChoices):
    EM_ANDAMENTO = 'em_andamento', 'Em Andamento'
    CONFIRMADO = 'confirmado', 'Confirmado'
    FINALIZADO = 'finalizado', 'Finalizado'
    CANCELADO = 'cancelado', 'Cancelado'