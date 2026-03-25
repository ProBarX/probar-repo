from rest_framework_simplejwt.views import TokenObtainPairView
from .auth import CustomTokenSerializer

class CustomTokenView(TokenObtainPairView):
    serializer_class = CustomTokenSerializer