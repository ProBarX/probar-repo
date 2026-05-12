from django.db import models
from django.utils import timezone
from core.managers import ActiveManager
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.utils.translation import gettext_lazy as _
from .managers import CustomUserManager
import uuid
import os
from django.core.exceptions import ValidationError
from core.enums import (
    TipoUsuario,
    Especialidade,
    TipoTermo,
    StatusEvento,
    PedidoStatus,
    PropostaStatus,
    PropostaTipo,
    MensagemTipo,
    PagamentoMetodo,
    PagamentoStatus,
)
from django.core.validators import MinValueValidator, MaxValueValidator
from decimal import Decimal


# Base para Soft Delete e controle de datas
class BaseModel(models.Model):
    criado_em = models.DateTimeField(auto_now_add=True)  # data de criação
    atualizado_em = models.DateTimeField(auto_now=True)  # data de atualização
    esta_deletado = models.BooleanField(default=False)   # soft delete
    deletado_em = models.DateTimeField(null=True, blank=True)

    objects = ActiveManager()       # só retorna registros ativos
    all_objects = models.Manager()  # retorna tudo (inclusive deletados)

    class Meta:
        abstract = True  # não cria tabela no banco

    def delete(self, using=None, keep_parents=False):
        """Soft delete: marca como deletado em vez de remover"""
        self.esta_deletado = True
        self.deletado_em = timezone.now()
        self.save()

    def restore(self):
        """Restaura um item deletado"""
        self.esta_deletado = False
        self.deletado_em = None
        self.save()


class User(BaseModel, AbstractBaseUser, PermissionsMixin):
    """Custom user model que usa email como identificador único."""
    
    name = models.CharField(_('nome'), max_length=100, blank=True)
    tipo = models.CharField(max_length=20, choices=TipoUsuario, default=TipoUsuario.CLIENTE)
    email = models.EmailField(_('email address'), unique=True)
    first_name = models.CharField(_('first name'), max_length=150, blank=True)
    last_name = models.CharField(_('last name'), max_length=150, blank=True)
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = CustomUserManager()
    all_objects = models.Manager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    class Meta:
        verbose_name = _('user')
        verbose_name_plural = _('users')

    def __str__(self):
        return self.email

def cliente_profile_path(instance, filename):
    ext = filename.split('.')[-1] 
    filename = f'{uuid.uuid4()}.{ext}'
    return os.path.join(
        'clientes',
        str(instance.user.id),  
        'foto_perfil',
        filename
    )

class Cliente(BaseModel):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='cliente',
        primary_key=True
    )
    
    data_nascimento = models.DateField(null=True, blank=True)

    foto_perfil = models.ImageField(
        upload_to=cliente_profile_path,
        null=True,
        blank=True
    )

    stripe_customer_id = models.CharField(max_length=255, blank=True, null=True)

    def __str__(self):
        return f"Cliente: {self.user.email}"
    

def bartender_profile_path(instance, filename):
    ext = filename.split('.')[-1]
    filename = f'{uuid.uuid4()}.{ext}'
    return os.path.join(
        'bartenders',
        str(instance.user.id),  
        'foto_perfil',
        filename
    )


class Bartender(BaseModel):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='bartender',
        primary_key=True
    )

    data_nascimento = models.DateField(null=True, blank=True)

    foto_perfil = models.ImageField(
        upload_to=bartender_profile_path,
        null=True,
        blank=True
    )

    anos_experiencia = models.PositiveIntegerField(
        null=True,
        blank=True
    )

    descricao_profissional = models.TextField(
        blank=True
    )

    valor_hora = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Valor cobrado por hora de serviço"
    )

    especialidades = models.CharField(
        max_length=50, choices=Especialidade.choices,
        blank=True
    )

    cep = models.CharField(max_length=9, blank=True)
    rua = models.CharField(max_length=255, blank=True)
    bairro = models.CharField(max_length=255, blank=True)
    numero = models.CharField(max_length=20, blank=True)

    stripe_account_id = models.CharField(max_length=255, blank=True, null=True)
    stripe_onboarding_completo = models.BooleanField(default=False)

    @property
    def media_avaliacoes(self):
        """Calcula a media a partir da tabela Avaliacao"""
        from django.db.models import Avg
        resultado = self.pedidos.filter(
            status=PedidoStatus.CONCLUIDO,
            avaliacao__isnull=False
        ).aggregate(media=Avg('avaliacao__nota'))
        return round(resultado['media'] or 0.0, 2)

    @property
    def total_avaliacoes(self):
        """Total de avaliacoes recebidas"""
        return Avaliacao.objects.filter(
            pedido__bartender=self,
            pedido__status=PedidoStatus.CONCLUIDO
        ).count()
    

def drink_image_path(instance, filename):
    ext = filename.split('.')[-1]
    filename = f'{uuid.uuid4()}.{ext}'

    return os.path.join(
        'bartenders',
        str(instance.bartender.user.id),  
        'drinks',
        filename
    )


class Drink(BaseModel):
    """Modelo para armazenar drinks disponíveis"""
    bartender = models.ForeignKey(
        'Bartender',
        on_delete=models.CASCADE,
        related_name='drinks'
    )
    nome = models.CharField(max_length=100)
    foto = models.ImageField(
        upload_to=drink_image_path,
        null=True,
        blank=True 
    )
    
    class Meta:
        verbose_name = "Drink"
        verbose_name_plural = "Drinks"

    def clean(self):
        if self.bartender:
            drinks_qs = self.bartender.drinks.all()

            if self.pk:
                drinks_qs = drinks_qs.exclude(pk=self.pk)

            if drinks_qs.count() >= 6:
                raise ValidationError(
                    _("Este bartender já possui o máximo de 6 drinks.")
                )
    
    def save(self, *args, **kwargs):
        # Garantir validações declaradas em clean()
        self.full_clean()
        super().save(*args, **kwargs)
    
    
    def __str__(self):
        return self.nome


class Termos(BaseModel):
    conteudo = models.TextField()
    versao = models.CharField(max_length=10)
    tipo = models.CharField(max_length=20, choices=TipoTermo.choices)
    esta_ativo = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Termo de Uso"
        verbose_name_plural = "Termos de Uso"

    def __str__(self):
        return f"v{self.versao} - {self.get_tipo_display()}"


class AceiteTermos(BaseModel):
    termo = models.ForeignKey(Termos, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    aceito_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Aceite de Termos"
        verbose_name_plural = "Aceites de Termos"
        unique_together = ('termo', 'user')

    def clean(self):
        if self.termo.tipo != self.user.tipo:
            raise ValidationError(_("O usuário não pode aceitar termos de uma função diferente da sua."))

    def save(self, *args, **kwargs):
        # Garantir validação antes de salvar
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user.email} aceitou v{self.termo.versao} ({self.termo.tipo})"


class Evento(BaseModel):
    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name='eventos')
    nome = models.CharField(max_length=255)
    data = models.DateField()
    hora_inicio = models.TimeField()
    hora_fim = models.TimeField()
    cep = models.CharField(max_length=9, blank=True)
    rua = models.CharField(max_length=255, blank=True)
    numero = models.CharField(max_length=20, blank=True)
    complemento = models.CharField(max_length=255, blank=True)
    quantidade_convidados = models.PositiveIntegerField()
    descricao_evento = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=StatusEvento.choices, default=StatusEvento.EM_ANDAMENTO)

    class Meta:
        verbose_name = "Evento"
        verbose_name_plural = "Eventos"

    def __str__(self):
        return f"Evento: {self.nome}"


class Pedido(BaseModel):
    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name='pedidos')
    bartender = models.ForeignKey(Bartender, on_delete=models.CASCADE, related_name='pedidos')
    evento = models.ForeignKey(Evento, on_delete=models.CASCADE, related_name='pedidos')
    status = models.CharField(max_length=20, choices=PedidoStatus.choices, default=PedidoStatus.EM_NEGOCIACAO)
    # referência para a proposta aprovada (snapshot imutável de aceite)
    proposta_aprovada = models.OneToOneField(
        'Proposta', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    valor_hora_aprovado = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    horas_aprovadas = models.PositiveIntegerField(null=True, blank=True)
    valor_total_aprovado = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    class Meta:
        verbose_name = 'Pedido'
        verbose_name_plural = 'Pedidos'

    def __str__(self):
        return f'Pedido #{self.pk} - {self.get_status_display()}'

    def create_initial_chat_messages(self, proposta):
        """Cria o conjunto inicial de mensagens do chat após o pedido ser criado."""
        chat, created_chat = Chat.objects.get_or_create(pedido=self)

        # Mensagem de status inicial do pedido
        Mensagem.objects.get_or_create(
            chat=chat,
            tipo=MensagemTipo.STATUS_UPDATE,
            defaults={
                'remetente': None,
                'conteudo': _('Pedido criado para o evento %(evento)s') % {'evento': self.evento.nome},
                'payload': {
                    'pedido_id': self.pk,
                    'evento_id': self.evento.pk,
                    'evento_nome': self.evento.nome,
                }
            }
        )

        # Card com dados do evento
        Mensagem.objects.get_or_create(
            chat=chat,
            tipo=MensagemTipo.CARD_EVENTO,
            defaults={
                'remetente': None,
                'conteudo': '',
                'payload': {
                    'evento_id': self.evento.pk,
                    'nome': self.evento.nome,
                    'data': self.evento.data.isoformat(),
                    'hora_inicio': self.evento.hora_inicio.strftime('%H:%M:%S'),
                    'hora_fim': self.evento.hora_fim.strftime('%H:%M:%S'),
                    'quantidade_convidados': self.evento.quantidade_convidados,
                    'descricao_evento': self.evento.descricao_evento,
                }
            }
        )

        # Card com a proposta inicial
        Mensagem.objects.get_or_create(
            chat=chat,
            tipo=MensagemTipo.CARD_PROPOSTA,
            defaults={
                'remetente': None,
                'conteudo': '',
                'payload': {
                    'proposta_id': proposta.pk,
                    'pedido_id': self.pk,
                    'remetente': proposta.remetente_id,
                    'tipo': proposta.tipo,
                    'horas': proposta.horas,
                    'valor_adicional': str(proposta.valor_adicional),
                    'desconto': str(proposta.desconto),
                    'valor_total': str(proposta.valor_total),
                    'status': proposta.status,
                }
            }
        )

        return chat


class Proposta(BaseModel):
    pedido = models.ForeignKey('Pedido', on_delete=models.CASCADE, related_name='propostas')
    remetente = models.ForeignKey(User, on_delete=models.CASCADE, related_name='propostas_enviadas')
    tipo = models.CharField(max_length=20, choices=PropostaTipo.choices)
    horas = models.PositiveIntegerField()
    valor_adicional = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    desconto = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    status = models.CharField(max_length=20, choices=PropostaStatus.choices, default=PropostaStatus.PENDENTE)

    class Meta:
        ordering = ['-criado_em']

    def chat_payload(self):
        return {
            'proposta_id': self.pk,
            'pedido_id': self.pedido_id,
            'remetente': self.remetente_id,
            'tipo': self.tipo,
            'horas': self.horas,
            'valor_adicional': str(self.valor_adicional),
            'desconto': str(self.desconto),
            'valor_total': str(self.valor_total),
            'status': self.status,
        }

    def create_chat_card_message(self):
        chat = Chat.objects.get_or_create(pedido=self.pedido)[0]
        Mensagem.objects.create(
            chat=chat,
            remetente=None,
            tipo=MensagemTipo.CARD_PROPOSTA,
            conteudo='',
            payload=self.chat_payload(),
        )

    def sync_chat_card_message(self):
        mensagens = Mensagem.objects.filter(
            chat__pedido=self.pedido,
            tipo=MensagemTipo.CARD_PROPOSTA,
        )

        for mensagem in mensagens:
            payload = mensagem.payload or {}
            if payload.get('proposta_id') != self.pk:
                continue

            payload.update(self.chat_payload())
            mensagem.payload = payload
            mensagem.save(update_fields=['payload'])

    def _is_participant(self, user):
        return user == self.pedido.cliente.user or user == self.pedido.bartender.user

    def accept(self, user):
        from django.db import transaction
        if not self._is_participant(user):
            raise PermissionError(_('Usuário sem permissão para aceitar esta proposta.'))

        with transaction.atomic():
            pedido = Pedido.objects.select_for_update().get(pk=self.pedido.pk)
            if pedido.status != PedidoStatus.EM_NEGOCIACAO:
                raise ValueError(_('Pedido não está em negociação.'))

            # marca esta proposta como aceita e atualiza o pedido com snapshot dos valores aprovados
            self.status = PropostaStatus.ACEITA
            self.save()
            self.sync_chat_card_message()

            pedido.proposta_aprovada = self
            pedido.status = PedidoStatus.ACEITO
            pedido.valor_hora_aprovado = pedido.bartender.valor_hora
            pedido.horas_aprovadas = self.horas
            pedido.valor_total_aprovado = self.valor_total
            pedido.save()

            # opcional: marcar outras propostas como substituídas
            from django.db.models import Q
            # marcar outras propostas pendentes como SUBSTITUIDA
            Proposta.objects.filter(pedido=pedido, status=PropostaStatus.PENDENTE).exclude(pk=self.pk).update(status=PropostaStatus.SUBSTITUIDA)
            # criar mensagem de sistema no chat para notificar sobre o aceite
            try:
                chat = Chat.objects.get(pedido=pedido)
            except Chat.DoesNotExist:
                chat = Chat.objects.create(pedido=pedido)

            Mensagem.objects.create(
                chat=chat,
                remetente=None,
                tipo=MensagemTipo.STATUS_UPDATE,
                conteudo=_('Proposta aceita! O pagamento foi liberado.'),
                payload={
                    'proposta_id': self.pk,
                    'pedido_id': pedido.pk,
                    'valor_total': str(self.valor_total),
                }
            )

            return self

    def reject(self, user):
        from django.db import transaction

        if not self._is_participant(user):
            raise PermissionError(_('Usuário sem permissão para recusar esta proposta.'))
        with transaction.atomic():
            pedido = Pedido.objects.select_for_update().get(pk=self.pedido.pk)
            if pedido.status != PedidoStatus.EM_NEGOCIACAO:
                raise ValueError(_('Pedido não está em negociação.'))

            self.status = PropostaStatus.RECUSADA
            self.save()
            self.sync_chat_card_message()

            pedido.status = PedidoStatus.RECUSADO
            pedido.save(update_fields=['status', 'atualizado_em'])

            Proposta.objects.filter(pedido=pedido, status=PropostaStatus.PENDENTE).exclude(pk=self.pk).update(
                status=PropostaStatus.CANCELADA
            )

            chat = Chat.objects.get_or_create(pedido=pedido)[0]
            Mensagem.objects.create(
                chat=chat,
                remetente=None,
                tipo=MensagemTipo.STATUS_UPDATE,
                conteudo=_('Proposta recusada. A negociação foi encerrada.'),
                payload={
                    'proposta_id': self.pk,
                    'pedido_id': pedido.pk,
                    'pedido_status': PedidoStatus.RECUSADO,
                }
            )
        return self

    def cancel(self, user):
        if user != self.remetente:
            raise PermissionError(_('Usuário sem permissão para cancelar esta proposta.'))
        if self.status != PropostaStatus.PENDENTE:
            raise ValueError(_('A proposta só pode ser cancelada enquanto estiver pendente.'))

        self.status = PropostaStatus.CANCELADA
        self.save()
        self.sync_chat_card_message()
        return self

    def counter(self, user, *, horas=None, valor_adicional=None, desconto=None):
        # cria uma contraproposta baseada nesta
        if not self._is_participant(user):
            raise PermissionError(_('Usuário sem permissão para criar contraproposta.'))

        if self.pedido.status != PedidoStatus.EM_NEGOCIACAO:
            raise ValueError(_('Pedido não está em negociação.'))

        tipo = PropostaTipo.INICIAL
        if valor_adicional and valor_adicional > 0:
            tipo = PropostaTipo.ADICIONAL
        elif desconto and desconto > 0:
            tipo = PropostaTipo.DESCONTO

        # Regras de papel: apenas o bartender pode criar contrapropostas do tipo adicional/desconto
        if tipo in (PropostaTipo.ADICIONAL, PropostaTipo.DESCONTO):
            bartender_user = self.pedido.bartender.user
            if user != bartender_user:
                raise PermissionError(_('Apenas o bartender pode criar contrapropostas de adicional/desconto.'))

        nova = Proposta.objects.create(
            pedido=self.pedido,
            remetente=user,
            tipo=tipo,
            horas=horas if horas is not None else self.horas,
            valor_adicional=valor_adicional if valor_adicional is not None else self.valor_adicional,
            desconto=desconto if desconto is not None else self.desconto,
            status=PropostaStatus.PENDENTE,
        )

        # marcar a proposta antiga como substituída
        self.status = PropostaStatus.SUBSTITUIDA
        self.save()
        self.sync_chat_card_message()
        nova.create_chat_card_message()
        return nova

    @property
    def valor_total(self):
        """Calcula o valor total da proposta"""
        # regra de negócio: calcular com base no valor_hora do bartender
        valor_hora = self.pedido.bartender.valor_hora or Decimal('0')
        # normalizar tipos para Decimal para evitar TypeError (Decimal + float)
        horas_dec = Decimal(self.horas)
        valor_adicional = Decimal(str(self.valor_adicional)) if self.valor_adicional is not None else Decimal('0')
        desconto = Decimal(str(self.desconto)) if self.desconto is not None else Decimal('0')

        return (horas_dec * valor_hora) + valor_adicional - desconto

    def __str__(self):
        return f'Proposta #{self.pk} ({self.get_status_display()})'


class Mensagem(BaseModel):
    chat = models.ForeignKey('Chat', on_delete=models.CASCADE, related_name='mensagens')
    remetente = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='mensagens')
    tipo = models.CharField(max_length=20, choices=MensagemTipo.choices)
    conteudo = models.TextField(blank=True)
    payload = models.JSONField(null=True, blank=True)

    class Meta:
        verbose_name = 'Mensagem'
        verbose_name_plural = 'Mensagens'
        ordering = ['criado_em']

    def __str__(self):
        remetente = self.remetente.email if self.remetente else "Sistema"
        return f'Mensagem #{self.pk} para Chat #{self.chat_id} por {remetente}'


class Chat(BaseModel):
    pedido = models.OneToOneField(Pedido, on_delete=models.CASCADE, related_name='chat')

    class Meta:
        verbose_name = 'Chat'
        verbose_name_plural = 'Chats'
        ordering = ['criado_em']

    def __str__(self):
        return f'Chat do Pedido #{self.pedido_id}'
    

class Avaliacao(BaseModel):
    pedido = models.OneToOneField(Pedido, on_delete=models.CASCADE, related_name='avaliacao')
    nota = models.PositiveIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comentario = models.TextField(blank=True)

    class Meta:
        verbose_name = 'Avaliação'
        verbose_name_plural = 'Avaliações'

    def __str__(self):
        return f'Avaliação #{self.pk} - Nota: {self.nota} para o Bartender: {self.pedido.bartender.user.name} - {self.pedido.bartender.user.email} - Pedido #{self.pedido.pk}'
    

class Pagamento(BaseModel):
    pedido = models.OneToOneField(Pedido, on_delete=models.CASCADE, related_name='pagamento')
    valor = models.DecimalField(max_digits=12, decimal_places=2)
    data_pagamento = models.DateTimeField(auto_now_add=True)
    metodo_pagamento = models.CharField(
        max_length=50,
        choices=PagamentoMetodo.choices,
        default=PagamentoMetodo.STRIPE,
    )
    status = models.CharField(max_length=20, choices=PagamentoStatus.choices, default=PagamentoStatus.PENDENTE)

    stripe_payment_intent_id = models.CharField(max_length=255, blank=True, null=True)
    stripe_setup_intent_id = models.CharField(max_length=255, blank=True, null=True)
    stripe_payment_method_id = models.CharField(max_length=255, blank=True, null=True)
    stripe_payment_method_type = models.CharField(max_length=50, blank=True, null=True)
    finalizado_pelo_cliente = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'Pagamento'
        verbose_name_plural = 'Pagamentos'

    def __str__(self):
        return f'Pagamento #{self.pk} - Pedido #{self.pedido_id} - Valor: {self.valor}'
