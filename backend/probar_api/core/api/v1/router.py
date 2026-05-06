from rest_framework.routers import DefaultRouter
from .viewsets import (
	UserViewSet,
	TermosViewSet,
	AceiteTermosViewSet,
	ClienteViewSet,
	EventoViewSet,
	BartenderViewSet,
	DrinkViewSet,
	PedidoViewSet,
	PropostaViewSet,
	ChatViewSet,
	MensagemViewSet,
)

from django.urls import path
from core.api.v1.stripe_views import (
    criar_link_onboarding,
    verificar_status,
    pagar_pedido,
    capturar_pagamento,
    webhook_stripe
)


router = DefaultRouter()

router.register("users", UserViewSet, basename="users")
router.register("clientes", ClienteViewSet, basename="clientes")
router.register("bartenders", BartenderViewSet, basename="bartenders")
router.register("drinks", DrinkViewSet, basename="drinks")
router.register("eventos", EventoViewSet, basename="eventos")
router.register("termos", TermosViewSet, basename="termos")
router.register("aceite-termos", AceiteTermosViewSet, basename="aceite-termos")
router.register("pedidos", PedidoViewSet, basename="pedidos")
router.register("propostas", PropostaViewSet, basename="propostas")
router.register("chats", ChatViewSet, basename="chats")
router.register("mensagens", MensagemViewSet, basename="mensagens")

urlpatterns = router.urls + [
    path("stripe/onboarding/", criar_link_onboarding),
    path("stripe/status/", verificar_status),
    path("stripe/pagar/<int:pedido_id>/", pagar_pedido),
    path("stripe/capturar/<int:pagamento_id>/", capturar_pagamento),
    path("stripe/webhook/", webhook_stripe),
]
