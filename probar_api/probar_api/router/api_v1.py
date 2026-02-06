from django.conf.urls import include
from django.urls import path

# Importar o módulo router para acessar `urlpatterns` (inclui rotas registradas e rotas adicionais)
from core.api.v1 import router as core_router

api_v1_urls = [
    # Incluir todas as rotas do router (viewsets) e também as rotas extras definidas em `urlpatterns`
    path("", include((core_router.urlpatterns, "core"), namespace="core")),
]