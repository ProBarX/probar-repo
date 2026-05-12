import stripe
from django.conf import settings
from urllib.parse import urlparse

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from core.enums import PagamentoStatus
from core.models import Pedido, Pagamento
from core.services import stripe_service

stripe.api_key = settings.STRIPE_SECRET_KEY


def _stripe_attr(obj, key, default=None):
    if hasattr(obj, "get"):
        return obj.get(key, default)
    return getattr(obj, key, default)


def _pagamento_payload(pagamento, intent):
    mode = "setup" if (
        pagamento.stripe_setup_intent_id
        and not pagamento.stripe_payment_intent_id
    ) else "payment"

    return {
        "pagamento_id": pagamento.id,
        "pedido_id": pagamento.pedido_id,
        "valor": str(pagamento.valor),
        "status": pagamento.status,
        "mode": mode,
        "finalizado_pelo_cliente": pagamento.finalizado_pelo_cliente,
        "payment_intent_id": pagamento.stripe_payment_intent_id,
        "setup_intent_id": pagamento.stripe_setup_intent_id,
        "stripe_resource_id": _stripe_attr(intent, "id"),
        "payment_method_id": pagamento.stripe_payment_method_id,
        "client_secret": _stripe_attr(intent, "client_secret"),
        "stripe_status": _stripe_attr(intent, "status"),
    }


def _is_allowed_frontend_origin(origin):
    if not origin:
        return False

    if origin in getattr(settings, "CORS_ALLOWED_ORIGINS", []):
        return True

    parsed = urlparse(origin)
    return (
        settings.DEBUG
        and parsed.scheme in ["http", "https"]
        and parsed.hostname in ["localhost", "127.0.0.1"]
    )


def _frontend_origin(request):
    origin = request.headers.get("Origin")
    if _is_allowed_frontend_origin(origin):
        return origin.rstrip("/")

    referer = request.headers.get("Referer")
    if referer:
        parsed = urlparse(referer)
        referer_origin = f"{parsed.scheme}://{parsed.netloc}"
        if _is_allowed_frontend_origin(referer_origin):
            return referer_origin.rstrip("/")

    return None


def _stripe_redirect_urls(request):
    origin = _frontend_origin(request)
    if not origin:
        return settings.STRIPE_RETURN_URL, settings.STRIPE_REFRESH_URL

    return (
        f"{origin}/bartender/home?stripe=return",
        f"{origin}/bartender/home?stripe=refresh",
    )


# =========================
# ONBOARDING
# =========================

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def criar_link_onboarding(request):
    try:
        bartender = request.user.bartender

        if not bartender.stripe_account_id:
            bartender.stripe_account_id = stripe_service.criar_conta_express(
                request.user.email
            )
            bartender.stripe_onboarding_completo = False
            bartender.save(
                update_fields=[
                    "stripe_account_id",
                    "stripe_onboarding_completo",
                ]
            )

        stripe_service.garantir_capacidades_pagamento(
            bartender.stripe_account_id
        )

        return_url, refresh_url = _stripe_redirect_urls(request)
        link = stripe_service.criar_link_onboarding(
            bartender.stripe_account_id,
            return_url=return_url,
            refresh_url=refresh_url,
        )

        return Response({
            "url": link.url,
            "tem_conta_stripe": True,
            "onboarding_completo": False,
        })

    except AttributeError:
        return Response({"erro": "Usuário não é bartender"}, status=403)

    except stripe.error.StripeError as e:
        return Response(
            {"erro": getattr(e, "user_message", None) or str(e)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    except Exception as e:
        return Response(
            {"erro": str(e) or "Nao foi possivel criar a conta Stripe"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def verificar_status(request):
    try:
        bartender = request.user.bartender
        tem_conta = bool(bartender.stripe_account_id)

        return Response({
            "tem_conta_stripe": tem_conta,
            "onboarding_completo": stripe_service.verificar_onboarding(bartender)
            if tem_conta
            else False,
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

        return Response(_pagamento_payload(pagamento, intent))

    except Pedido.DoesNotExist:
        return Response({"erro": "Pedido não encontrado"}, status=404)

    except PermissionError as e:
        return Response({"erro": str(e)}, status=403)

    except ValueError as e:
        return Response({"erro": str(e)}, status=400)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def confirmar_setup_pagamento(request, pagamento_id):
    try:
        pagamento = Pagamento.objects.select_related(
            "pedido__cliente"
        ).get(id=pagamento_id)

        if not hasattr(request.user, "cliente"):
            return Response(
                {"erro": "Apenas clientes podem confirmar pagamento futuro"},
                status=403,
            )

        if pagamento.pedido.cliente.user_id != request.user.id:
            return Response(
                {"erro": "VocÃª nÃ£o pode confirmar este pagamento"},
                status=403,
            )

        if not pagamento.stripe_setup_intent_id:
            return Response(
                {"erro": "Pagamento nao usa confirmacao futura"},
                status=400,
            )

        pagamento, setup_intent = stripe_service.sincronizar_setup_pagamento(
            pagamento
        )

        return Response(_pagamento_payload(pagamento, setup_intent))

    except Pagamento.DoesNotExist:
        return Response({"erro": "Pagamento nÃ£o encontrado"}, status=404)

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


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def finalizar_pagamento(request, pagamento_id):
    try:
        pagamento = Pagamento.objects.select_related(
            "pedido__cliente"
        ).get(id=pagamento_id)

        if not hasattr(request.user, "cliente"):
            return Response(
                {"erro": "Apenas clientes podem finalizar pagamento"},
                status=403,
            )

        if pagamento.pedido.cliente.user_id != request.user.id:
            return Response(
                {"erro": "Você não pode finalizar este pagamento"},
                status=403,
            )

        if pagamento.finalizado_pelo_cliente:
            if pagamento.stripe_payment_intent_id and pagamento.status != PagamentoStatus.PAGO:
                stripe_service.capturar_pagamento_seguro(pagamento)
                pagamento.refresh_from_db()
                if pagamento.status != PagamentoStatus.PAGO:
                    return Response(
                        {"erro": "Pagamento nao foi capturado"},
                        status=400,
                    )
            return Response({"status": "Pagamento já finalizado"})

        if pagamento.stripe_payment_intent_id:
            pagamento.finalizado_pelo_cliente = True
            stripe_service.capturar_pagamento_seguro(pagamento)
            pagamento.refresh_from_db()

            if pagamento.status != PagamentoStatus.PAGO:
                return Response(
                    {"erro": "Pagamento nao foi capturado"},
                    status=400,
                )

        if not pagamento.finalizado_pelo_cliente:
            pagamento.finalizado_pelo_cliente = True
            pagamento.save(update_fields=["finalizado_pelo_cliente"])

        return Response({"status": "Pagamento finalizado pelo cliente"})

    except Pagamento.DoesNotExist:
        return Response({"erro": "Pagamento não encontrado"}, status=404)

    except ValueError as e:
        return Response({"erro": str(e)}, status=400)


# =========================
# WEBHOOK (IMPORTANTE)
# =========================

@api_view(["POST"])
@permission_classes([AllowAny])
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
