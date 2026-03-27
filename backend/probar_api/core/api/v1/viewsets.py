from rest_framework import viewsets
from core.models import User, Termos, AceiteTermos, Cliente, Evento
from .serializers import UserSerializer, TermosSerializer, AceiteTermosSerializer, ClienteSerializer, EventoSerializer
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import action
from rest_framework.response import Response


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer

    def get_permissions(self):
        if self.action == "create":
            return [AllowAny()]

        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user

        if user.is_staff:
            return User.objects.all()

        return User.objects.filter(id=user.id)


class TermosViewSet(viewsets.ModelViewSet):
    queryset = Termos.objects.all()
    serializer_class = TermosSerializer


class AceiteTermosViewSet(viewsets.ModelViewSet):
    serializer_class = AceiteTermosSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return AceiteTermos.objects.filter(user=self.request.user)


class ClienteViewSet(viewsets.ModelViewSet):
    serializer_class = ClienteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        if user.is_staff:
            return Cliente.objects.all()

        return Cliente.objects.filter(user=user)

    @action(detail=False, methods=['get'])
    def me(self, request):
        cliente = Cliente.objects.get(user=request.user)
        serializer = self.get_serializer(cliente)
        return Response(serializer.data)
    

class EventoViewSet(viewsets.ModelViewSet):
    queryset = Evento.objects.select_related('cliente').all()
    serializer_class = EventoSerializer
    permission_classes = [IsAuthenticated]