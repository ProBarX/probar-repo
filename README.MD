# ProBarAPI — Como preparar e rodar (Windows / PowerShell)

Este guia mostra os passos mínimos para preparar o ambiente e executar o projeto localmente.


Pré-requisitos
- Python 3.11+ instalado e disponível no `PATH`.
- Git para clonar o repositório.

Passos rápidos

1) Clone o repositório:
```powershell
git clone https://github.com/ProBarX/probar-api.git
```

2) Criar e ativar um ambiente virtual (PowerShell):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

3) Entre na pasta do projeto (onde está `manage.py`):

```powershell
cd probar_api
```

4) Instale as dependências:

```powershell
pip install -r requirements.txt
```

5) Configurar variáveis de ambiente (.env):

```powershell
copy .env.example .env
```

Edite ` .env` e defina as variáveis necessárias. Nunca versionar chaves reais.

6) Aplique as migrações e crie um super usuário(opcional):

```powershell
python manage.py migrate
python manage.py createsuperuser (caso queira acessar o painel de admin)
```

7) Rodar servidor de desenvolvimento:

```powershell
python manage.py runserver
```

Abra `http://127.0.0.1:8000/` no navegador.

- Endpoints importantes:
	- Admin: /admin/
	- JWT: /api/token/ e /api/token/refresh/
	- OpenAPI: /api/schema/
	- Swagger UI: /api/docs/
	- Redoc: /api/redoc/
	- API v1 base: /api/v1/

