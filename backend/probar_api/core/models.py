from django.db import models
from django.utils import timezone
from core.managers import ActiveManager
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.utils.translation import gettext_lazy as _
from .managers import CustomUserManager
import uuid
import os
from django.core.exceptions import ValidationError

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
    TIPO_CHOICES = [
        ('cliente', 'Cliente'),
        ('bartender', 'Bartender'),
    ]
    name = models.CharField(_('nome'), max_length=100, blank=True)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default='cliente')
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
    return os.path.join('perfil_clientes', str(instance.user.id), filename)

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
    return os.path.join('perfil_bartenders', str(instance.user.id), filename)


class Drink(BaseModel):
    """Modelo para armazenar drinks disponíveis"""
    nome = models.CharField(max_length=100)
    foto = models.ImageField(
        upload_to='drinks/',
        null=True,
        blank=True
    )
    
    class Meta:
        verbose_name = "Drink"
        verbose_name_plural = "Drinks"
    
    def __str__(self):
        return self.nome


class Bartender(BaseModel):

    ESPECIALIDADE_CHOICES = [
        ('showman', 'Showman'),
        ('mixologista', 'Mixologista'),
        ('tradicional', 'Tradicional'),
        ('night_club', 'Night Club'),
    ]

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
        max_length=50, choices=ESPECIALIDADE_CHOICES,
        blank=True
    )

    drinks = models.ManyToManyField(
        Drink,
        blank=True,
        related_name='bartenders',
        help_text="Selecione até 6 drinks que você oferece"
    )

    cep = models.CharField(max_length=9, blank=True)
    rua = models.CharField(max_length=255, blank=True)
    bairro = models.CharField(max_length=255, blank=True)
    numero = models.CharField(max_length=20, blank=True)

    def clean(self):
        """Validar que não há mais de 6 drinks selecionados"""
        if self.pk:  # Apenas validar se o bartender já foi salvo (has pk)
            if self.drinks.count() > 6:
                raise ValidationError(
                    "Um bartender pode ter no máximo 6 drinks selecionados."
                )

    def __str__(self):
        return f"Bartender: {self.user.email}"


class Termos(BaseModel):
    TIPO_CHOICES = [
        ('cliente', 'Cliente'),
        ('bartender', 'Bartender'),
    ]
    conteudo = models.TextField()
    versao = models.CharField(max_length=10)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
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
    status_choices = [
        ('em_andamento', 'Em Andamento'),
        ('confirmado', 'Confirmado'),
        ('finalizado', 'Finalizado'),
        ('cancelado', 'Cancelado'),
    ]

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
    status = models.CharField(max_length=20, choices=status_choices, default='em_andamento')

    class Meta:
        verbose_name = "Evento"
        verbose_name_plural = "Eventos"

    def __str__(self):
        return f"Evento: {self.nome}"