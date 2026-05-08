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


class PedidoStatus(models.TextChoices):
    EM_NEGOCIACAO = 'EM_NEGOCIACAO', 'Em negociação'
    ACEITO = 'ACEITO', 'Aceito'
    RECUSADO = 'RECUSADO', 'Recusado'
    CANCELADO = 'CANCELADO', 'Cancelado'
    PAGO = 'PAGO', 'Pago'
    CONCLUIDO = 'CONCLUIDO', 'Concluído'


class PropostaStatus(models.TextChoices):
    PENDENTE = 'PENDENTE', 'Pendente'
    ACEITA = 'ACEITA', 'Aceita'
    RECUSADA = 'RECUSADA', 'Recusada'
    CANCELADA = 'CANCELADA', 'Cancelada'
    SUBSTITUIDA = 'SUBSTITUIDA', 'Substituída'


class PropostaTipo(models.TextChoices):
    INICIAL = 'inicial', 'Inicial'
    ADICIONAL = 'adicional', 'Adicional'
    DESCONTO = 'desconto', 'Desconto'


class MensagemTipo(models.TextChoices):
    TEXTO = 'texto', 'Texto'
    CARD_EVENTO = 'card_evento', 'Card de Evento'
    CARD_PROPOSTA = 'card_proposta', 'Card de Proposta'
    STATUS_UPDATE = 'status_update', 'Atualização de Status'


class PagamentoMetodo(models.TextChoices):
    STRIPE = 'STRIPE', 'Stripe'


class PagamentoStatus(models.TextChoices):
    PENDENTE = 'PENDENTE', 'Pendente'
    PAGO = 'PAGO', 'Pago'
    CANCELADO = 'CANCELADO', 'Cancelado'