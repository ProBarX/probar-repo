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
    created_at = models.DateTimeField(auto_now_add=True)  # data de criação
    updated_at = models.DateTimeField(auto_now=True)  # data de atualização
    is_deleted = models.BooleanField(default=False)   # soft delete
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = ActiveManager()       # só retorna registros ativos
    all_objects = models.Manager()  # retorna tudo (inclusive deletados)

    class Meta:
        abstract = True  # não cria tabela no banco

    def delete(self, using=None, keep_parents=False):
        """Soft delete: marca como deletado em vez de remover"""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()

    def restore(self):
        """Restaura um item deletado"""
        self.is_deleted = False
        self.deleted_at = None
        self.save()



class User(BaseModel, AbstractBaseUser, PermissionsMixin):
    """Custom user model que usa email como identificador único."""
    ROLE_CHOICES = [
        ('cliente', 'Cliente'),
        ('bartender', 'Bartender'),
    ]
    name = models.CharField(_('nome'), max_length=100, blank=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='cliente')
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


def bartender_document_path(instance, filename):
    ext = filename.split('.')[-1]
    filename = f'{uuid.uuid4()}.{ext}'
    return os.path.join('documentos_bartenders', str(instance.user.id), filename)


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

    foto_documento = models.ImageField(
        upload_to=bartender_document_path,
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

    especialidades = models.JSONField(
        default=list,
        blank=True
    )

    cep = models.CharField(max_length=9, blank=True)
    rua = models.CharField(max_length=255, blank=True)
    bairro = models.CharField(max_length=255, blank=True)
    numero = models.CharField(max_length=20, blank=True)

    def __str__(self):
        return f"Bartender: {self.user.email}"


class Termos(BaseModel):
    ROLE_CHOICES = [
        ('cliente', 'Cliente'),
        ('bartender', 'Bartender'),
    ]
    content = models.TextField()
    version = models.CharField(max_length=10)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Termo de Uso"
        verbose_name_plural = "Termos de Uso"

    def __str__(self):
        return f"v{self.version} - {self.get_role_display()}"


class AceiteTermos(BaseModel):
    termo = models.ForeignKey(Termos, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    accepted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Aceite de Termos"
        verbose_name_plural = "Aceites de Termos"
        unique_together = ('termo', 'user')

    def clean(self):
        if self.termo.role != self.user.role:
            raise ValidationError("O usuário não pode aceitar termos de uma função diferente da sua.")

    def __str__(self):
        return f"{self.user.email} aceitou v{self.termo.version} ({self.termo.role})"