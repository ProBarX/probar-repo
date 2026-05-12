import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("STRIPE_SECRET_KEY", "sk_test_dummy")
os.environ.setdefault("STRIPE_RETURN_URL", "http://localhost/stripe/return")
os.environ.setdefault("STRIPE_REFRESH_URL", "http://localhost/stripe/refresh")
os.environ.setdefault("STRIPE_PLATFORM_FEE_PERCENT", "10")
os.environ.setdefault("ALLOWED_HOSTS", "localhost,127.0.0.1,testserver")
os.environ.setdefault("CORS_ALLOWED_ORIGINS", "http://localhost:3000")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from .settings import *  # noqa: F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

