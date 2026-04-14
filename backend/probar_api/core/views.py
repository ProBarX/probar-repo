from rest_framework_simplejwt.views import TokenObtainPairView
from .auth import CustomTokenSerializer
from rest_framework_simplejwt.views import TokenRefreshView
from drf_spectacular.utils import extend_schema


class CustomTokenView(TokenObtainPairView):
    serializer_class = CustomTokenSerializer

    @extend_schema(
        tags=["Autenticação"],
        summary="Login",
        description="Retorna access e refresh token"
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)
    

class CustomTokenRefreshView(TokenRefreshView):

    @extend_schema(
        tags=["Autenticação"],
        summary="Atualizar token",
        description="Gera um novo access token"
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)