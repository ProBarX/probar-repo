from rest_framework import viewsets
from core.models import User, Termos, AceiteTermos
from .serializers import UserSerializer, TermosSerializer, AceiteTermosSerializer
from rest_framework.permissions import IsAuthenticated


class UserViewSet(viewsets.ModelViewSet):

    queryset = User.objects.all()
    serializer_class = UserSerializer

class TermosViewSet(viewsets.ModelViewSet):

    queryset = Termos.objects.all()
    serializer_class = TermosSerializer


class AceiteTermosViewSet(viewsets.ModelViewSet):

    queryset = AceiteTermos.objects.all()
    serializer_class = AceiteTermosSerializer

    permission_classes = [IsAuthenticated]
