from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from django.db import transaction
from django.core.files.base import ContentFile
from django.db import models as dj_models
import requests as _requests

from core.api.v1.auth_serializers import GoogleAuthSerializer
from core.services.google_auth import verify_google_id_token
from core.models import Cliente, Bartender
from core.api.v1.auth_serializers import GoogleVerifySerializer


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
            user = User(email=email, name=name or '', tipo=tipo_usuario)
            user.set_unusable_password()
            user.save()
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


class GoogleAuthVerifyView(APIView):
    """Verifica id_token do Google e retorna se o usuário já existe.

    POST /api/auth/google/verify/
    Payload: { id_token: str }
    Retorno: { exists: bool, email, name, picture }
    """
    authentication_classes = []
    permission_classes = []

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
