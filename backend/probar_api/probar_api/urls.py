from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from core.views import CustomTokenView, CustomTokenRefreshView
from .router.api import api_urls
from django.conf import settings
from django.conf.urls.static import static
from core.api.v1.auth_views import GoogleAuthView, GoogleAuthVerifyView

urlpatterns = [
    path('admin/', admin.site.urls),
    path(
        "api/",
        include(
            (api_urls, "myproject.router.api.api_urls"),
            namespace="api"
        ),
    ),
    path(
        'api/token/',
        CustomTokenView.as_view(),
        name='token_obtain_pair'
    ),
    path(
        'api/token/refresh/',
        CustomTokenRefreshView.as_view(),
        name='token_refresh'
    ),
    path('api/auth/google/', GoogleAuthView.as_view(), name='google-auth'),
    path('api/auth/google/verify/', GoogleAuthVerifyView.as_view(), name='google-auth-verify'),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path(
        'api/docs/',
        SpectacularSwaggerView.as_view(url_name='schema'),
        name='swagger-ui'
    ),
    path(
        'api/redoc/',
        SpectacularRedocView.as_view(url_name='schema'),
        name='redoc'
    ),
]
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)