from rest_framework.routers import DefaultRouter
from django.urls import path
from .viewsets import UserViewSet

router = DefaultRouter()

router.register("users", UserViewSet, basename="users")

urlpatterns = router.urls