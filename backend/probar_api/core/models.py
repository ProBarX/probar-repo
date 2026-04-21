from django.db import models
from django.utils import timezone
from core.managers import ActiveManager
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.utils.translation import gettext_lazy as _
from .managers import CustomUserManager
import uuid
import os
from django.core.exceptions import ValidationError
from core.enums import *
from django.core.validators import MinValueValidator, MaxValueValidator


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
                "Este bartender já possui o máximo de 6 drinks."
                )
    
    
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
            raise ValidationError("O usuário não pode aceitar termos de uma função diferente da sua.")

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

    class Meta:
        verbose_name = 'Pedido'
        verbose_name_plural = 'Pedidos'

    def __str__(self):
        return f'Pedido #{self.pk} - {self.get_status_display()}'


class Proposta(BaseModel):
    pedido = models.ForeignKey('Pedido', on_delete=models.CASCADE, related_name='propostas')
    remetente = models.ForeignKey(User, on_delete=models.CASCADE, related_name='propostas_enviadas')
    tipo = models.CharField(max_length=20, choices=PropostaTipo.choices)
    horas = models.PositiveIntegerField()
    valor_hora = models.DecimalField(max_digits=10, decimal_places=2)
    valor_adicional = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    desconto = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    status = models.CharField(max_length=20, choices=PropostaStatus.choices, default=PropostaStatus.PENDENTE)

    class Meta:
        ordering = ['-criado_em']

    @property
    def valor_total(self):
        """Calcula o valor total da proposta"""
        return (self.horas * self.valor_hora) + self.valor_adicional - self.desconto

    def save(self, *args, **kwargs):
        # Se nao tiver valor_hora definido, pega do bartender
        if not self.valor_hora:
            self.valor_hora = self.pedido.bartender.valor_hora
        super().save(*args, **kwargs)

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
    metodo_pagamento = models.CharField(max_length=50, choices=PagamentoMetodo.choices)
    status = models.CharField(max_length=20, choices=PagamentoStatus.choices, default=PagamentoStatus.PENDENTE)

    class Meta:
        verbose_name = 'Pagamento'
        verbose_name_plural = 'Pagamentos'

    def __str__(self):
        return f'Pagamento #{self.pk} - Pedido #{self.pedido_id} - Valor: {self.valor}'