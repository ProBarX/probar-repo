from django.db import models
from django.utils import timezone
from core.managers import ActiveManager
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.utils.translation import gettext_lazy as _
from .managers import CustomUserManager
import uuid
import os
import hashlib
from datetime import datetime, timedelta
from django.core.exceptions import ValidationError
from core.enums import (
    TipoUsuario,
    Especialidade,
    TipoDocumentoLegal,
    StatusEvento,
    PedidoStatus,
    PresencaStatus,
    PresencaOrigem,
    PropostaStatus,
    PropostaTipo,
    MensagemTipo,
    PagamentoMetodo,
    PagamentoStatus,
    SolicitacaoReembolsoMotivo,
    SolicitacaoReembolsoStatus,
    SolicitacaoReembolsoTipo,
)
from django.core.validators import MinValueValidator, MaxValueValidator
from decimal import Decimal
from core.services.image_processing import (
    DRINK_IMAGE_SIZE,
    PROFILE_IMAGE_SIZE,
    normalize_uncommitted_image_field,
    should_process_image_field,
)


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

    def save(self, *args, **kwargs):
        if should_process_image_field(self, "foto_perfil", kwargs.get("update_fields")):
            normalize_uncommitted_image_field(
                self,
                "foto_perfil",
                size=PROFILE_IMAGE_SIZE,
                fit="cover",
            )

        super().save(*args, **kwargs)

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

    def save(self, *args, **kwargs):
        if should_process_image_field(self, "foto_perfil", kwargs.get("update_fields")):
            normalize_uncommitted_image_field(
                self,
                "foto_perfil",
                size=PROFILE_IMAGE_SIZE,
                fit="cover",
            )

        super().save(*args, **kwargs)

    @property
    def media_avaliacoes(self):
        """Calcula a media a partir da tabela Avaliacao"""
        if hasattr(self, 'media_avaliacoes_calc'):
            return round(self.media_avaliacoes_calc or 0.0, 2)

        from django.db.models import Avg
        resultado = self.pedidos.filter(
            status=PedidoStatus.CONCLUIDO,
            avaliacao__isnull=False
        ).aggregate(media=Avg('avaliacao__nota'))
        return round(resultado['media'] or 0.0, 2)

    @property
    def total_avaliacoes(self):
        """Total de avaliacoes recebidas"""
        if hasattr(self, 'total_avaliacoes_calc'):
            return self.total_avaliacoes_calc or 0

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
        if should_process_image_field(self, "foto", kwargs.get("update_fields")):
            normalize_uncommitted_image_field(
                self,
                "foto",
                size=DRINK_IMAGE_SIZE,
                fit="cover",
                trim_uniform_border=True,
            )
        super().save(*args, **kwargs)
    
    
    def __str__(self):
        return self.nome


class DocumentoLegal(BaseModel):
    titulo = models.CharField(max_length=120)
    conteudo = models.TextField()
    versao = models.CharField(max_length=20)
    tipo = models.CharField(max_length=30, choices=TipoDocumentoLegal.choices)
    esta_ativo = models.BooleanField(default=True)
    vigente_a_partir_de = models.DateTimeField(default=timezone.now)
    hash_conteudo = models.CharField(max_length=64, editable=False, blank=True)

    class Meta:
        verbose_name = "Documento Legal"
        verbose_name_plural = "Documentos Legais"
        constraints = [
            models.UniqueConstraint(
                fields=["tipo", "versao"],
                name="unique_documento_legal_tipo_versao",
            )
        ]
        ordering = ["tipo", "-vigente_a_partir_de", "-criado_em"]

    def atualizar_hash_conteudo(self):
        self.hash_conteudo = hashlib.sha256(self.conteudo.encode("utf-8")).hexdigest()

    def save(self, *args, **kwargs):
        self.atualizar_hash_conteudo()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.titulo} v{self.versao}"


class AceiteDocumentoLegal(BaseModel):
    documento = models.ForeignKey(DocumentoLegal, on_delete=models.PROTECT, related_name="aceites")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="aceites_documentos_legais")
    aceito_em = models.DateTimeField(auto_now_add=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    origem = models.CharField(max_length=30, default="cadastro")
    hash_conteudo_aceito = models.CharField(max_length=64, editable=False)

    class Meta:
        verbose_name = "Aceite de Documento Legal"
        verbose_name_plural = "Aceites de Documentos Legais"
        unique_together = ("documento", "user")
        ordering = ["-aceito_em"]

    def clean(self):
        if self.documento.tipo == TipoDocumentoLegal.TERMOS_CLIENTE and self.user.tipo != TipoUsuario.CLIENTE:
            raise ValidationError(_("O usuário não pode aceitar termos de cliente."))

        if self.documento.tipo == TipoDocumentoLegal.TERMOS_BARTENDER and self.user.tipo != TipoUsuario.BARTENDER:
            raise ValidationError(_("O usuário não pode aceitar termos de bartender."))

    def save(self, *args, **kwargs):
        self.hash_conteudo_aceito = self.documento.hash_conteudo
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user.email} aceitou {self.documento}"


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
    numero_bartender = models.PositiveIntegerField(editable=False)
    evento = models.ForeignKey(Evento, on_delete=models.CASCADE, related_name='pedidos')
    status = models.CharField(max_length=20, choices=PedidoStatus.choices, default=PedidoStatus.EM_NEGOCIACAO)
    # referência para a proposta aprovada (snapshot imutável de aceite)
    proposta_aprovada = models.OneToOneField(
        'Proposta', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    valor_hora_aprovado = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    horas_aprovadas = models.PositiveIntegerField(null=True, blank=True)
    valor_total_aprovado = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    presenca_status = models.CharField(max_length=20, choices=PresencaStatus.choices, default=PresencaStatus.PENDENTE)
    presenca_origem = models.CharField(max_length=20, choices=PresencaOrigem.choices, null=True, blank=True)
    presenca_registrada_em = models.DateTimeField(null=True, blank=True)
    presenca_registrada_por = models.ForeignKey(
        'User',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='presencas_registradas',
    )
    presenca_observacao = models.TextField(blank=True)

    class Meta:
        verbose_name = 'Pedido'
        verbose_name_plural = 'Pedidos'
        constraints = [
            models.UniqueConstraint(
                fields=['bartender', 'numero_bartender'],
                name='unique_pedido_numero_por_bartender',
            )
        ]

    def __str__(self):
        return f'Pedido #{self.numero_bartender} - {self.get_status_display()}'

    @staticmethod
    def _aware(dt):
        if timezone.is_aware(dt):
            return dt
        return timezone.make_aware(dt)

    def periodo_evento(self):
        inicio = datetime.combine(self.evento.data, self.evento.hora_inicio)
        fim = datetime.combine(self.evento.data, self.evento.hora_fim)

        if fim <= inicio:
            fim = fim + timedelta(days=1)

        return self._aware(inicio), self._aware(fim)

    @property
    def servico_inicio_previsto(self):
        inicio, _ = self.periodo_evento()
        return inicio

    @property
    def servico_fim_previsto(self):
        inicio, fim_evento = self.periodo_evento()
        if not self.horas_aprovadas:
            return fim_evento
        return inicio + timedelta(hours=int(self.horas_aprovadas))

    @property
    def liberacao_automatica_em(self):
        return self.servico_fim_previsto + timedelta(minutes=5)

    def save(self, *args, **kwargs):
        if self.numero_bartender is None and self.bartender_id:
            from django.db import transaction

            update_fields = kwargs.get('update_fields')
            if update_fields is not None:
                update_fields = set(update_fields)
                update_fields.add('numero_bartender')
                kwargs['update_fields'] = update_fields

            with transaction.atomic():
                Bartender.objects.select_for_update().get(pk=self.bartender_id)
                ultimo_numero = (
                    Pedido.all_objects
                    .filter(bartender_id=self.bartender_id)
                    .aggregate(maior=models.Max('numero_bartender'))['maior']
                    or 0
                )
                self.numero_bartender = ultimo_numero + 1
                return super().save(*args, **kwargs)

        return super().save(*args, **kwargs)

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
    valor_hora = models.DecimalField(max_digits=10, decimal_places=2, editable=False)
    horas = models.PositiveIntegerField()
    valor_adicional = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    desconto = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    valor_total_snapshot = models.DecimalField(max_digits=12, decimal_places=2, editable=False)
    status = models.CharField(max_length=20, choices=PropostaStatus.choices, default=PropostaStatus.PENDENTE)

    class Meta:
        ordering = ['-criado_em']

    FINANCIAL_SNAPSHOT_FIELDS = (
        'valor_hora',
        'horas',
        'valor_adicional',
        'desconto',
        'valor_total_snapshot',
    )

    @staticmethod
    def _to_decimal(value):
        if value is None:
            return Decimal('0')
        return Decimal(str(value))

    def _calcular_valor_total_snapshot(self):
        return (
            Decimal(self.horas or 0) * self._to_decimal(self.valor_hora)
            + self._to_decimal(self.valor_adicional)
            - self._to_decimal(self.desconto)
        ).quantize(Decimal('0.01'))

    def _set_initial_financial_snapshot(self):
        if self.valor_hora is None:
            self.valor_hora = self.pedido.bartender.valor_hora or Decimal('0')

        if self.valor_total_snapshot is None:
            self.valor_total_snapshot = self._calcular_valor_total_snapshot()

    def _validate_financial_snapshot_immutable(self):
        if not self.pk:
            return

        original = Proposta.all_objects.only(*self.FINANCIAL_SNAPSHOT_FIELDS).get(pk=self.pk)
        for field in self.FINANCIAL_SNAPSHOT_FIELDS:
            if getattr(original, field) != getattr(self, field):
                raise ValidationError(
                    _('Os valores financeiros da proposta nÃ£o podem ser alterados apÃ³s a criaÃ§Ã£o.')
                )

    def save(self, *args, **kwargs):
        if not self.pk:
            self._set_initial_financial_snapshot()
        else:
            self._validate_financial_snapshot_immutable()

        super().save(*args, **kwargs)

    def chat_payload(self):
        return {
            'proposta_id': self.pk,
            'pedido_id': self.pedido_id,
            'remetente': self.remetente_id,
            'tipo': self.tipo,
            'valor_hora': str(self.valor_hora),
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

    def _is_recipient(self, user):
        return self._is_participant(user) and user != self.remetente

    def _is_latest_proposal(self):
        latest = (
            Proposta.objects
            .filter(pedido=self.pedido)
            .order_by('-criado_em', '-id')
            .first()
        )
        return bool(latest and latest.pk == self.pk)

    def accept(self, user):
        from django.db import transaction
        if not self._is_participant(user):
            raise PermissionError(_('Usuário sem permissão para aceitar esta proposta.'))

        if not self._is_recipient(user):
            raise PermissionError(_('O remetente nao pode aceitar a propria proposta.'))

        if self.status != PropostaStatus.PENDENTE:
            raise ValueError(_('Somente propostas pendentes podem ser aceitas.'))

        if not self._is_latest_proposal():
            raise ValueError(_('Esta proposta nao e mais a proposta vigente do pedido.'))

        with transaction.atomic():
            pedido = Pedido.objects.select_for_update().get(pk=self.pedido.pk)
            if pedido.status != PedidoStatus.EM_NEGOCIACAO:
                raise ValueError(_('Pedido não está em negociação.'))

            proposta = (
                Proposta.objects
                .select_for_update()
                .get(pk=self.pk)
            )
            if proposta.status != PropostaStatus.PENDENTE:
                raise ValueError(_('Somente propostas pendentes podem ser aceitas.'))

            latest = (
                Proposta.objects
                .select_for_update()
                .filter(pedido=pedido)
                .order_by('-criado_em', '-id')
                .first()
            )
            if latest and latest.pk != proposta.pk:
                raise ValueError(_('Esta proposta nao e mais a proposta vigente do pedido.'))

            # marca esta proposta como aceita e atualiza o pedido com snapshot dos valores aprovados
            proposta.status = PropostaStatus.ACEITA
            proposta.save()
            proposta.sync_chat_card_message()

            pedido.proposta_aprovada = proposta
            pedido.status = PedidoStatus.ACEITO
            pedido.valor_hora_aprovado = proposta.valor_hora
            pedido.horas_aprovadas = proposta.horas
            pedido.valor_total_aprovado = proposta.valor_total
            pedido.save()

            # opcional: marcar outras propostas como substituídas
            # marcar outras propostas pendentes como SUBSTITUIDA
            Proposta.objects.filter(pedido=pedido, status=PropostaStatus.PENDENTE).exclude(pk=proposta.pk).update(status=PropostaStatus.SUBSTITUIDA)
            # criar mensagem de sistema no chat para notificar sobre o aceite
            try:
                chat = Chat.objects.get(pedido=pedido)
            except Chat.DoesNotExist:
                chat = Chat.objects.create(pedido=pedido)

            Mensagem.objects.create(
                chat=chat,
                remetente=None,
                tipo=MensagemTipo.STATUS_UPDATE,
                conteudo=_('Proposta aceita! Aguardando pagamento do cliente.'),
                payload={
                    'proposta_id': proposta.pk,
                    'pedido_id': pedido.pk,
                    'valor_total': str(proposta.valor_total),
                }
            )

            self.status = proposta.status
            return proposta

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
        if self.valor_total_snapshot is not None:
            return self.valor_total_snapshot

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


class SolicitacaoReembolso(BaseModel):
    STATUS_ATIVOS = [
        SolicitacaoReembolsoStatus.ABERTA,
        SolicitacaoReembolsoStatus.CONTESTADA,
        SolicitacaoReembolsoStatus.APROVADA,
        SolicitacaoReembolsoStatus.FALHOU,
    ]

    pedido = models.ForeignKey(
        Pedido,
        on_delete=models.PROTECT,
        related_name='solicitacoes_reembolso',
    )
    pagamento = models.ForeignKey(
        Pagamento,
        on_delete=models.PROTECT,
        related_name='solicitacoes_reembolso',
        null=True,
        blank=True,
    )
    cliente = models.ForeignKey(
        Cliente,
        on_delete=models.PROTECT,
        related_name='solicitacoes_reembolso',
    )
    bartender = models.ForeignKey(
        Bartender,
        on_delete=models.PROTECT,
        related_name='solicitacoes_reembolso',
    )
    tipo = models.CharField(
        max_length=40,
        choices=SolicitacaoReembolsoTipo.choices,
        default=SolicitacaoReembolsoTipo.CANCELAMENTO_AUTORIZACAO,
    )
    motivo = models.CharField(
        max_length=40,
        choices=SolicitacaoReembolsoMotivo.choices,
        default=SolicitacaoReembolsoMotivo.AUSENCIA_BARTENDER,
    )
    status = models.CharField(
        max_length=20,
        choices=SolicitacaoReembolsoStatus.choices,
        default=SolicitacaoReembolsoStatus.ABERTA,
    )
    valor_solicitado = models.DecimalField(max_digits=12, decimal_places=2)
    valor_aprovado = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    moeda = models.CharField(max_length=3, default='brl')
    observacao_cliente = models.TextField(blank=True)
    resposta_bartender = models.TextField(blank=True)
    respondido_em = models.DateTimeField(null=True, blank=True)
    decisao_admin = models.TextField(blank=True)
    decidido_por = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name='decisoes_reembolso',
        null=True,
        blank=True,
    )
    decidido_em = models.DateTimeField(null=True, blank=True)
    stripe_payment_intent_id = models.CharField(max_length=255, blank=True, null=True)
    stripe_status = models.CharField(max_length=50, blank=True)
    stripe_idempotency_key = models.CharField(max_length=255, blank=True)
    stripe_erro = models.TextField(blank=True)
    execucao_financeira_iniciada_em = models.DateTimeField(null=True, blank=True)
    execucao_financeira_concluida_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'Solicitacao de reembolso'
        verbose_name_plural = 'Solicitacoes de reembolso'
        ordering = ['-criado_em']
        constraints = [
            models.UniqueConstraint(
                fields=['pedido'],
                condition=models.Q(status__in=[
                    SolicitacaoReembolsoStatus.ABERTA,
                    SolicitacaoReembolsoStatus.CONTESTADA,
                    SolicitacaoReembolsoStatus.APROVADA,
                    SolicitacaoReembolsoStatus.FALHOU,
                ]),
                name='unique_solicitacao_reembolso_ativa_por_pedido',
            )
        ]

    @property
    def esta_ativa(self):
        return self.status in self.STATUS_ATIVOS

    def __str__(self):
        return f'Solicitacao de reembolso #{self.pk} - Pedido #{self.pedido_id} - {self.status}'
