from rest_framework.routers import DefaultRouter
from .viewsets import (
	UserViewSet,
	DocumentoLegalViewSet,
	AceiteDocumentoLegalViewSet,
	ClienteViewSet,
	EventoViewSet,
	BartenderViewSet,
	DrinkViewSet,
	PedidoViewSet,
	PropostaViewSet,
	ChatViewSet,
	MensagemViewSet,
	AvaliacaoViewSet,
)

from django.urls import path
from core.api.v1.stripe_views import (
    criar_link_onboarding,
    verificar_status,
    pagar_pedido,
    confirmar_setup_pagamento,
    capturar_pagamento,
	finalizar_pagamento,
    webhook_stripe
)


router = DefaultRouter()

router.register("users", UserViewSet, basename="users")
router.register("clientes", ClienteViewSet, basename="clientes")
router.register("bartenders", BartenderViewSet, basename="bartenders")
router.register("drinks", DrinkViewSet, basename="drinks")
router.register("eventos", EventoViewSet, basename="eventos")
router.register("documentos-legais", DocumentoLegalViewSet, basename="documentos-legais")
router.register("aceites-documentos-legais", AceiteDocumentoLegalViewSet, basename="aceites-documentos-legais")
router.register("pedidos", PedidoViewSet, basename="pedidos")
router.register("propostas", PropostaViewSet, basename="propostas")
router.register("chats", ChatViewSet, basename="chats")
router.register("mensagens", MensagemViewSet, basename="mensagens")
router.register("avaliacoes", AvaliacaoViewSet, basename="avaliacoes")

urlpatterns = router.urls + [
    path("stripe/onboarding/", criar_link_onboarding, name="stripe-onboarding"),
    path("stripe/status/", verificar_status, name="stripe-status"),
    path("stripe/pagar/<int:pedido_id>/", pagar_pedido, name="stripe-pagar-pedido"),
    path("stripe/setup-confirmado/<int:pagamento_id>/", confirmar_setup_pagamento, name="stripe-setup-confirmado"),
    path("stripe/capturar/<int:pagamento_id>/", capturar_pagamento, name="stripe-capturar-pagamento"),
    path("stripe/finalizar/<int:pagamento_id>/", finalizar_pagamento, name="stripe-finalizar-pagamento"),
    path("stripe/webhook/", webhook_stripe, name="stripe-webhook"),
]
