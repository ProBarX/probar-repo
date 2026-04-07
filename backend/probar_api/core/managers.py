from django.db import models
from django.contrib.auth.base_user import BaseUserManager


class ActiveManager(models.Manager):
      def get_queryset(self):
            return super().get_queryset().filter(esta_deletado=False)


class CustomUserManager(BaseUserManager):
   """Manager para o modelo de usuário customizado que usa email como identificador."""
   use_in_migrations = True

   def create_user(self, email, password=None, **extra_fields):
      if not email:
         raise ValueError('O e-mail deve ser enviado.')
      email = self.normalize_email(email)
      user = self.model(email=email, **extra_fields)
      user.set_password(password)
      user.save(using=self._db)
      return user

   def create_superuser(self, email, password=None, **extra_fields):
      extra_fields.setdefault('is_staff', True)
      extra_fields.setdefault('is_superuser', True)
      extra_fields.setdefault('is_active', True)

      if extra_fields.get('is_staff') is not True:
         raise ValueError('Superuser deve ter is_staff=True.')
      if extra_fields.get('is_superuser') is not True:
         raise ValueError('Superuser deve ter is_superuser=True.')

      return self.create_user(email, password, **extra_fields)