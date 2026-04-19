import pytest
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.contrib.auth.password_validation import validate_password
from core.models import User
from core.api.v1.serializers import UserSerializer
from core.auth import CustomTokenSerializer


class TestAuthUnit:
    """Testes unitários para regras de Login e Cadastro.
    Cobrem validação de email, regra de tamanho de senha,
    criação de usuário via `UserSerializer` e validação de login
    via `CustomTokenSerializer`.
    """
    
    def test_valid_email_accepts_correct_email(self):
        # validação de e-mail usando o validador do Django
        valid = "email@exemplo.com"

        validate_email(valid)


    def test_invalid_email_rejected(self): 
        # e-mails sem formato correto devem levantar ValidationError
        with pytest.raises(ValidationError): 
            validate_email("nao-e-um-email")


    def test_valid_password_length_and_security(self):
        # senha com 8 caracteres ou mais não deve levantar erro
        assert validate_password("ss21567o") is None # senha com 8 caracteres ou e segura mais deve ser aceita

    def test_invalid_password_too_short(self):
        with pytest.raises(ValidationError):
            validate_password("senha12") # senha com menos de 8 caracteres ou fraca deve levantar ValidationError


    @pytest.mark.django_db
    def test_user_serializer_create_hashes_password(self):
        payload = {
            "email": "Teste@exemplo.com",
            "password": "minhasenha123",
            "name": "Teste",
            "tipo": "cliente",
        }

        serializer = UserSerializer(data=payload)
        assert serializer.is_valid(), serializer.errors

        user = serializer.save()

        assert user.email == payload["email"]
        assert user.check_password(payload["password"]) is True


    @pytest.mark.django_db
    def test_custom_token_serializer_returns_tipo_on_valid_credentials(self):
        """Testa se o CustomTokenSerializer retorna o campo 'tipo' quando as credenciais são válidas."""
        email = "token@exemplo.com"
        password = "tokenpass123"

        User.objects.create_user(
            email=email, 
            password=password, 
            name="Token User", 
            tipo="cliente"
        )

        serializer = CustomTokenSerializer(
            data={"email": email, "password": password}
        )
        assert serializer.is_valid(), serializer.errors

        validated = serializer.validated_data
        # TokenObtainPairSerializer retorna access/refresh
        assert "access" in validated and "refresh" in validated
        # CustomTokenSerializer adiciona o campo 'tipo'
        assert validated.get("tipo") == "cliente"
