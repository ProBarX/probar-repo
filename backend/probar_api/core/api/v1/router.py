from rest_framework.routers import DefaultRouter
from django.urls import path
from .viewsets import UserViewSet, TermosViewSet, AceiteTermosViewSet, ClienteViewSet

router = DefaultRouter()

router.register("users", UserViewSet, basename="users")
router.register("termos", TermosViewSet, basename="termos")
router.register("aceite-termos", AceiteTermosViewSet, basename="aceite-termos")
router.register("clientes", ClienteViewSet, basename="clientes")
urlpatterns = router.urls