import stripe
from django.conf import settings

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from core.models import Pedido, Pagamento
from core.services import stripe_service

stripe.api_key = settings.STRIPE_SECRET_KEY


# =========================
# ONBOARDING
# =========================

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def criar_link_onboarding(request):
    try:
        bartender = request.user.bartender

        if not bartender.stripe_account_id:
            return Response({"erro": "Sem conta Stripe"}, status=400)

        link = stripe_service.criar_link_onboarding(
            bartender.stripe_account_id
        )

        return Response({"url": link.url})

    except AttributeError:
        return Response({"erro": "Usuário não é bartender"}, status=403)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def verificar_status(request):
    try:
        bartender = request.user.bartender

        return Response({
            "onboarding_completo": stripe_service.verificar_onboarding(bartender)
        })

    except AttributeError:
        return Response({"erro": "Usuário não é bartender"}, status=403)


# =========================
# PAGAMENTO
# =========================

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def pagar_pedido(request, pedido_id):
    try:
        pagamento, intent = stripe_service.criar_pagamento_seguro(
            pedido_id,
            request.user
        )

        return Response({
            "client_secret": intent.client_secret
        })

    except Pedido.DoesNotExist:
        return Response({"erro": "Pedido não encontrado"}, status=404)

    except PermissionError as e:
        return Response({"erro": str(e)}, status=403)

    except ValueError as e:
        return Response({"erro": str(e)}, status=400)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def capturar_pagamento(request, pagamento_id):
    try:
        pagamento = Pagamento.objects.select_related(
            "pedido__cliente"
        ).get(id=pagamento_id)

        if not hasattr(request.user, "cliente"):
            return Response(
                {"erro": "Apenas clientes podem liberar pagamento"},
                status=403
            )

        if pagamento.pedido.cliente.user_id != request.user.id:
            return Response(
                {"erro": "Você não pode liberar este pagamento"},
                status=403
            )

        stripe_service.capturar_pagamento_seguro(pagamento)

        return Response({"status": "Pagamento liberado"})

    except Pagamento.DoesNotExist:
        return Response({"erro": "Pagamento não encontrado"}, status=404)

    except ValueError as e:
        return Response({"erro": str(e)}, status=400)


# =========================
# WEBHOOK (IMPORTANTE)
# =========================

@api_view(["POST"])
def webhook_stripe(request):
    payload = request.body
    sig_header = request.META.get("HTTP_STRIPE_SIGNATURE")

    try:
        event = stripe.Webhook.construct_event(
            payload,
            sig_header,
            settings.STRIPE_WEBHOOK_SECRET
        )

    except stripe.error.SignatureVerificationError:
        return Response({"erro": "Assinatura inválida"}, status=400)

    except Exception:
        return Response(status=400)

    stripe_service.processar_webhook(event)

    return Response(status=200)