from django.db.models.signals import post_save
from django.dispatch import receiver
from core.models import User, Cliente

@receiver(post_save, sender=User)
def create_cliente(sender, instance, created, **kwargs):
    if created and instance.role == "cliente":
        Cliente.objects.create(user=instance)