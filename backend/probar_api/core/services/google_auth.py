from google.oauth2 import id_token
from google.auth.transport import requests
from django.conf import settings


def verify_google_id_token(id_token_str: str) -> dict:
    """Verifica o id_token recebido do cliente usando google-auth.

    Retorna um dict com as chaves: email, name, picture.
    Lança ValueError em caso de token inválido ou ausência de email.
    """
    try:
        request = requests.Request()
        client_id = getattr(settings, 'GOOGLE_CLIENT_ID', None)
        if client_id:
            idinfo = id_token.verify_oauth2_token(id_token_str, request, client_id)
        else:
            # sem client_id a verificação ainda acontece, mas sem checar audience
            idinfo = id_token.verify_oauth2_token(id_token_str, request)

        email = idinfo.get('email')
        if not email:
            raise ValueError('Token do Google não contém email')

        return {
            'email': email,
            'name': idinfo.get('name', ''),
            'picture': idinfo.get('picture')
        }
    except ValueError as e:
        # erros de verificação do google
        raise ValueError(f'Token inválido: {e}')
    except Exception as e:
        raise ValueError(f'Erro ao validar token do Google: {e}')
