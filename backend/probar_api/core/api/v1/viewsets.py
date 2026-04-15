from rest_framework import viewsets
from core.models import User, Termos, AceiteTermos, Cliente, Evento, Bartender, Drink
from .serializers import UserSerializer, TermosSerializer, AceiteTermosSerializer, ClienteSerializer, EventoSerializer, BartenderSerializer, DrinkSerializer
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import action
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
    

@extend_schema(tags=["Usuários"])
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


@extend_schema(tags=["Termos"])
class TermosViewSet(viewsets.ModelViewSet):
    queryset = Termos.objects.all()
    serializer_class = TermosSerializer


@extend_schema(tags=["Aceite Termos"])
class AceiteTermosViewSet(viewsets.ModelViewSet):
    serializer_class = AceiteTermosSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return AceiteTermos.objects.filter(user=self.request.user)


@extend_schema(tags=["Clientes"])
class ClienteViewSet(viewsets.ModelViewSet):
    serializer_class = ClienteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        if user.is_staff:
            return Cliente.objects.all()

        return Cliente.objects.filter(user=user)


    @extend_schema(
        summary="Obter dados do cliente logado",
        methods=["GET"]
    )
    @extend_schema(
        summary="Atualizar dados do cliente logado",
        methods=["PATCH"]
    )
    @action(detail=False, methods=['get', 'patch'])
    def me(self, request):
        cliente = Cliente.objects.get(user=request.user)

        if request.method == 'GET':
            serializer = self.get_serializer(cliente)
            return Response(serializer.data)

        serializer = self.get_serializer(cliente, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


@extend_schema(tags=["Bartenders"])
class BartenderViewSet(viewsets.ModelViewSet):
    serializer_class = BartenderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        if user.is_staff:
            return Bartender.objects.all()

        return Bartender.objects.filter(user=user)
    

    @extend_schema(
        summary="Obter dados do bartender logado",
        methods=["GET"]
    )
    @extend_schema(
        summary="Atualizar dados do bartender logado",
        methods=["PATCH"]
    )
    @action(detail=False, methods=['get', 'patch'])
    def me(self, request):
        bartender = Bartender.objects.get(user=request.user)

        if request.method == 'GET':
            serializer = self.get_serializer(bartender)
            return Response(serializer.data)

        serializer = self.get_serializer(
            bartender,
            data=request.data,
            partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(serializer.data)


@extend_schema(tags=["Drinks"])
class DrinkViewSet(viewsets.ModelViewSet):
    serializer_class = DrinkSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        if user.is_staff:
            return Drink.objects.all()

        return Drink.objects.filter(bartender__user=user)
    
    def perform_create(self, serializer):
        bartender = Bartender.objects.get(user=self.request.user)
        serializer.save(bartender=bartender)


@extend_schema(tags=["Eventos"])
class EventoViewSet(viewsets.ModelViewSet):
    queryset = Evento.objects.select_related('cliente').all()
    serializer_class = EventoSerializer
    permission_classes = [IsAuthenticated]