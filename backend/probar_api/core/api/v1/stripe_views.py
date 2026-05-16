import stripe
from django.conf import settings
from urllib.parse import urlparse

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import serializers, status
from drf_spectacular.utils import OpenApiExample, OpenApiResponse, extend_schema

from core.enums import PagamentoStatus
from core.models import Pedido, Pagamento
from core.services import stripe_service

stripe.api_key = settings.STRIPE_SECRET_KEY


TAG_STRIPE_ONBOARDING = "Pagamentos - Onboarding Stripe"
TAG_STRIPE_PAGAMENTOS = "Pagamentos - Stripe"
TAG_STRIPE_WEBHOOKS = "Pagamentos - Webhooks Stripe"


class StripeErroSerializer(serializers.Serializer):
    erro = serializers.CharField()


class StripeOnboardingResponseSerializer(serializers.Serializer):
    url = serializers.URLField()
    tem_conta_stripe = serializers.BooleanField()
    onboarding_completo = serializers.BooleanField()


class StripeStatusResponseSerializer(serializers.Serializer):
    tem_conta_stripe = serializers.BooleanField()
    onboarding_completo = serializers.BooleanField()


class StripePagamentoResponseSerializer(serializers.Serializer):
    pagamento_id = serializers.IntegerField()
    pedido_id = serializers.IntegerField()
    pedido_numero_bartender = serializers.IntegerField(allow_null=True)
    valor = serializers.CharField()
    status = serializers.CharField()
    mode = serializers.ChoiceField(choices=["payment", "setup"])
    finalizado_pelo_cliente = serializers.BooleanField()
    payment_intent_id = serializers.CharField(allow_null=True)
    setup_intent_id = serializers.CharField(allow_null=True)
    stripe_resource_id = serializers.CharField(allow_null=True)
    payment_method_id = serializers.CharField(allow_null=True)
    client_secret = serializers.CharField(allow_null=True)
    stripe_status = serializers.CharField(allow_null=True)
    presenca_status = serializers.CharField()
    presenca_origem = serializers.CharField(allow_null=True)
    servico_fim_previsto = serializers.DateTimeField()
    liberacao_automatica_em = serializers.DateTimeField()


class StripeStatusMessageSerializer(serializers.Serializer):
    status = serializers.CharField()


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
        "pedido_numero_bartender": pagamento.pedido.numero_bartender,
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
        "presenca_status": pagamento.pedido.presenca_status,
        "presenca_origem": pagamento.pedido.presenca_origem,
        "servico_fim_previsto": pagamento.pedido.servico_fim_previsto,
        "liberacao_automatica_em": pagamento.pedido.liberacao_automatica_em,
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

@extend_schema(
    tags=[TAG_STRIPE_ONBOARDING],
    summary="Criar link de onboarding Stripe",
    description=(
        "Cria ou reutiliza a conta Stripe Express do bartender autenticado e retorna "
        "um link temporário para concluir o onboarding. Apenas usuários do tipo bartender podem usar."
    ),
    request=None,
    responses={
        200: StripeOnboardingResponseSerializer,
        400: OpenApiResponse(StripeErroSerializer, description="Erro retornado pela Stripe."),
        403: OpenApiResponse(StripeErroSerializer, description="Usuário autenticado não é bartender."),
        500: OpenApiResponse(StripeErroSerializer, description="Erro inesperado ao criar conta ou link Stripe."),
    },
    examples=[
        OpenApiExample(
            "Link criado",
            value={
                "url": "https://connect.stripe.com/setup/e/acct_123/abc",
                "tem_conta_stripe": True,
                "onboarding_completo": False,
            },
            response_only=True,
            status_codes=["200"],
        )
    ],
)
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


@extend_schema(
    tags=[TAG_STRIPE_ONBOARDING],
    summary="Verificar status do onboarding Stripe",
    description=(
        "Consulta se o bartender autenticado já tem conta Stripe vinculada e se o onboarding "
        "está completo para receber pagamentos."
    ),
    responses={
        200: StripeStatusResponseSerializer,
        403: OpenApiResponse(StripeErroSerializer, description="Usuário autenticado não é bartender."),
    },
    examples=[
        OpenApiExample(
            "Onboarding completo",
            value={"tem_conta_stripe": True, "onboarding_completo": True},
            response_only=True,
            status_codes=["200"],
        )
    ],
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

@extend_schema(
    tags=[TAG_STRIPE_PAGAMENTOS],
    summary="Criar pagamento de um pedido",
    description=(
        "Cria ou sincroniza o pagamento Stripe para um pedido aceito. O cliente autenticado "
        "deve ser o dono do pedido. A resposta retorna o `client_secret` que o frontend usa "
        "para confirmar o PaymentIntent ou SetupIntent."
    ),
    request=None,
    responses={
        200: StripePagamentoResponseSerializer,
        400: OpenApiResponse(StripeErroSerializer, description="Pedido não está apto para pagamento ou erro de validação."),
        403: OpenApiResponse(StripeErroSerializer, description="Usuário sem permissão para pagar este pedido."),
        404: OpenApiResponse(StripeErroSerializer, description="Pedido não encontrado."),
    },
    examples=[
        OpenApiExample(
            "PaymentIntent com captura manual",
            value={
                "pagamento_id": 12,
                "pedido_id": 34,
                "valor": "350.00",
                "status": "PENDENTE",
                "mode": "payment",
                "finalizado_pelo_cliente": False,
                "payment_intent_id": "pi_123",
                "setup_intent_id": None,
                "stripe_resource_id": "pi_123",
                "payment_method_id": None,
                "client_secret": "pi_123_secret_abc",
                "stripe_status": "requires_payment_method",
            },
            response_only=True,
            status_codes=["200"],
        ),
        OpenApiExample(
            "SetupIntent para pagamento futuro",
            value={
                "pagamento_id": 13,
                "pedido_id": 35,
                "valor": "500.00",
                "status": "PENDENTE",
                "mode": "setup",
                "finalizado_pelo_cliente": False,
                "payment_intent_id": None,
                "setup_intent_id": "seti_123",
                "stripe_resource_id": "seti_123",
                "payment_method_id": None,
                "client_secret": "seti_123_secret_abc",
                "stripe_status": "requires_payment_method",
            },
            response_only=True,
            status_codes=["200"],
        ),
    ],
)
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


@extend_schema(
    tags=[TAG_STRIPE_PAGAMENTOS],
    summary="Confirmar SetupIntent de pagamento futuro",
    description=(
        "Sincroniza no backend um pagamento que salvou o método de pagamento via SetupIntent. "
        "Use após o frontend confirmar o `client_secret` retornado por `pagar_pedido` quando `mode=setup`."
    ),
    request=None,
    responses={
        200: StripePagamentoResponseSerializer,
        400: OpenApiResponse(StripeErroSerializer, description="Pagamento não usa SetupIntent ou erro de validação."),
        403: OpenApiResponse(StripeErroSerializer, description="Usuário sem permissão para confirmar este pagamento."),
        404: OpenApiResponse(StripeErroSerializer, description="Pagamento não encontrado."),
    },
    examples=[
        OpenApiExample(
            "Setup confirmado",
            value={
                "pagamento_id": 13,
                "pedido_id": 35,
                "valor": "500.00",
                "status": "PENDENTE",
                "mode": "setup",
                "finalizado_pelo_cliente": False,
                "payment_intent_id": None,
                "setup_intent_id": "seti_123",
                "stripe_resource_id": "seti_123",
                "payment_method_id": "pm_123",
                "client_secret": None,
                "stripe_status": "succeeded",
            },
            response_only=True,
            status_codes=["200"],
        )
    ],
)
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


@extend_schema(
    tags=[TAG_STRIPE_PAGAMENTOS],
    summary="Capturar pagamento autorizado",
    description=(
        "Libera/captura um PaymentIntent autorizado. Apenas o cliente dono do pedido pode capturar. "
        "A captura respeita as regras de segurança do serviço, como janela de captura manual."
    ),
    request=None,
    responses={
        200: StripeStatusMessageSerializer,
        400: OpenApiResponse(StripeErroSerializer, description="Pagamento ainda não pode ser liberado ou está inválido."),
        403: OpenApiResponse(StripeErroSerializer, description="Usuário sem permissão para capturar este pagamento."),
        404: OpenApiResponse(StripeErroSerializer, description="Pagamento não encontrado."),
    },
    examples=[
        OpenApiExample(
            "Pagamento liberado",
            value={"status": "Pagamento liberado"},
            response_only=True,
            status_codes=["200"],
        )
    ],
)
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


@extend_schema(
    tags=[TAG_STRIPE_PAGAMENTOS],
    summary="Finalizar pagamento pelo cliente",
    description=(
        "Captura/libera o pagamento autorizado quando aplicavel. "
        "Este endpoint e idempotente: se o pagamento ja estiver liberado, retorna status informativo."
    ),
    request=None,
    responses={
        200: StripeStatusMessageSerializer,
        400: OpenApiResponse(StripeErroSerializer, description="Pagamento não foi capturado ou erro de validação."),
        403: OpenApiResponse(StripeErroSerializer, description="Usuário sem permissão para finalizar este pagamento."),
        404: OpenApiResponse(StripeErroSerializer, description="Pagamento não encontrado."),
    },
    examples=[
        OpenApiExample(
            "Pagamento liberado",
            value={"status": "Pagamento liberado"},
            response_only=True,
            status_codes=["200"],
        ),
        OpenApiExample(
            "Pagamento ja liberado",
            value={"status": "Pagamento ja liberado"},
            response_only=True,
            status_codes=["200"],
        ),
    ],
)
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

        stripe_service.confirmar_presenca_pedido(
            pagamento.pedido_id,
            request.user,
            observacao="Confirmado pelo fluxo de finalizacao do pagamento.",
        )
        pagamento.refresh_from_db()

        if pagamento.stripe_payment_intent_id and pagamento.status != PagamentoStatus.PAGO:
            return Response(
                {"erro": "Pagamento nao foi capturado"},
                status=400,
            )

        if not pagamento.finalizado_pelo_cliente:
            pagamento.finalizado_pelo_cliente = True
            pagamento.save(update_fields=["finalizado_pelo_cliente"])

        if pagamento.status == PagamentoStatus.PAGO:
            return Response({"status": "Pagamento liberado"})

        return Response({"status": "Presenca confirmada"})

    except Pagamento.DoesNotExist:
        return Response({"erro": "Pagamento não encontrado"}, status=404)

    except ValueError as e:
        return Response({"erro": str(e)}, status=400)


# =========================
# WEBHOOK (IMPORTANTE)
# =========================

@extend_schema(
    tags=[TAG_STRIPE_WEBHOOKS],
    summary="Receber webhook da Stripe",
    description=(
        "Endpoint público chamado pela Stripe. Valida o header `Stripe-Signature` usando "
        "`STRIPE_WEBHOOK_SECRET` e processa eventos como `payment_intent.succeeded`, "
        "`payment_intent.payment_failed`, `setup_intent.succeeded` e `setup_intent.canceled`."
    ),
    request=None,
    responses={
        200: OpenApiResponse(description="Evento recebido e processado."),
        400: OpenApiResponse(StripeErroSerializer, description="Assinatura inválida ou payload inválido."),
    },
    examples=[
        OpenApiExample(
            "Assinatura inválida",
            value={"erro": "Assinatura inválida"},
            response_only=True,
            status_codes=["400"],
        )
    ],
)
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
