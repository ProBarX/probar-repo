from django.db.models.signals import post_save
from django.dispatch import receiver
from core.models import User, Cliente, Bartender

@receiver(post_save, sender=User)
def create_cliente(sender, instance, created, **kwargs):
    if created and instance.tipo == "cliente":
        Cliente.objects.create(user=instance)


@receiver(post_save, sender=User)
def create_bartender(sender, instance, created, **kwargs):
    if created and instance.tipo == "bartender":
        Bartender.objects.create(user=instance)