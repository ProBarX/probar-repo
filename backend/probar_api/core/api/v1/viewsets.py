from rest_framework import viewsets
from core.models import User, DocumentoLegal, AceiteDocumentoLegal, Cliente, Evento, Bartender, Drink
from django.db import models
from .serializers import UserSerializer, DocumentoLegalSerializer, AceiteDocumentoLegalSerializer, ClienteSerializer, EventoSerializer, BartenderSerializer, DrinkSerializer
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from rest_framework.decorators import action
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, OpenApiExample
from core.enums import PedidoStatus, TipoUsuario, TipoDocumentoLegal, SolicitacaoReembolsoStatus
from core.models import Pedido, Proposta, Chat, Mensagem, Avaliacao, SolicitacaoReembolso
from .serializers import PedidoSerializer, PropostaSerializer, ChatSerializer, MensagemSerializer, CounterPropostaRequestSerializer, AcceptPropostaRequestSerializer, PresencaPedidoRequestSerializer, PedidoCreateSerializer, AvaliacaoSerializer
from .serializers import SolicitacaoReembolsoSerializer, ResponderSolicitacaoReembolsoRequestSerializer, DecidirSolicitacaoReembolsoRequestSerializer
from rest_framework import status
from .permissions import PropostaParticipantPermission
from django.shortcuts import get_object_or_404
from django.db import IntegrityError
from django.db.models.functions import Coalesce
from core.services import stripe_service, reembolso_service

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


@extend_schema(tags=["Documentos Legais"])
class DocumentoLegalViewSet(viewsets.ModelViewSet):
    queryset = DocumentoLegal.objects.all()
    serializer_class = DocumentoLegalSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve", "ativos"):
            return [AllowAny()]

        return [IsAdminUser()]

    def get_queryset(self):
        queryset = DocumentoLegal.objects.all()
        tipo = self.request.query_params.get("tipo")
        tipo_usuario = self.request.query_params.get("tipo_usuario")
        somente_ativos = self.request.query_params.get("ativos")

        if tipo:
            queryset = queryset.filter(tipo=tipo)

        if tipo_usuario:
            tipo_termos = (
                TipoDocumentoLegal.TERMOS_BARTENDER
                if tipo_usuario == TipoUsuario.BARTENDER
                else TipoDocumentoLegal.TERMOS_CLIENTE
            )
            queryset = queryset.filter(
                tipo__in=[tipo_termos, TipoDocumentoLegal.POLITICA_PRIVACIDADE]
            )

        if somente_ativos in ("1", "true", "True"):
            queryset = queryset.filter(esta_ativo=True)

        return queryset

    @action(detail=False, methods=["get"], permission_classes=[AllowAny])
    def ativos(self, request):
        tipo_usuario = request.query_params.get("tipo_usuario")
        queryset = self.get_queryset().filter(esta_ativo=True)

        if tipo_usuario:
            tipo_termos = (
                TipoDocumentoLegal.TERMOS_BARTENDER
                if tipo_usuario == TipoUsuario.BARTENDER
                else TipoDocumentoLegal.TERMOS_CLIENTE
            )
            queryset = queryset.filter(
                tipo__in=[tipo_termos, TipoDocumentoLegal.POLITICA_PRIVACIDADE]
            )

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


@extend_schema(tags=["Aceites de Documentos Legais"])
class AceiteDocumentoLegalViewSet(viewsets.ModelViewSet):
    serializer_class = AceiteDocumentoLegalSerializer
    permission_classes = [IsAuthenticated]
    lookup_value_regex = "[0-9]+"

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return AceiteDocumentoLegal.objects.none()

        return AceiteDocumentoLegal.objects.filter(user=self.request.user)


@extend_schema(tags=["Clientes"])
class ClienteViewSet(viewsets.ModelViewSet):
    serializer_class = ClienteSerializer
    permission_classes = [IsAuthenticated]
    lookup_value_regex = "[0-9]+"

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Cliente.objects.none()

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
    lookup_value_regex = "[0-9]+"

    def _base_queryset(self):
        return (
            Bartender.objects
            .select_related("user")
            .prefetch_related("drinks")
            .annotate(
                media_avaliacoes_calc=Coalesce(
                    models.Avg(
                        "pedidos__avaliacao__nota",
                        filter=models.Q(
                            pedidos__status=PedidoStatus.CONCLUIDO,
                            pedidos__avaliacao__isnull=False,
                        ),
                    ),
                    models.Value(0.0),
                    output_field=models.FloatField(),
                ),
                total_avaliacoes_calc=models.Count(
                    "pedidos__avaliacao",
                    filter=models.Q(
                        pedidos__status=PedidoStatus.CONCLUIDO,
                        pedidos__avaliacao__isnull=False,
                    ),
                    distinct=True,
                ),
            )
            .order_by("-media_avaliacoes_calc", "-total_avaliacoes_calc", "-criado_em")
        )

    def get_queryset(self):
        user = self.request.user

        if not user.is_authenticated:
            return self._base_queryset()

        if user.is_staff or user.tipo == TipoUsuario.CLIENTE:
            return self._base_queryset()

        return self._base_queryset().filter(user=user)
    
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
    lookup_value_regex = "[0-9]+"

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Drink.objects.none()

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
    lookup_value_regex = "[0-9]+"

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Evento.objects.none()

        user = self.request.user
        if user.is_staff:
            return Evento.objects.select_related('cliente').all()
        return Evento.objects.filter(cliente__user=user).select_related('cliente')
    
    def perform_create(self, serializer):
        cliente = Cliente.objects.get(user=self.request.user)
        serializer.save(cliente=cliente)
        
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
    lookup_value_regex = "[0-9]+"

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Pedido.objects.none()

        user = self.request.user
        queryset = Pedido.objects.select_related(
            'cliente__user',
            'bartender__user',
            'evento',
            'pagamento',
        ).prefetch_related('propostas').order_by('-criado_em')
        if user.is_staff:
            return queryset
        # clientes veem pedidos em que são clientes; bartenders veem pedidos onde são bartenders
        if user.tipo == TipoUsuario.CLIENTE:
            return queryset.filter(cliente__user=user)
        return queryset.filter(bartender__user=user)

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


    @extend_schema(
        summary="Confirmar presenca do bartender",
        description="Cliente dono do pedido confirma que o bartender compareceu. Se houver pagamento autorizado, tenta liberar/capturar.",
        request=PresencaPedidoRequestSerializer,
        responses=PedidoSerializer,
    )
    @action(detail=True, methods=['post'], url_path='confirmar-presenca')
    def confirmar_presenca(self, request, pk=None):
        pedido = self.get_object()
        serializer = PresencaPedidoRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            pedido = stripe_service.confirmar_presenca_pedido(
                pedido.id,
                request.user,
                observacao=serializer.validated_data.get('observacao', ''),
            )
        except PermissionError as e:
            return Response({'detail': str(e)}, status=status.HTTP_403_FORBIDDEN)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(PedidoSerializer(pedido, context={'request': request}).data)

    @extend_schema(
        summary="Registrar ausencia do bartender",
        description="Cliente dono do pedido informa que o bartender nao compareceu. Bloqueia liberacao/captura futura.",
        request=PresencaPedidoRequestSerializer,
        responses=PedidoSerializer,
    )
    @action(detail=True, methods=['post'], url_path='registrar-ausencia')
    def registrar_ausencia(self, request, pk=None):
        pedido = self.get_object()
        serializer = PresencaPedidoRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            pedido = stripe_service.registrar_ausencia_pedido(
                pedido.id,
                request.user,
                observacao=serializer.validated_data.get('observacao', ''),
            )
        except PermissionError as e:
            return Response({'detail': str(e)}, status=status.HTTP_403_FORBIDDEN)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(PedidoSerializer(pedido, context={'request': request}).data)

    @extend_schema(
        summary="Visualizar solicitacao de reembolso atual do pedido",
        description="Cliente dono do pedido visualiza a solicitacao mais recente criada apos registro de ausencia.",
        responses=SolicitacaoReembolsoSerializer,
    )
    @action(detail=True, methods=['get'], url_path='solicitacao-reembolso')
    def solicitacao_reembolso(self, request, pk=None):
        pedido = self.get_object()

        if not hasattr(request.user, "cliente") or pedido.cliente.user_id != request.user.id:
            return Response(
                {'detail': 'Apenas o cliente dono do pedido pode visualizar esta solicitacao'},
                status=status.HTTP_403_FORBIDDEN,
            )

        solicitacao = (
            SolicitacaoReembolso.objects
            .select_related(
                'pedido',
                'pagamento',
                'cliente__user',
                'bartender__user',
                'decidido_por',
            )
            .filter(pedido=pedido)
            .order_by('-criado_em')
            .first()
        )

        if not solicitacao:
            return Response(
                {'detail': 'Solicitacao de reembolso nao encontrada'},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(SolicitacaoReembolsoSerializer(solicitacao, context={'request': request}).data)


@extend_schema(tags=["Solicitacoes de Reembolso"])
class SolicitacaoReembolsoViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SolicitacaoReembolsoSerializer
    permission_classes = [IsAuthenticated]
    lookup_value_regex = "[0-9]+"

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return SolicitacaoReembolso.objects.none()

        queryset = (
            SolicitacaoReembolso.objects
            .select_related(
                'pedido',
                'pagamento',
                'cliente__user',
                'bartender__user',
                'decidido_por',
            )
            .order_by('-criado_em')
        )

        user = self.request.user
        if user.is_staff:
            return queryset

        if getattr(user, 'tipo', None) == TipoUsuario.CLIENTE:
            return queryset.filter(cliente__user=user)

        if getattr(user, 'tipo', None) == TipoUsuario.BARTENDER:
            return queryset.filter(bartender__user=user)

        return queryset.none()

    def list(self, request, *args, **kwargs):
        if not request.user.is_staff:
            return Response(
                {'detail': 'Apenas administradores podem listar solicitacoes de reembolso'},
                status=status.HTTP_403_FORBIDDEN,
            )

        return super().list(request, *args, **kwargs)

    @extend_schema(
        summary="Bartender responde ou contesta solicitacao de reembolso",
        request=ResponderSolicitacaoReembolsoRequestSerializer,
        responses=SolicitacaoReembolsoSerializer,
    )
    @action(detail=True, methods=['post'], url_path='responder')
    def responder(self, request, pk=None):
        self.get_object()
        serializer = ResponderSolicitacaoReembolsoRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            solicitacao = reembolso_service.responder_solicitacao(
                pk,
                request.user,
                resposta=serializer.validated_data['resposta'],
            )
        except PermissionError as e:
            return Response({'detail': str(e)}, status=status.HTTP_403_FORBIDDEN)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(SolicitacaoReembolsoSerializer(solicitacao, context={'request': request}).data)

    @extend_schema(
        summary="Admin aprova solicitacao de reembolso",
        request=DecidirSolicitacaoReembolsoRequestSerializer,
        responses=SolicitacaoReembolsoSerializer,
    )
    @action(detail=True, methods=['post'], url_path='aprovar')
    def aprovar(self, request, pk=None):
        self.get_object()
        serializer = DecidirSolicitacaoReembolsoRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            solicitacao = reembolso_service.aprovar_solicitacao(
                pk,
                request.user,
                decisao_admin=serializer.validated_data['decisao_admin'],
                valor_aprovado=serializer.validated_data.get('valor_aprovado'),
            )
        except PermissionError as e:
            return Response({'detail': str(e)}, status=status.HTTP_403_FORBIDDEN)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(SolicitacaoReembolsoSerializer(solicitacao, context={'request': request}).data)

    @extend_schema(
        summary="Admin nega solicitacao de reembolso",
        request=DecidirSolicitacaoReembolsoRequestSerializer,
        responses=SolicitacaoReembolsoSerializer,
    )
    @action(detail=True, methods=['post'], url_path='negar')
    def negar(self, request, pk=None):
        self.get_object()
        serializer = DecidirSolicitacaoReembolsoRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            solicitacao = reembolso_service.negar_solicitacao(
                pk,
                request.user,
                decisao_admin=serializer.validated_data['decisao_admin'],
            )
        except PermissionError as e:
            return Response({'detail': str(e)}, status=status.HTTP_403_FORBIDDEN)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(SolicitacaoReembolsoSerializer(solicitacao, context={'request': request}).data)

    @extend_schema(
        summary="Admin executa cancelamento de autorizacao aprovado",
        description="Cancela na Stripe apenas PaymentIntent aprovado e ainda nao capturado. Nao cria refund.",
        request=None,
        responses=SolicitacaoReembolsoSerializer,
    )
    @action(detail=True, methods=['post'], url_path='executar-cancelamento')
    def executar_cancelamento(self, request, pk=None):
        self.get_object()

        try:
            solicitacao = reembolso_service.executar_cancelamento_autorizacao(
                pk,
                request.user,
            )
        except PermissionError as e:
            return Response({'detail': str(e)}, status=status.HTTP_403_FORBIDDEN)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        response_status = (
            status.HTTP_400_BAD_REQUEST
            if solicitacao.status == SolicitacaoReembolsoStatus.FALHOU
            else status.HTTP_200_OK
        )
        return Response(
            SolicitacaoReembolsoSerializer(solicitacao, context={'request': request}).data,
            status=response_status,
        )


@extend_schema(tags=["Propostas"])
class PropostaViewSet(viewsets.ModelViewSet):
    serializer_class = PropostaSerializer
    permission_classes = [IsAuthenticated, PropostaParticipantPermission]
    lookup_value_regex = "[0-9]+"

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Proposta.objects.none()

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
            proposta = proposta.accept(request.user)
        except PermissionError as e:
            return Response({"detail": str(e)}, status=status.HTTP_403_FORBIDDEN)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
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
    lookup_value_regex = "[0-9]+"

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Chat.objects.none()

        user = self.request.user
        queryset = Chat.objects.select_related(
            'pedido__cliente__user',
            'pedido__bartender__user',
            'pedido__evento',
        ).prefetch_related('mensagens')
        if user.is_staff:
            return queryset
        return queryset.filter(models.Q(pedido__cliente__user=user) | models.Q(pedido__bartender__user=user))


@extend_schema(tags=["Mensagens"])
class MensagemViewSet(viewsets.ModelViewSet):
    serializer_class = MensagemSerializer
    permission_classes = [IsAuthenticated]
    lookup_value_regex = "[0-9]+"

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Mensagem.objects.none()

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


@extend_schema(tags=["Avaliações"])
class AvaliacaoViewSet(viewsets.ModelViewSet):
    serializer_class = AvaliacaoSerializer
    permission_classes = [IsAuthenticated]
    lookup_value_regex = "[0-9]+"
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Avaliacao.objects.none()

        user = self.request.user
        qs = Avaliacao.objects.select_related(
            'pedido__cliente__user', 'pedido__bartender__user', 'pedido__evento'
        )

        if user.is_staff:
            return qs.all()

        bartender_id = self.request.query_params.get('bartender_id')
        if bartender_id:
            return qs.filter(
                pedido__bartender__user_id=bartender_id,
                pedido__status=PedidoStatus.CONCLUIDO,
            ).order_by('-criado_em')

        if hasattr(user, 'bartender'):
            return qs.filter(
                pedido__bartender__user=user,
                pedido__status=PedidoStatus.CONCLUIDO,
            ).order_by('-criado_em')

        return qs.filter(
            pedido__cliente__user=user,
        ).order_by('-criado_em')

    def perform_create(self, serializer):
        from rest_framework.exceptions import PermissionDenied, ValidationError
        user = self.request.user
        pedido = serializer.validated_data['pedido']

        if pedido.cliente.user != user:
            raise PermissionDenied("Você não tem permissão para avaliar este pedido.")

        if pedido.status != PedidoStatus.CONCLUIDO:
            raise ValidationError({"pedido": "O pedido precisa estar concluído para ser avaliado."})

        if hasattr(pedido, 'avaliacao'):
            raise ValidationError({"pedido": "Este pedido já foi avaliado."})

        serializer.save()
