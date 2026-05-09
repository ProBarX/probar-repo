from django.db.models.signals import post_save
from django.dispatch import receiver
from core.models import User, Cliente, Bartender, Pedido, Chat
from core.services.stripe_service import ACCOUNT_CAPABILITIES

import stripe
from django.conf import settings
from django.db.models.signals import post_save

stripe.api_key = settings.STRIPE_SECRET_KEY

@receiver(post_save, sender=User)
def create_cliente(sender, instance, created, **kwargs):
    if created and instance.tipo == "cliente":
        Cliente.objects.create(user=instance)


@receiver(post_save, sender=User)
def create_bartender(sender, instance, created, **kwargs):
    if created and instance.tipo == "bartender":
        Bartender.objects.create(user=instance)


@receiver(post_save, sender=Pedido)
def create_chat_for_pedido(sender, instance, created, **kwargs):
    if created:
        Chat.objects.get_or_create(pedido=instance)


@receiver(post_save, sender=Bartender)
def criar_conta_stripe(sender, instance, created, **kwargs):
    if not created:
        return

    if instance.stripe_account_id:
        return

    try:
        account = stripe.Account.create(
            type="express",
            country="BR",
            email=instance.user.email,
            capabilities=ACCOUNT_CAPABILITIES,
        )
    except stripe.error.StripeError:
        return

    instance.stripe_account_id = account.id
    instance.save(update_fields=["stripe_account_id"])
