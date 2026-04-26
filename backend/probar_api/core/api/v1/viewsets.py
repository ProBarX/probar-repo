from rest_framework import viewsets
from core.models import User, Termos, AceiteTermos, Cliente, Evento, Bartender, Drink
from django.db import models
from .serializers import UserSerializer, TermosSerializer, AceiteTermosSerializer, ClienteSerializer, EventoSerializer, BartenderSerializer, DrinkSerializer
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import action
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, OpenApiExample
from core.enums import TipoUsuario
from core.models import Pedido, Proposta, Chat, Mensagem
from .serializers import PedidoSerializer, PropostaSerializer, ChatSerializer, MensagemSerializer, CounterPropostaRequestSerializer, AcceptPropostaRequestSerializer, PedidoCreateSerializer
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from .permissions import PropostaParticipantPermission
from django.shortcuts import get_object_or_404
from django.db import IntegrityError

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

    @extend_schema(
        summary="Criar usuário",
        description="Cria um usuário com email, senha e tipo (cliente|bartender).",
        examples=[
            OpenApiExample(
                'Exemplo criação usuário cliente',
                value={"email": "cliente@example.com", "password": "senhaSegura123", "name": "João"},
                request_only=True,
            ),
        ],
    )
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)


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

    @extend_schema(
        summary="Aceitar termos",
        description="Usuário aceita um termo existente (passar `termo_id` no body).",
        examples=[
            OpenApiExample(
                'Exemplo aceite',
                value={"termo_id": 3},
                request_only=True,
            )
        ]
    )
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)


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

        if not user.is_authenticated:
            return Bartender.objects.all()

        if user.is_staff or user.tipo == TipoUsuario.CLIENTE:
            return Bartender.objects.all()

        return Bartender.objects.filter(user=user)
    
    def get_permissions(self):
        if self.action == 'list':
            return [AllowAny()]
        return [IsAuthenticated()]

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

    @extend_schema(
        summary="Criar drink",
        examples=[
            OpenApiExample(
                'Exemplo drink',
                value={"nome": "Mojito", "foto": None},
                request_only=True,
            )
        ]
    )
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)


@extend_schema(tags=["Eventos"])
class EventoViewSet(viewsets.ModelViewSet):
    serializer_class = EventoSerializer
    permission_classes = [IsAuthenticated]
    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Evento.objects.select_related('cliente').all()
        return Evento.objects.filter(cliente__user=user).select_related('cliente')

    @extend_schema(
        summary="Criar evento",
        examples=[
            OpenApiExample(
                'Exemplo evento',
                value={
                    "cliente": 1,
                    "nome": "Aniversário",
                    "data": "2026-05-01",
                    "hora_inicio": "20:00:00",
                    "hora_fim": "23:00:00",
                    "quantidade_convidados": 50
                },
                request_only=True,
            )
        ]
    )
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)


@extend_schema(tags=["Pedidos"])
class PedidoViewSet(viewsets.ModelViewSet):
    serializer_class = PedidoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Pedido.objects.all()
        # clientes veem pedidos em que são clientes; bartenders veem pedidos onde são bartenders
        if user.tipo == TipoUsuario.CLIENTE:
            return Pedido.objects.filter(cliente__user=user)
        return Pedido.objects.filter(bartender__user=user)

    def perform_create(self, serializer):
        # cliente é o usuário logado
        cliente = Cliente.objects.get(user=self.request.user)
        serializer.save(cliente=cliente)
    
    @extend_schema(
        summary="Criar pedido com proposta inicial",
        description="Cria um pedido (cliente autenticado) e adiciona automaticamente a proposta inicial e o chat em uma transação atômica.",
        request=PedidoCreateSerializer,
        responses=PedidoSerializer,
        examples=[
            OpenApiExample('Exemplo pedido', value={"bartender": 2, "evento": 1, "horas": 3}, request_only=True),
        ],
    )
    def create(self, request, *args, **kwargs):
        serializer = PedidoCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        pedido = serializer.save()
        # retornar representação completa do pedido
        return Response(PedidoSerializer(pedido, context={'request': request}).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["Propostas"])
class PropostaViewSet(viewsets.ModelViewSet):
    serializer_class = PropostaSerializer
    permission_classes = [IsAuthenticated, PropostaParticipantPermission]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Proposta.objects.select_related('pedido').all()
        return Proposta.objects.filter(models.Q(remetente=user) | models.Q(pedido__cliente__user=user) | models.Q(pedido__bartender__user=user))

    def perform_create(self, serializer):
        serializer.save(remetente=self.request.user)

    @extend_schema(
        summary="Criar proposta",
        description=("Cria uma proposta vinculada a um pedido. "
                     "Regra: a primeira proposta do pedido deve ser enviada pelo cliente. "
                     "O campo `remetente` é preenchido automaticamente com o usuário autenticado."),
        responses=PropostaSerializer,
        examples=[
            OpenApiExample(
                'Exemplo proposta inicial',
                value={"pedido": 1, "tipo": "inicial", "horas": 3, "valor_adicional": "0.00", "desconto": "0.00"},
                request_only=True,
            ),
        ],
    )
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    @extend_schema(
        summary="Aceitar proposta",
        description=("Aceita a proposta informada. Executa operação atômica que marca a proposta como `ACEITA`, "
                     "associa-a ao `Pedido.proposta_aprovada` e grava um snapshot dos valores aprovados no pedido."),
        request=AcceptPropostaRequestSerializer,
        responses=PropostaSerializer,
        examples=[OpenApiExample('Exemplo accept', value={}, request_only=True)],
    )
    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        proposta = self.get_object()
        try:
            proposta.accept(request.user)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(proposta).data)

    @extend_schema(
        summary="Recusar proposta",
        description="Marca a proposta como recusada. Apenas participantes do pedido podem recusar.",
        responses=PropostaSerializer,
        examples=[OpenApiExample('Exemplo reject', value={}, request_only=True)],
    )
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        proposta = self.get_object()
        try:
            proposta.reject(request.user)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(proposta).data)

    @extend_schema(
        summary="Cancelar proposta",
        description="Cancela a proposta enquanto ela estiver pendente. Somente o autor da proposta pode cancelar.",
        responses=PropostaSerializer,
        examples=[OpenApiExample('Exemplo cancel', value={}, request_only=True)],
    )
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        proposta = self.get_object()
        try:
            proposta.cancel(request.user)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(proposta).data)

    @extend_schema(
        summary="Contraproposta",
        description=("Cria uma contraproposta baseada na proposta atual. Campos opcionais no body: `horas` (int), "
                     "`valor_adicional` (decimal) e `desconto` (decimal). A proposta atual será marcada como `SUBSTITUIDA`."),
        request=CounterPropostaRequestSerializer,
        responses=PropostaSerializer,
        examples=[OpenApiExample('Exemplo counter', value={"horas": 4, "valor_adicional": "20.00", "desconto": "0.00"}, request_only=True)],
    )
    @action(detail=True, methods=['post'])
    def counter(self, request, pk=None):
        proposta = self.get_object()
        # validar e normalizar entrada via serializer
        serializer_in = CounterPropostaRequestSerializer(data=request.data)
        serializer_in.is_valid(raise_exception=True)
        validated = serializer_in.validated_data

        try:
            nova = proposta.counter(
                request.user,
                horas=validated.get('horas'),
                valor_adicional=validated.get('valor_adicional'),
                desconto=validated.get('desconto'),
            )
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(PropostaSerializer(nova, context={'request': request}).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["Chats"])
class ChatViewSet(viewsets.ModelViewSet):
    serializer_class = ChatSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Chat.objects.all()
        return Chat.objects.filter(models.Q(pedido__cliente__user=user) | models.Q(pedido__bartender__user=user))


@extend_schema(tags=["Mensagens"])
class MensagemViewSet(viewsets.ModelViewSet):
    serializer_class = MensagemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Mensagem.objects.all()
        return Mensagem.objects.filter(models.Q(chat__pedido__cliente__user=user) | models.Q(chat__pedido__bartender__user=user))

    def perform_create(self, serializer):
        serializer.save(remetente=self.request.user)

    @extend_schema(
        summary="Enviar mensagem no chat",
        description="Envia uma mensagem vinculada a um chat; `remetente` será preenchido com o usuário autenticado.",
        responses=MensagemSerializer,
    )
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)