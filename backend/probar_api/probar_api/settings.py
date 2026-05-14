from pathlib import Path
from datetime import timedelta
import os
import sys
import environ
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent


env = environ.Env(
    DEBUG=(bool, False)
)
environ.Env.read_env(os.path.join(BASE_DIR, '.env'))


SECRET_KEY = env('SECRET_KEY')


STRIPE_SECRET_KEY = env('STRIPE_SECRET_KEY')
STRIPE_RETURN_URL = env('STRIPE_RETURN_URL')
STRIPE_REFRESH_URL = env('STRIPE_REFRESH_URL')
STRIPE_PLATFORM_FEE_PERCENT = env('STRIPE_PLATFORM_FEE_PERCENT')
STRIPE_WEBHOOK_SECRET = env('STRIPE_WEBHOOK_SECRET', default='')
STRIPE_MANUAL_CAPTURE_WINDOW_DAYS = env.int('STRIPE_MANUAL_CAPTURE_WINDOW_DAYS', default=5)


DEBUG = env('DEBUG')


ALLOWED_HOSTS = env.list('ALLOWED_HOSTS')


LOCAL_APPS = [
    'core',
]


INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'drf_spectacular',
    'drf_spectacular_sidecar',
    'corsheaders',
] + LOCAL_APPS


REST_FRAMEWORK = {
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 12,    

    'DATE_FORMAT': '%d/%m/%Y', # formato de data 
    'TIME_FORMAT': '%H:%M', # formato de hora
    # formatos de entrada para data e hora, incluindo ISO 8601
    'DATE_INPUT_FORMATS': ['%d/%m/%Y', 'iso-8601'],
    'TIME_INPUT_FORMATS': ['%H:%M', 'iso-8601'],
}


SIMPLE_JWT = {
    "AUTH_HEADER_TYPES": ("Bearer",),
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=10),
    "REFRESH_TOKEN_LIFETIME": timedelta(hours=24),
}

# Client ID usado para validação dos id_tokens do Google (opcional, mas recomendado)
GOOGLE_CLIENT_ID = env('GOOGLE_CLIENT_ID', default=None)

SPECTACULAR_SETTINGS = {
    'TITLE': 'API ProBar',
    'DESCRIPTION': 'Documentação da API oficial do ProBar - Sistema para intermediar clientes e bartenders.',
    'VERSION': '1.0.0',

    'SWAGGER_UI_SETTINGS': {
        'deepLinking': True,
        'displayOperationId': False,
        'defaultModelsExpandDepth': -1,  
        'defaultModelExpandDepth': 2,
        'persistAuthorization': True,
    },

    'SWAGGER_UI_DIST': 'SIDECAR',  

    'SORT_TAGS': False,
    'TAGS': [
        {'name': 'Autenticação'},
        {'name': 'Autenticação via Google'},
        {'name': 'Usuários'},
        {'name': 'Clientes'},
        {'name': 'Bartenders'},
        {'name': 'Drinks'},
        {'name': 'Eventos'},
        {'name': 'Pedidos'},
        {'name': 'Chats'},
        {'name': 'Propostas'},
        {'name': 'Mensagens'},
        {'name': 'Termos'},
        {'name': 'Aceite Termos'},
    ],
}

CORS_ALLOWED_ORIGINS = env.list('CORS_ALLOWED_ORIGINS')


# modelo de usuário customizado
AUTH_USER_MODEL = 'core.User'

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    "whitenoise.middleware.WhiteNoiseMiddleware",
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'probar_api.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'probar_api.wsgi.application'

env = environ.Env()
environ.Env.read_env(os.path.join(BASE_DIR, ".env"))

DATABASES = {
    'default': dj_database_url.config(default=env('DATABASE_URL'))
}


AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]



LANGUAGE_CODE = 'pt-br'

TIME_ZONE = 'America/Recife'

USE_I18N = True

USE_TZ = True


STATIC_URL = "/static/"
STATIC_ROOT = os.path.join(BASE_DIR, "staticfiles")

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

SUPABASE_STORAGE_BUCKET = env("SUPABASE_STORAGE_BUCKET", default="")
SUPABASE_S3_ENDPOINT = env("SUPABASE_S3_ENDPOINT", default="")
SUPABASE_S3_REGION = env("SUPABASE_S3_REGION", default="")
SUPABASE_S3_ACCESS_KEY_ID = env("SUPABASE_S3_ACCESS_KEY_ID", default="")
SUPABASE_S3_SECRET_ACCESS_KEY = env("SUPABASE_S3_SECRET_ACCESS_KEY", default="")
SUPABASE_PUBLIC_STORAGE_URL = env("SUPABASE_PUBLIC_STORAGE_URL", default="")
USE_SUPABASE_STORAGE = env.bool(
    "USE_SUPABASE_STORAGE",
    default=all(
        [
            SUPABASE_STORAGE_BUCKET,
            SUPABASE_S3_ENDPOINT,
            SUPABASE_S3_REGION,
            SUPABASE_S3_ACCESS_KEY_ID,
            SUPABASE_S3_SECRET_ACCESS_KEY,
            SUPABASE_PUBLIC_STORAGE_URL,
        ]
    ),
)

if USE_SUPABASE_STORAGE:
    missing_supabase_storage_settings = [
        name
        for name, value in {
            "SUPABASE_STORAGE_BUCKET": SUPABASE_STORAGE_BUCKET,
            "SUPABASE_S3_ENDPOINT": SUPABASE_S3_ENDPOINT,
            "SUPABASE_S3_REGION": SUPABASE_S3_REGION,
            "SUPABASE_S3_ACCESS_KEY_ID": SUPABASE_S3_ACCESS_KEY_ID,
            "SUPABASE_S3_SECRET_ACCESS_KEY": SUPABASE_S3_SECRET_ACCESS_KEY,
            "SUPABASE_PUBLIC_STORAGE_URL": SUPABASE_PUBLIC_STORAGE_URL,
        }.items()
        if not value
    ]
    if missing_supabase_storage_settings:
        raise RuntimeError(
            "Supabase Storage esta habilitado, mas faltam variaveis: "
            + ", ".join(missing_supabase_storage_settings)
        )

    MEDIA_URL = f"{SUPABASE_PUBLIC_STORAGE_URL.rstrip('/')}/"

    STORAGES = {
        "default": {
            "BACKEND": "core.storage_backends.SupabaseMediaStorage",
            "OPTIONS": {
                "bucket_name": SUPABASE_STORAGE_BUCKET,
                "endpoint_url": SUPABASE_S3_ENDPOINT,
                "region_name": SUPABASE_S3_REGION,
                "access_key": SUPABASE_S3_ACCESS_KEY_ID,
                "secret_key": SUPABASE_S3_SECRET_ACCESS_KEY,
                "addressing_style": "path",
                "signature_version": "s3v4",
                "file_overwrite": False,
                "querystring_auth": False,
                "default_acl": None,
            },
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
        },
    }
else:
    STORAGES = {
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
        },
    }

LOCAL_HOSTS = {"127.0.0.1", "localhost"}
IS_LOCAL_DEVELOPMENT = any(host in LOCAL_HOSTS for host in ALLOWED_HOSTS)
SERVE_MEDIA_FILES = env.bool(
    "SERVE_MEDIA_FILES",
    default=not USE_SUPABASE_STORAGE and (DEBUG or "runserver" in sys.argv or IS_LOCAL_DEVELOPMENT),
)

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
