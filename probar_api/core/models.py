from django.db import models
from django.utils import timezone
from core.managers import ActiveManager


# Base para Soft Delete e controle de datas
class BaseModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)  # data de criação
    updated_at = models.DateTimeField(auto_now=True)      # data de atualização
    is_deleted = models.BooleanField(default=False)       # soft delete
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

