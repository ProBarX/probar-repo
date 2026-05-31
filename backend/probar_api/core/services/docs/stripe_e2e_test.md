# Guia de teste E2E - Pagamento Stripe ProBar

Este guia descreve como testar o fluxo atual de pagamento do ProBar em modo de
teste. Ele cobre PaymentIntent com captura manual, SetupIntent para pagamento
futuro, confirmacao de presenca, ausencia, bloqueio de captura, liberacao
automatica e cancelamento de autorizacao aprovado.

O guia nao cobre Pix nem refund/reversal real de pagamento capturado, pois essas
partes ainda nao estao implementadas.

## Pre-requisitos

- Backend Django rodando.
- Frontend Next.js rodando.
- Banco migrado.
- Stripe em modo teste.
- Stripe CLI instalada para webhooks locais.
- Bartender com conta Stripe Express de teste e onboarding completo.
- Pedido com proposta aceita.

Variaveis principais:

Backend:

```powershell
$env:STRIPE_SECRET_KEY="sk_test_xxx"
$env:STRIPE_WEBHOOK_SECRET="whsec_xxx"
$env:STRIPE_RETURN_URL="http://localhost:3000/bartender/home"
$env:STRIPE_REFRESH_URL="http://localhost:3000/bartender/home"
$env:STRIPE_PLATFORM_FEE_PERCENT="10"
$env:STRIPE_MANUAL_CAPTURE_WINDOW_DAYS="5"
```

Frontend:

```powershell
$env:NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_xxx"
$env:NEXT_PUBLIC_API_BASE_URL="http://127.0.0.1:8000/api/v1"
```

Em producao, `NEXT_PUBLIC_API_BASE_URL` nao pode apontar para `127.0.0.1`.

## Rodar backend

```powershell
cd C:\Users\Admin\OneDrive\Documentos\P5\probar\backend\probar_api
.\venv\Scripts\activate
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

## Rodar frontend

```powershell
cd C:\Users\Admin\OneDrive\Documentos\P5\probar\frontend\probar_app
npm run dev
```

## Rodar Stripe CLI

Em outro terminal:

```powershell
stripe login
stripe listen --forward-to http://localhost:8000/api/v1/stripe/webhook/ --print-secret
```

Copie o `whsec_xxx` retornado e configure `STRIPE_WEBHOOK_SECRET` no ambiente do
backend antes de iniciar o servidor.

## Cartoes de teste

Use os cartoes de teste da Stripe no Payment Element.

Casos comuns:

- `4242 4242 4242 4242`: pagamento aprovado.
- `4000 0000 0000 9995`: falha de pagamento.

Use data futura, CVC qualquer e CEP valido quando solicitado.

## Dados necessarios para testar

1. Usuario cliente autenticado.
2. Usuario bartender autenticado.
3. Bartender com:
   - `stripe_account_id`;
   - `stripe_onboarding_completo=True`.
4. Evento do cliente.
5. Pedido criado para o bartender.
6. Proposta aceita.
7. Pedido com:
   - `status=ACEITO`;
   - `valor_total_aprovado`;
   - `horas_aprovadas`;
   - `presenca_status=PENDENTE`.

O caminho recomendado e criar tudo pela UI:

1. Cliente cria evento.
2. Cliente envia proposta ao bartender.
3. Destinatario aceita a proposta no chat.
4. Cliente abre o pagamento pelo banner do chat.

## Cenario A - Onboarding do bartender

### 1. Gerar link de onboarding

```http
POST /api/v1/stripe/onboarding/
```

Resultado esperado:

- resposta contem `url`;
- bartender e redirecionado para Stripe;
- Stripe coleta dados da conta Express.

### 2. Verificar status

```http
GET /api/v1/stripe/status/
```

Resultado esperado:

```json
{
  "tem_conta_stripe": true,
  "onboarding_completo": true
}
```

Se o onboarding nao estiver completo, o cliente nao conseguira pagar esse
bartender.

## Cenario B - Pagamento dentro da janela de autorizacao

Este cenario cria um PaymentIntent com captura manual.

### 1. Abrir tela de pagamento

No frontend:

```text
/client/payment?pedido={pedido_id}
```

Ou via API:

```http
POST /api/v1/stripe/pagar/{pedido_id}/
```

Resultado esperado:

```json
{
  "mode": "payment",
  "status": "PENDENTE",
  "payment_intent_id": "pi_xxx",
  "setup_intent_id": null,
  "client_secret": "pi_xxx_secret_xxx",
  "stripe_status": "requires_payment_method",
  "finalizado_pelo_cliente": false
}
```

### 2. Confirmar pagamento no frontend

Use o Payment Element e o cartao `4242 4242 4242 4242`.

O frontend chama `stripe.confirmPayment`.

Quando a Stripe retornar `requires_capture`, o frontend chama:

```http
POST /api/v1/stripe/pagamento-autorizado/{pagamento_id}/
```

Resultado esperado:

```json
{
  "status": "PENDENTE",
  "stripe_status": "requires_capture",
  "finalizado_pelo_cliente": true,
  "presenca_status": "PENDENTE"
}
```

Interpretacao:

- pagamento esta autorizado;
- ainda nao foi capturado;
- pedido ainda nao deve ser tratado como pago/liberado.

## Cenario C - Confirmar presenca e liberar pagamento

Este cenario so deve funcionar depois do fim previsto do servico contratado.

Fim previsto:

```text
evento.data + evento.hora_inicio + pedido.horas_aprovadas
```

Se `horas_aprovadas` estiver vazio, o fallback e o fim do evento.

### 1. Tentar confirmar antes do fim do servico

```http
POST /api/v1/pedidos/{pedido_id}/confirmar-presenca/
```

Resultado esperado:

```json
{
  "detail": "A presenca so pode ser registrada apos o fim previsto do servico"
}
```

### 2. Ajustar dados para simular servico finalizado

Em ambiente local/teste, ajuste o evento ou proposta aceita para que
`servico_fim_previsto` esteja no passado.

Exemplo via Django shell:

```powershell
python manage.py shell
```

```python
from datetime import timedelta
from django.utils import timezone
from core.models import Pedido

pedido = Pedido.objects.get(pk=PEDIDO_ID)
pedido.evento.data = timezone.localdate()
pedido.evento.hora_inicio = (timezone.localtime() - timedelta(hours=2)).time()
pedido.evento.hora_fim = (timezone.localtime() + timedelta(hours=1)).time()
pedido.evento.save(update_fields=["data", "hora_inicio", "hora_fim"])
pedido.horas_aprovadas = 1
pedido.save(update_fields=["horas_aprovadas"])
```

### 3. Confirmar presenca

```http
POST /api/v1/pedidos/{pedido_id}/confirmar-presenca/
```

Resultado esperado:

- `presenca_status=PRESENTE`;
- `presenca_origem=CLIENTE`;
- se havia PaymentIntent `requires_capture`, o backend tenta capturar;
- `Pagamento.status=PAGO`;
- `Pedido.status=PAGO`.

No frontend, a tela de pagamento deve mostrar pagamento liberado ou voltar ao
chat com status atualizado.

## Cenario D - Registrar ausencia e bloquear captura

Este cenario deve ser executado depois do fim previsto do servico.

### 1. Registrar ausencia

```http
POST /api/v1/pedidos/{pedido_id}/registrar-ausencia/
```

Resultado esperado:

- `presenca_status=AUSENTE`;
- `presenca_origem=CLIENTE`;
- uma `SolicitacaoReembolso` e criada ou reutilizada;
- captura fica bloqueada.

### 2. Ver solicitacao do pedido

```http
GET /api/v1/pedidos/{pedido_id}/solicitacao-reembolso/
```

Tipos esperados:

- `CANCELAMENTO_AUTORIZACAO`, se ha PaymentIntent ainda nao capturado;
- `REEMBOLSO_CAPTURADO`, se pagamento ja estava `PAGO`;
- `SEM_COBRANCA`, se nao havia cobranca efetiva.

### 3. Tentar capturar depois da ausencia

```http
POST /api/v1/stripe/capturar/{pagamento_id}/
```

Resultado esperado:

```json
{
  "erro": "Pagamento bloqueado porque o cliente registrou ausencia do bartender"
}
```

## Cenario E - Liberacao automatica apos 5 minutos

Este cenario testa o comando `processar_pagamentos_pendentes`.

Pre-condicoes:

- pagamento com `stripe_payment_intent_id`;
- Stripe status `requires_capture`;
- `Pagamento.status=PENDENTE`;
- `presenca_status=PENDENTE`;
- nao existe solicitacao ativa de reembolso;
- `timezone.now() >= pedido.liberacao_automatica_em`.

### 1. Ajustar fim do servico para o passado

No Django shell, ajuste o evento e `horas_aprovadas` para que a liberacao
automatica ja tenha passado.

### 2. Rodar comando

```powershell
cd C:\Users\Admin\OneDrive\Documentos\P5\probar\backend\probar_api
python manage.py processar_pagamentos_pendentes
```

Resultado esperado:

- comando informa `captured=1` para o pagamento elegivel;
- `presenca_status=PRESENTE`;
- `presenca_origem=AUTOMATICA`;
- `Pagamento.status=PAGO`;
- `Pedido.status=PAGO`.

Logs:

```powershell
Get-Content .\logs\pagamentos_cron.log -Tail 200
```

## Cenario F - Pagamento fora da janela de autorizacao

Este cenario cria SetupIntent e salva o cartao para cobranca futura.

Pre-condicao:

- evento ainda esta antes de `inicio_evento - STRIPE_MANUAL_CAPTURE_WINDOW_DAYS`.

### 1. Iniciar pagamento

```http
POST /api/v1/stripe/pagar/{pedido_id}/
```

Resultado esperado:

```json
{
  "mode": "setup",
  "status": "PENDENTE",
  "payment_intent_id": null,
  "setup_intent_id": "seti_xxx",
  "client_secret": "seti_xxx_secret_xxx"
}
```

### 2. Confirmar SetupIntent

No frontend, o Payment Element chama `stripe.confirmSetup`.

Depois, o frontend sincroniza:

```http
POST /api/v1/stripe/setup-confirmado/{pagamento_id}/
```

Resultado esperado:

- `stripe_status=succeeded`;
- `payment_method_id=pm_xxx`;
- pagamento continua `PENDENTE`;
- nao ha PaymentIntent ainda.

### 3. Simular entrada na janela de autorizacao

Ajuste o evento para cair dentro da janela.

### 4. Rodar comando automatico

```powershell
python manage.py processar_pagamentos_pendentes
```

Resultado esperado:

- comando cria PaymentIntent off-session usando o `payment_method_id` salvo;
- `stripe_payment_intent_id` e salvo no `Pagamento`;
- se Stripe retornar `requires_capture`, o pagamento fica autorizado e
  aguardando presenca/liberacao.

## Cenario G - Cancelamento de autorizacao aprovado

Este cenario testa a infraestrutura atual de disputa sem refund real.

Pre-condicoes:

- cliente registrou ausencia;
- existe `SolicitacaoReembolso` do tipo `CANCELAMENTO_AUTORIZACAO`;
- PaymentIntent esta `requires_capture`;
- admin aprovou a solicitacao.

### 1. Admin aprova solicitacao

```http
POST /api/v1/solicitacoes-reembolso/{id}/aprovar/
```

Body exemplo:

```json
{
  "decisao_admin": "Ausencia validada pela plataforma.",
  "valor_aprovado": "250.00"
}
```

### 2. Admin executa cancelamento

```http
POST /api/v1/solicitacoes-reembolso/{id}/executar-cancelamento/
```

Resultado esperado quando Stripe confirma cancelamento:

- `SolicitacaoReembolso.status=CONCLUIDA`;
- `SolicitacaoReembolso.stripe_status=canceled`;
- `Pagamento.status=CANCELADO`;
- nenhum Refund e criado.

Se o PaymentIntent ja estiver `succeeded`, o sistema nao cancela nem reembolsa.
Ele muda o tipo para `REEMBOLSO_CAPTURADO` e registra erro orientando tratar em
etapa futura.

## Cenario H - Webhooks

Com Stripe CLI rodando, eventos sao encaminhados para:

```http
POST /api/v1/stripe/webhook/
```

Eventos tratados:

- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `payment_intent.canceled`
- `setup_intent.succeeded`
- `setup_intent.canceled`

Verificacoes:

- assinatura usa `STRIPE_WEBHOOK_SECRET`;
- `payment_intent.canceled` marca pagamento como `CANCELADO`;
- `setup_intent.succeeded` salva payment method;
- `payment_intent.succeeded` so marca `PAGO` se a regra local de presenca ou
  liberacao automatica permitir.

## Consultas uteis no Django shell

```python
from core.models import Pedido, Pagamento, SolicitacaoReembolso

pedido = Pedido.objects.get(pk=PEDIDO_ID)
print(pedido.status)
print(pedido.numero_bartender)
print(pedido.presenca_status, pedido.presenca_origem)
print(pedido.servico_fim_previsto)
print(pedido.liberacao_automatica_em)

pagamento = Pagamento.objects.get(pedido=pedido)
print(pagamento.status)
print(pagamento.valor)
print(pagamento.stripe_payment_intent_id)
print(pagamento.stripe_setup_intent_id)
print(pagamento.stripe_payment_method_id)
print(pagamento.finalizado_pelo_cliente)

print(list(SolicitacaoReembolso.objects.filter(pedido=pedido).values(
    "id",
    "tipo",
    "status",
    "valor_solicitado",
    "valor_aprovado",
    "stripe_status",
    "stripe_erro",
)))
```

## Checklist rapido

### Pagamento autorizado

- [ ] Pedido esta `ACEITO`.
- [ ] Bartender tem onboarding completo.
- [ ] Cliente abriu `/client/payment?pedido={id}`.
- [ ] PaymentIntent foi criado.
- [ ] Stripe retornou `requires_capture`.
- [ ] Backend sincronizou `/stripe/pagamento-autorizado/{pagamento_id}/`.
- [ ] `Pagamento.status=PENDENTE`.
- [ ] `finalizado_pelo_cliente=True`.
- [ ] `presenca_status=PENDENTE`.

### Captura por presenca

- [ ] Servico ja passou de `servico_fim_previsto`.
- [ ] Cliente chamou confirmar presenca.
- [ ] `presenca_status=PRESENTE`.
- [ ] Stripe capturou o PaymentIntent.
- [ ] `Pagamento.status=PAGO`.
- [ ] `Pedido.status=PAGO`.

### Ausencia

- [ ] Servico ja passou de `servico_fim_previsto`.
- [ ] Cliente registrou ausencia.
- [ ] `presenca_status=AUSENTE`.
- [ ] Foi criada solicitacao de reembolso/caso financeiro.
- [ ] Captura manual e automatica ficam bloqueadas.

### Liberacao automatica

- [ ] `timezone.now() >= liberacao_automatica_em`.
- [ ] Presenca ainda esta `PENDENTE`.
- [ ] Nao existe solicitacao ativa.
- [ ] Comando automatico rodou.
- [ ] `presenca_origem=AUTOMATICA`.
- [ ] Pagamento foi capturado.

## Troubleshooting

### Erro `127.0.0.1:8000 ERR_CONNECTION_REFUSED` em deploy

O frontend foi buildado apontando para API local. Ajuste a variavel publica do
frontend para a URL real da API em producao, por exemplo:

```text
NEXT_PUBLIC_API_BASE_URL=https://sua-api.com/api/v1
```

Depois gere novo build/deploy.

### `Pedido nao esta aceito`

O pagamento so inicia para pedido `ACEITO` ou `PAGO`. Confira se a proposta foi
aceita corretamente e se os snapshots financeiros foram salvos.

### `Bartender sem conta Stripe`

O bartender ainda nao tem `stripe_account_id`. Rode o onboarding.

### `Onboarding do bartender incompleto`

O Stripe Account ainda nao retornou como completo. Acesse novamente o link de
onboarding ou consulte `/stripe/status/`.

### PaymentIntent continua `requires_payment_method`

O cliente nao confirmou o pagamento ou o cartao falhou. Tente novamente pelo
Payment Element.

### PaymentIntent esta `requires_capture`, mas pedido nao esta pago

Esse e o estado esperado de "pagamento autorizado". Ainda falta confirmar
presenca ou aguardar a liberacao automatica.

### Cliente nao consegue confirmar presenca

Confira `servico_fim_previsto`. O backend bloqueia confirmacao antes do fim
previsto do servico contratado.

### Captura bloqueada por solicitacao ativa

Existe `SolicitacaoReembolso` ativa para o pedido. Enquanto ela estiver ativa,
a captura fica bloqueada.

### PaymentIntent ja esta `succeeded`, mas banco nao esta `PAGO`

Pode ter ocorrido captura externa fora da regra local. O webhook atual nao marca
como pago se a regra local de presenca/liberacao nao permitir. Esse caso exige
analise administrativa/sincronizacao manual controlada.

## Resultado esperado do fluxo atual

O fluxo esta correto quando:

- proposta aceita gera pedido `ACEITO` com valor aprovado;
- pagamento autorizado nao e tratado como liberado;
- ausencia bloqueia captura e abre caso financeiro;
- presenca confirmada libera captura;
- ausencia pendente libera automaticamente apenas 5 minutos apos o fim previsto
  do servico contratado;
- cancelamento de autorizacao aprovado cancela apenas PaymentIntent ainda nao
  capturado;
- refund de pagamento capturado continua reservado para etapa futura.
