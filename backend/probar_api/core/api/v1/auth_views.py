from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from django.db import transaction
from django.core.files.base import ContentFile
from django.db import models as dj_models
import requests as _requests
from drf_spectacular.utils import extend_schema
from core.api.v1.auth_serializers import GoogleAuthSerializer
from core.services.google_auth import verify_google_id_token
from core.models import Cliente, Bartender, DocumentoLegal, AceiteDocumentoLegal
from core.enums import TipoDocumentoLegal, TipoUsuario
from core.api.v1.auth_serializers import GoogleVerifySerializer


def get_client_ip(request):
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()

    return request.META.get("REMOTE_ADDR")


def documentos_obrigatorios_para_tipo(tipo_usuario):
    tipo_termos = (
        TipoDocumentoLegal.TERMOS_BARTENDER
        if tipo_usuario == TipoUsuario.BARTENDER
        else TipoDocumentoLegal.TERMOS_CLIENTE
    )

    return DocumentoLegal.objects.filter(
        esta_ativo=True,
        tipo__in=[tipo_termos, TipoDocumentoLegal.POLITICA_PRIVACIDADE],
    )

@extend_schema(tags=["Autenticação via Google"], request=GoogleAuthSerializer, responses={200: None})
class GoogleAuthView(APIView):
    """Endpoint para autenticação social via Google.

    POST /api/auth/google/
    Payload: { id_token: str, tipo_usuario: 'cliente'|'bartender' }
    """
    authentication_classes = []
    permission_classes = []

    @transaction.atomic
    def post(self, request):
        serializer = GoogleAuthSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        id_token_str = data['id_token']
        tipo_usuario = data.get('tipo_usuario', None)
        documentos_legais_ids = request.data.get('documentos_legais_ids')

        try:
            info = verify_google_id_token(id_token_str)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        email = info.get('email')
        name = info.get('name')
        picture = info.get('picture')

        if not email:
            return Response({'detail': 'Email não presente no token do Google.'}, status=status.HTTP_400_BAD_REQUEST)

        User = get_user_model()
        user = User.objects.filter(email=email).first()
        created = False
        if not user:
            # para criar usuário precisamos do tipo; se não foi fornecido, informar erro
            if not tipo_usuario:
                return Response({'detail': 'tipo_required'}, status=status.HTTP_400_BAD_REQUEST)
            # cria usuário sem senha (provedor externo)
            obrigatorios = list(documentos_obrigatorios_para_tipo(tipo_usuario))
            obrigatorios_ids = {documento.id for documento in obrigatorios}
            documentos_informados = set(documentos_legais_ids or [])

            if len(obrigatorios_ids) < 2:
                return Response(
                    {'detail': 'Documentos legais obrigatórios não estão configurados.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if obrigatorios_ids - documentos_informados:
                return Response(
                    {'detail': 'É necessário aceitar os termos de uso aplicáveis e a política de privacidade vigentes.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            user = User(email=email, name=name or '', tipo=tipo_usuario)
            user.set_unusable_password()
            user.save()
            for documento in obrigatorios:
                AceiteDocumentoLegal.objects.create(
                    user=user,
                    documento=documento,
                    origem="cadastro_google",
                    ip=get_client_ip(request),
                    user_agent=request.META.get("HTTP_USER_AGENT", ""),
                )
            created = True
        else:
            # atualiza nome se vazio
            updated = False
            if not getattr(user, 'name', '') and name:
                user.name = name
                updated = True
            if updated:
                user.save()

        # tenta popular foto no perfil relacionado (se existir campo foto_perfil)
        profile = None
        if tipo_usuario == 'cliente':
            profile = Cliente.objects.filter(user=user).first()
        else:
            profile = Bartender.objects.filter(user=user).first()

        if profile and picture and hasattr(profile, 'foto_perfil'):
            try:
                field = None
                try:
                    field = profile._meta.get_field('foto_perfil')
                except Exception:
                    field = None

                # Se for ImageField/FileField, baixamos e salvamos corretamente
                if field and isinstance(field, (dj_models.ImageField, dj_models.FileField)):
                    resp = _requests.get(picture, timeout=10)
                    if resp.status_code == 200:
                        # gera nome simples a partir do email
                        filename = f"{user.email.split('@')[0]}_google.jpg"
                        profile.foto_perfil.save(filename, ContentFile(resp.content), save=True)
                else:
                    # caso o campo seja CharField/TextField que armazena URL
                    setattr(profile, 'foto_perfil', picture)
                    profile.save()
            except Exception:
                # não falha a autenticação por causa da foto
                pass

        # gera tokens JWT com SimpleJWT
        refresh = RefreshToken.for_user(user)
        refresh['tipo'] = user.tipo
        access = refresh.access_token
        access['tipo'] = user.tipo

        return Response({
            'access': str(access),
            'refresh': str(refresh),
            'tipo': user.tipo,
            'created': created,
        }, status=status.HTTP_200_OK)


@extend_schema(tags=["Autenticação via Google"], request=GoogleVerifySerializer, responses={200: None})
class GoogleAuthVerifyView(APIView):
    """Verifica id_token do Google e retorna se o usuário já existe.

    POST /api/auth/google/verify/
    Payload: { id_token: str }
    Retorno: { exists: bool, email, name, picture }
    """
    authentication_classes = []
    permission_classes = []

    @extend_schema(
        summary="Verificar token do Google",
        description="Verifica o token do Google e retorna informações sobre o usuário.",
        responses=GoogleVerifySerializer,
    )
    def post(self, request):
        serializer = GoogleVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        id_token_str = serializer.validated_data['id_token']

        try:
            info = verify_google_id_token(id_token_str)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        email = info.get('email')
        name = info.get('name')
        picture = info.get('picture')

        User = get_user_model()
        exists = User.objects.filter(email=email).exists()

        return Response({
            'exists': exists,
            'email': email,
            'name': name,
            'picture': picture,
        }, status=status.HTTP_200_OK)
