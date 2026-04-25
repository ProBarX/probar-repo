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

urlpatterns = router.urls