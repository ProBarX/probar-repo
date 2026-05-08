# Teste End-to-End do Fluxo de Pagamento (Stripe Test Mode)

Este documento descreve, passo a passo e com comandos práticos, como testar o fluxo completo de pagamento do ProBar em modo de teste com Stripe (PaymentIntent com captura manual + Transfer/Connect + webhooks).

Pré-requisitos
- Código do backend e frontend rodando localmente (ou acessíveis).
- Python 3.8+ e venv configurado no backend.
- `stripe` CLI instalado (recomendado para webhooks locais).
- Chaves Stripe Test: `sk_test_...` (secret) e `pk_test_...` (publishable).

Resumo do fluxo a testar
- Criar um `Pedido` de teste
- Backend cria `PaymentIntent` (capture_method=manual) e grava `Pagamento` PENDENTE
- Frontend (ou CLI) confirma o PaymentIntent → status `requires_capture`
- Captura manual (endpoint) ou captura automática via `processar_pagamentos_pendentes`
- Webhook `payment_intent.succeeded` atualiza `Pagamento` e `Pedido` para `PAGO`

Como o metodo de pagamento e registrado
- `metodo_pagamento`: gateway interno (atualmente `STRIPE`).
- `stripe_payment_method_type`: metodo real usado na Stripe (ex.: `card`, `pix`, `boleto`).
  Esse valor e preenchido quando o PaymentIntent e consultado (captura, job ou webhook).

Estrutura deste guia
- Preparar ambiente (env vars, venv)
- Rodar backend e Stripe CLI (encaminhar webhooks)
- Criar dados de teste (usuário/pedido)
- Criar PaymentIntent via endpoint backend
- Confirmar PaymentIntent (Stripe CLI ou frontend)
- Capturar pagamento (manual e automático)
- Verificar resultados no DB e Stripe Dashboard
- Troubleshooting comum

1) Preparar variáveis de ambiente (PowerShell)

Abra PowerShell e dentro do venv do projeto (ou no host onde o backend roda) defina:

```powershell
$env:STRIPE_SECRET_KEY="sk_test_xxx"
$env:STRIPE_PUBLISHABLE_KEY="pk_test_xxx"
# O STRIPE_WEBHOOK_SECRET será definido após iniciar `stripe listen` (veja abaixo)
```

No Linux/macOS (bash):

```bash
export STRIPE_SECRET_KEY="sk_test_xxx"
export STRIPE_PUBLISHABLE_KEY="pk_test_xxx"
```

2) Ativar ambiente Python e rodar migrations

```powershell
cd C:\Users\Admin\OneDrive\Documentos\P5\probar\backend\probar_api
.\venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
```

3) Instalar e usar Stripe CLI para webhooks

- Instale a CLI: https://stripe.com/docs/stripe-cli#install
- Faça login e inicie o listener (PowerShell):

```powershell
stripe login
stripe listen --forward-to http://localhost:8000/api/v1/stripe/webhook/ --print-secret
```

O comando exibirá `Webhook signing secret for local endpoints: whsec_xxx`. Copie esse `whsec_xxx` e exporte:

```powershell
$env:STRIPE_WEBHOOK_SECRET="whsec_xxx"
```

Observação: `stripe listen` ficará rodando e encaminhará todos os eventos do seu workspace Stripe (test mode) para o endpoint local.

4) Rodar o backend local

No mesmo ambiente onde exportou as variáveis:

```powershell
# ainda no venv
python manage.py runserver 0.0.0.0:8000
```

5) Criar dados de teste (usar API ou Django shell)

Opção A — via endpoints do seu app (recomendado se o frontend existir): utilize a UI de teste do frontend para registrar cliente, bartender e criar pedido.

Opção B — shell Django (rápido):

```powershell
python manage.py shell
# Exemplo (ajuste nomes de campos conforme modelo do seu projeto):
from django.contrib.auth import get_user_model
from core.models import Pedido, Evento
User = get_user_model()
cliente = User.objects.create_user(username='cli_test', email='cli@test', password='senha')
# criar bartender e evento de exemplo — adaptar conforme modelos
bartender = User.objects.create_user(username='bar_test', email='bar@test', password='senha')
evento = Evento.objects.create(bartender=bartender, hora_fim=timezone.now())
pedido = Pedido.objects.create(cliente=cliente, evento=evento, valor_total_aprovado=10000, status='ACEITO')
print(pedido.id)
exit()
```

6) Criar PaymentIntent via endpoint backend

Faça a requisição para `POST /api/v1/stripe/pagar/{pedido_id}/` (substitua token/headers conforme autenticação do seu projeto):

```powershell
curl -X POST http://localhost:8000/api/v1/stripe/pagar/1/ -H "Authorization: Token <USER_TOKEN>" -H "Content-Type: application/json"
```

A resposta deve conter `client_secret` e/ou `payment_intent` id. O backend grava um `Pagamento` em `PENDENTE`.

7) Confirmar o PaymentIntent (simular frontend)

Opção A — Stripe CLI (rápida, sem frontend):

```powershell
# supondo que o id do PaymentIntent seja pi_xxx
stripe payment_intents confirm pi_xxx --payment_method pm_card_visa
```

Opção B — usar Stripe.js no frontend (padrão):

```js
// exemplo em frontend com client_secret
const res = await stripe.confirmCardPayment(client_secret, {
  payment_method: {
    card: cardElement,
    billing_details: { name: 'Teste' }
  }
});
```

Cartões de teste úteis (Test Mode):

- `4242 4242 4242 4242` — sucesso
- `4000 0000 0000 9995` — falha (payment_failed)

Após confirmação o PaymentIntent deve ficar em `requires_capture` (por capture_method=manual). Se estiver `requires_payment_method`, o cliente não completou a confirmação.

8) Captura do pagamento

8.1 Captura manual (via endpoint)

```powershell
curl -X POST http://localhost:8000/api/v1/stripe/capturar/<pagamento_id>/ -H "Authorization: Token <USER_TOKEN>"
```

Após executar, verifique que `Pagamento.status` mudou para `PAGO` e `Pedido.status` também. O webhook `payment_intent.succeeded` também será recebido (stripe CLI encaminha), mas sua aplicação já marca `PAGO` ao capturar.

8.2 Captura automática (job)

Para simular a captura automática ajuste o `evento.hora_fim` no DB para uma data há mais de 2 horas. Depois rode:

```powershell
python manage.py processar_pagamentos_pendentes
```

Verifique o log:

```powershell
Get-Content .\\logs\\pagamentos_cron.log -Tail 200
```

9) Verificar no Stripe Dashboard (Test mode)

- Acesse https://dashboard.stripe.com/test
- Busque pelo `PaymentIntent` (pi_xxx) e verifique `Status`, `Charges`, e em Connect verifique `Transfer` / `Application fee` (se estiver usando fees). As transfers aparecerão na conta do bartender de teste.

10) Testar webhooks manualmente (opcional)

Com Stripe CLI você pode reenviar ou acionar eventos:

```powershell
stripe trigger payment_intent.succeeded
# ou reenviar um evento que o CLI recebeu:
stripe events resend evt_xxx
```

11) Verificações finais no banco

```powershell
python manage.py shell
from core.models import Pagamento, Pedido
print(Pagamento.objects.filter(pedido=1).values())
print(Pedido.objects.get(pk=1).status)
exit()
```

12) Troubleshooting rápido
- Webhook 400: verifique `STRIPE_WEBHOOK_SECRET` e se `stripe listen` está rodando. Confirme que o header `Stripe-Signature` é repassado corretamente.
- PaymentIntent em `requires_payment_method`: cliente não confirmou; reexecute a confirmação (Stripe CLI ou frontend).
- Capture retorna erro `cannot be captured`: verifique `payment_intent.status` (só capture `requires_capture`).
- Sem Transfer/fee no Dashboard: em Connect, confirme que o `transfer_data.destination` foi setado para a conta de teste do bartender.

13) (Opcional) Script de automação — ideias
- Um script Python utilizando `requests` para chamar seu endpoint de criar pagamento, `stripe` Python SDK para confirmar o PaymentIntent (ou `stripe-cli` via subprocess), e depois chamar `processar_pagamentos_pendentes` via `manage.py` e validar objetos no DB.

Exemplo de checklist para executar agora
1. Exportar `STRIPE_SECRET_KEY`.
2. `stripe login && stripe listen --forward-to http://localhost:8000/api/v1/stripe/webhook/ --print-secret` e exportar `STRIPE_WEBHOOK_SECRET`.
3. Rodar `python manage.py runserver`.
4. Criar pedido teste (ou pelo frontend).
5. `POST /api/v1/stripe/pagar/{pedido_id}` → copiar `pi_xxx`.
6. `stripe payment_intents confirm pi_xxx --payment_method pm_card_visa`.
7. Chamar endpoint de captura manual ou rodar `processar_pagamentos_pendentes`.
8. Verificar logs e Stripe Dashboard.

Se quiser, eu posso gerar o script Python de integração que executa os passos 5→8 automaticamente e executá‑lo no seu ambiente. Deseja que eu gere esse script agora?
