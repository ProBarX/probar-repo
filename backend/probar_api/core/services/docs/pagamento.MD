# Fluxo de pagamento atual - ProBar

Documento atualizado para refletir a implementacao atual do projeto ProBar.

Este documento descreve como o pagamento funciona hoje no backend, frontend e
integracao Stripe. Ele tambem registra as limitacoes conhecidas para uma futura
refatoracao financeira, mas nao propoe mudanca imediata no fluxo atual.

## Visao geral

O ProBar usa Stripe Connect com contas Express para bartenders. O cliente paga
pela contratacao, mas a captura/liberacao do valor nao acontece apenas porque a
proposta foi aceita ou porque o cartao foi autorizado.

O fluxo atual separa estes momentos:

1. Negociacao e aceite de proposta.
2. Criacao do pagamento ou salvamento de cartao.
3. Autorizacao Stripe com captura manual.
4. Confirmacao de presenca ou ausencia.
5. Captura/liberacao do pagamento.
6. Bloqueio e abertura de caso financeiro quando ha ausencia.
7. Cancelamento de autorizacao aprovada quando o PaymentIntent ainda nao foi
   capturado.

Pix e reembolso real de pagamento ja capturado ainda nao fazem parte do fluxo
implementado.

## Principais arquivos

Backend:

- `core/models.py`
- `core/enums.py`
- `core/services/stripe_service.py`
- `core/services/reembolso_service.py`
- `core/api/v1/stripe_views.py`
- `core/api/v1/viewsets.py`
- `core/management/commands/processar_pagamentos_pendentes.py`

Frontend:

- `frontend/probar_app/src/services/payment.ts`
- `frontend/probar_app/src/app/(client)/client/payment/page.tsx`
- `frontend/probar_app/src/lib/chat-status.ts`
- `frontend/probar_app/src/components/client/chat/ChatNextStepBanner.tsx`

## Modelos envolvidos

### Pedido

Campos financeiros e operacionais relevantes:

- `status`
- `numero_bartender`
- `proposta_aprovada`
- `valor_hora_aprovado`
- `horas_aprovadas`
- `valor_total_aprovado`
- `presenca_status`
- `presenca_origem`
- `presenca_registrada_em`
- `presenca_registrada_por`
- `presenca_observacao`

Propriedades importantes:

- `servico_inicio_previsto`
- `servico_fim_previsto`
- `liberacao_automatica_em`

O fim previsto do servico e calculado assim:

```text
inicio do servico = data do evento + hora_inicio do evento
fim previsto = inicio do servico + horas_aprovadas
liberacao automatica = fim previsto + 5 minutos
```

Se `horas_aprovadas` estiver vazio em pedido antigo, o sistema usa o fim do
evento como fallback. Eventos que passam da meia-noite sao tratados somando um
dia ao horario final quando `hora_fim <= hora_inicio`.

### Proposta

Campos financeiros relevantes:

- `valor_hora`
- `horas`
- `valor_adicional`
- `desconto`
- `valor_total_snapshot`
- `status`

Na criacao da proposta, o sistema salva um snapshot financeiro. Depois de
criada, os campos financeiros da proposta sao imutaveis.

Quando a proposta e aceita, o pedido recebe os valores aprovados:

- `valor_hora_aprovado`
- `horas_aprovadas`
- `valor_total_aprovado`
- `proposta_aprovada`

O pagamento usa `pedido.valor_total_aprovado`.

### Pagamento

Campos relevantes:

- `pedido`
- `valor`
- `metodo_pagamento`
- `status`
- `stripe_payment_intent_id`
- `stripe_setup_intent_id`
- `stripe_payment_method_id`
- `stripe_payment_method_type`
- `finalizado_pelo_cliente`

Status atuais:

| Status | Significado atual |
| --- | --- |
| `PENDENTE` | Estado amplo: pode significar cartao ainda nao salvo, pagamento ainda nao confirmado, PaymentIntent autorizado aguardando captura, ou pagamento aguardando presenca/liberacao automatica. |
| `PAGO` | PaymentIntent capturado/liberado e pedido marcado como pago. |
| `CANCELADO` | Pagamento local cancelado por falha, cancelamento de SetupIntent/PaymentIntent ou cancelamento de autorizacao. |

Observacao importante: `finalizado_pelo_cliente=True` hoje significa que o
PaymentIntent foi sincronizado como `requires_capture`, ou seja, pagamento
autorizado para captura manual. Ele nao significa presenca confirmada.

### SolicitacaoReembolso

Representa o caso financeiro aberto quando o cliente registra ausencia do
bartender.

Campos relevantes:

- `pedido`
- `pagamento`
- `cliente`
- `bartender`
- `tipo`
- `motivo`
- `status`
- `valor_solicitado`
- `valor_aprovado`
- `observacao_cliente`
- `resposta_bartender`
- `decisao_admin`
- `stripe_payment_intent_id`
- `stripe_status`
- `stripe_idempotency_key`
- `stripe_erro`
- `execucao_financeira_iniciada_em`
- `execucao_financeira_concluida_em`

Tipos:

| Tipo | Uso atual |
| --- | --- |
| `CANCELAMENTO_AUTORIZACAO` | Existe PaymentIntent ainda nao capturado. A etapa atual permite cancelar autorizacao aprovada. |
| `REEMBOLSO_CAPTURADO` | Pagamento ja capturado. Refund/reversal real ainda nao foi implementado. |
| `SEM_COBRANCA` | Ausencia sem cobranca criada/capturada. |

Status ativos:

- `ABERTA`
- `CONTESTADA`
- `APROVADA`
- `FALHOU`

Existe uma constraint parcial para impedir mais de uma solicitacao ativa por
pedido.

## Estados do pedido

| Status | Significado no fluxo atual |
| --- | --- |
| `EM_NEGOCIACAO` | Pedido criado e propostas ainda em negociacao. |
| `ACEITO` | Proposta aceita; cliente precisa iniciar/concluir pagamento. |
| `RECUSADO` | Proposta recusada e negociacao encerrada. |
| `CANCELADO` | Pedido cancelado. |
| `PAGO` | Pagamento capturado/liberado. |
| `CONCLUIDO` | Atendimento concluido em nivel operacional. |

`Pedido.PAGO` representa captura/liberacao do pagamento, nao apenas autorizacao.

## Fluxo completo

### 1. Aceite da proposta

O aceite acontece em `Proposta.accept(user)`.

Regras principais:

- Apenas participante do pedido pode aceitar.
- O remetente nao pode aceitar a propria proposta.
- Apenas o destinatario pode aceitar.
- Apenas proposta `PENDENTE` pode ser aceita.
- Apenas a proposta vigente/mais recente pode ser aceita.
- O pedido precisa estar em `EM_NEGOCIACAO`.

Ao aceitar:

1. A proposta vira `ACEITA`.
2. O pedido vira `ACEITO`.
3. O pedido salva snapshot financeiro aprovado.
4. Propostas pendentes antigas viram `SUBSTITUIDA`.
5. O chat recebe mensagem de sistema informando que a proposta foi aceita.

### 2. Onboarding Stripe do bartender

Antes de receber pagamentos, o bartender precisa ter conta Stripe Express.

Endpoints:

```http
POST /api/v1/stripe/onboarding/
GET  /api/v1/stripe/status/
```

O backend cria ou reutiliza a conta Express e solicita capacidades:

- `card_payments`
- `transfers`

O pagamento so pode ser iniciado se:

- `stripe_account_id` existir;
- `stripe_onboarding_completo` estiver verdadeiro.

### 3. Cliente inicia pagamento

Endpoint:

```http
POST /api/v1/stripe/pagar/{pedido_id}/
```

Service principal:

```text
stripe_service.criar_pagamento_seguro(pedido_id, user)
```

Validacoes:

- usuario autenticado precisa ser cliente;
- cliente precisa ser dono do pedido;
- pedido precisa estar `ACEITO` ou `PAGO`;
- pedido nao pode estar com `presenca_status=AUSENTE`;
- bartender precisa ter conta Stripe;
- onboarding Stripe do bartender precisa estar completo.

O pedido e travado com `select_for_update()` dentro de `transaction.atomic()`.

### 4. Decisao: PaymentIntent agora ou SetupIntent

O backend usa `evento_esta_na_janela_autorizacao(evento)`.

Regra atual da janela:

```text
agora >= inicio_evento - STRIPE_MANUAL_CAPTURE_WINDOW_DAYS
e
agora <= fim_evento + 2 horas
```

Valor padrao:

```text
STRIPE_MANUAL_CAPTURE_WINDOW_DAYS=5
```

Importante: esta janela usa o periodo do evento. A liberacao automatica usa o
fim previsto do servico contratado.

#### Dentro da janela

Cria `PaymentIntent` com:

- `currency=brl`
- `payment_method_types=["card"]`
- `capture_method=manual`
- `transfer_data.destination = bartender.stripe_account_id`
- `application_fee_amount` calculado por `STRIPE_PLATFORM_FEE_PERCENT`
- idempotency key `pedido_{pedido.id}` ou sufixos de retry/repair

O `Pagamento` local fica:

- `status=PENDENTE`
- `metodo_pagamento=STRIPE`
- `stripe_payment_intent_id=pi_...`
- `valor=pedido.valor_total_aprovado`

#### Fora da janela

Cria `SetupIntent` para salvar cartao:

- `usage=off_session`
- `payment_method_types=["card"]`
- `customer` Stripe do cliente
- metadata com `pedido_id`

O `Pagamento` local fica:

- `status=PENDENTE`
- `stripe_setup_intent_id=seti_...`
- `stripe_payment_intent_id=None`
- `valor=pedido.valor_total_aprovado`

Quando o evento entrar na janela de autorizacao, o comando automatico pode
criar o `PaymentIntent` off-session usando o payment method salvo.

### 5. Frontend confirma pagamento ou cartao

Tela:

```text
/client/payment?pedido={pedido_id}
```

Arquivo:

```text
frontend/probar_app/src/app/(client)/client/payment/page.tsx
```

Se a sessao for `payment`, o frontend usa `stripe.confirmPayment`.

Se a sessao for `setup`, o frontend usa `stripe.confirmSetup`.

Depois da confirmacao, o frontend chama o backend para sincronizar:

```http
POST /api/v1/stripe/pagamento-autorizado/{pagamento_id}/
POST /api/v1/stripe/setup-confirmado/{pagamento_id}/
```

### 6. Pagamento autorizado

Quando a Stripe retorna `PaymentIntent.status=requires_capture`, o backend
executa:

```text
sincronizar_payment_intent_autorizado(pagamento)
```

Efeito local:

- `finalizado_pelo_cliente=True`
- `Pagamento.status` continua `PENDENTE`
- `Pedido.status` continua `ACEITO`

Isto representa pagamento autorizado, nao pagamento liberado.

O chat e a tela de pagamento interpretam:

```text
Pagamento.status == PENDENTE
e
finalizado_pelo_cliente == True
```

como "pagamento autorizado".

### 7. Confirmacao de presenca

Endpoint principal:

```http
POST /api/v1/pedidos/{pedido_id}/confirmar-presenca/
```

Service:

```text
stripe_service.confirmar_presenca_pedido(pedido_id, user)
```

Regras:

- Apenas cliente pode confirmar.
- O cliente precisa ser dono do pedido.
- Bartender nao pode confirmar.
- O servico precisa ter passado de `servico_fim_previsto`.
- Nao pode confirmar se a presenca ja foi marcada como `AUSENTE`.

O pedido e travado com `select_for_update()`. O pagamento tambem e travado
quando existe.

Se a presenca estava `PENDENTE`, o pedido passa para:

- `presenca_status=PRESENTE`
- `presenca_origem=CLIENTE`
- `presenca_registrada_por=cliente`

Depois disso, se existir pagamento pendente com PaymentIntent, o sistema tenta
capturar/liberar.

### 8. Registro de ausencia

Endpoint:

```http
POST /api/v1/pedidos/{pedido_id}/registrar-ausencia/
```

Service:

```text
stripe_service.registrar_ausencia_pedido(pedido_id, user)
```

Regras:

- Apenas cliente pode registrar ausencia.
- O cliente precisa ser dono do pedido.
- Bartender nao pode registrar ausencia.
- O servico precisa ter passado de `servico_fim_previsto`.
- Nao pode registrar ausencia depois de presenca `PRESENTE`.

Efeitos:

- `presenca_status=AUSENTE`
- `presenca_origem=CLIENTE`
- captura passa a ser bloqueada;
- cria ou reutiliza uma `SolicitacaoReembolso` ativa;
- a solicitacao define o tipo conforme o estado do pagamento:
  - sem pagamento: `SEM_COBRANCA`;
  - pagamento pendente com PaymentIntent: `CANCELAMENTO_AUTORIZACAO`;
  - pagamento ja pago: `REEMBOLSO_CAPTURADO`.

### 9. Captura/liberacao

Endpoint manual:

```http
POST /api/v1/stripe/capturar/{pagamento_id}/
```

Service:

```text
stripe_service.capturar_pagamento_seguro(pagamento)
```

Regras antes de capturar:

- `presenca_status` nao pode ser `AUSENTE`;
- nao pode existir solicitacao ativa de reembolso;
- captura e permitida se:
  - `presenca_status=PRESENTE`; ou
  - `agora >= liberacao_automatica_em`.

Se a liberacao automatica for usada, o sistema persiste:

- `presenca_status=PRESENTE`
- `presenca_origem=AUTOMATICA`
- observacao de liberacao automatica

Depois da captura:

- `Pagamento.status=PAGO`
- `Pedido.status=PAGO`

### 10. Liberacao automatica

Management command:

```bash
python manage.py processar_pagamentos_pendentes
```

Funcoes:

```text
processar_pagamentos_agendados()
processar_pagamentos_pendentes()
```

O comando faz duas coisas:

1. Para pagamentos com `SetupIntent` salvo e sem `PaymentIntent`, tenta criar o
   `PaymentIntent` off-session quando o evento entra na janela de autorizacao.
2. Para pagamentos pendentes com `PaymentIntent`, tenta capturar apenas quando
   as regras de presenca/liberacao permitem.

A liberacao automatica ocorre 5 minutos apos o fim previsto do servico
contratado, nao necessariamente 5 minutos apos o fim do evento.

Exemplo:

```text
Evento: 14:00 as 18:00
Horas aprovadas: 2
Fim previsto do servico: 16:00
Liberacao automatica: 16:05
```

### 11. Webhooks Stripe

Endpoint:

```http
POST /api/v1/stripe/webhook/
```

Eventos tratados:

- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `payment_intent.canceled`
- `setup_intent.succeeded`
- `setup_intent.canceled`

O webhook valida `STRIPE_WEBHOOK_SECRET`.

Quando recebe `payment_intent.succeeded`, o sistema ainda valida as regras
locais de presenca/liberacao antes de marcar o banco como `PAGO`. Se a captura
externa ocorreu fora da regra local, o webhook nao marca o pagamento como pago.
Esse comportamento evita liberar indevidamente no sistema, mas pode gerar
divergencia operacional entre Stripe e banco caso alguem capture manualmente
fora da aplicacao.

### 12. Solicitacao financeira e cancelamento de autorizacao

Quando o cliente registra ausencia, o sistema abre uma `SolicitacaoReembolso`.

Endpoints:

```http
GET  /api/v1/pedidos/{pedido_id}/solicitacao-reembolso/
GET  /api/v1/solicitacoes-reembolso/
POST /api/v1/solicitacoes-reembolso/{id}/responder/
POST /api/v1/solicitacoes-reembolso/{id}/aprovar/
POST /api/v1/solicitacoes-reembolso/{id}/negar/
POST /api/v1/solicitacoes-reembolso/{id}/executar-cancelamento/
```

Permissoes:

- Cliente dono do pedido visualiza a solicitacao do pedido.
- Bartender do pedido pode responder/contestar.
- Admin lista, aprova, nega e executa cancelamento.

`executar-cancelamento` so executa acao financeira quando:

- usuario e admin;
- solicitacao esta `APROVADA`;
- tipo e `CANCELAMENTO_AUTORIZACAO`;
- existe `PaymentIntent`;
- Stripe informa `status=requires_capture`.

Se a Stripe confirmar `canceled`:

- `SolicitacaoReembolso.status=CONCLUIDA`
- `Pagamento.status=CANCELADO`

Se o PaymentIntent ja estiver `succeeded`, o sistema nao reembolsa. Ele muda o
tipo para `REEMBOLSO_CAPTURADO` e deixa o caso para uma etapa futura.

Refund, `reverse_transfer` e `refund_application_fee` ainda nao estao
implementados.

## Endpoints de pagamento

| Metodo | Rota | Permissao | Efeito principal |
| --- | --- | --- | --- |
| `POST` | `/api/v1/stripe/onboarding/` | Bartender autenticado | Cria/reutiliza conta Express e retorna link de onboarding. |
| `GET` | `/api/v1/stripe/status/` | Bartender autenticado | Sincroniza e retorna status do onboarding. |
| `POST` | `/api/v1/stripe/pagar/{pedido_id}/` | Cliente dono do pedido | Cria ou sincroniza PaymentIntent/SetupIntent. |
| `POST` | `/api/v1/stripe/setup-confirmado/{pagamento_id}/` | Cliente dono do pedido | Sincroniza SetupIntent salvo. |
| `POST` | `/api/v1/stripe/pagamento-autorizado/{pagamento_id}/` | Cliente dono do pedido | Sincroniza PaymentIntent autorizado; nao captura. |
| `POST` | `/api/v1/stripe/capturar/{pagamento_id}/` | Cliente dono do pedido | Tenta capturar, respeitando presenca e solicitacao ativa. |
| `POST` | `/api/v1/stripe/finalizar/{pagamento_id}/` | Cliente dono do pedido | Endpoint legado: confirma presenca e tenta finalizar/liberar. |
| `POST` | `/api/v1/stripe/webhook/` | Stripe | Sincroniza eventos Stripe. |
| `POST` | `/api/v1/pedidos/{pedido_id}/confirmar-presenca/` | Cliente dono do pedido | Confirma presenca e tenta liberar pagamento autorizado. |
| `POST` | `/api/v1/pedidos/{pedido_id}/registrar-ausencia/` | Cliente dono do pedido | Registra ausencia, bloqueia captura e cria caso financeiro. |

## Payload de pagamento usado pelo frontend

`_pagamento_payload()` retorna:

```json
{
  "pagamento_id": 10,
  "pedido_id": 25,
  "pedido_numero_bartender": 3,
  "valor": "250.00",
  "status": "PENDENTE",
  "mode": "payment",
  "finalizado_pelo_cliente": false,
  "payment_intent_id": "pi_xxx",
  "setup_intent_id": null,
  "stripe_resource_id": "pi_xxx",
  "payment_method_id": null,
  "client_secret": "pi_xxx_secret_xxx",
  "stripe_status": "requires_payment_method",
  "presenca_status": "PENDENTE",
  "presenca_origem": null,
  "servico_fim_previsto": "2026-05-18T16:00:00-03:00",
  "liberacao_automatica_em": "2026-05-18T16:05:00-03:00"
}
```

`mode` pode ser:

- `payment`: ha PaymentIntent.
- `setup`: ha SetupIntent e ainda nao ha PaymentIntent.

## Variaveis de ambiente

| Variavel | Uso |
| --- | --- |
| `STRIPE_SECRET_KEY` | Chave privada usada pelo backend. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Chave publica usada pelo frontend Next.js. |
| `STRIPE_WEBHOOK_SECRET` | Segredo para validar assinatura do webhook. |
| `STRIPE_RETURN_URL` | URL de retorno padrao para onboarding quando nao houver origin valido. |
| `STRIPE_REFRESH_URL` | URL de refresh padrao para onboarding quando nao houver origin valido. |
| `STRIPE_PLATFORM_FEE_PERCENT` | Percentual da taxa da plataforma aplicado no PaymentIntent. |
| `STRIPE_MANUAL_CAPTURE_WINDOW_DAYS` | Quantos dias antes do evento o sistema pode autorizar cartao via PaymentIntent manual. Padrao: 5. |

## Concorrencia e seguranca

O fluxo atual usa `transaction.atomic()` e `select_for_update()` em pontos
criticos:

- criacao/sincronizacao de pagamento;
- aceite de proposta;
- confirmacao de presenca;
- registro de ausencia;
- captura segura;
- criacao/resposta/aprovacao/negacao de solicitacao;
- cancelamento de autorizacao.

Protecoes relevantes:

- cliente so paga pedido proprio;
- bartender nao confirma presenca;
- ausencia bloqueia captura;
- solicitacao ativa de reembolso bloqueia captura;
- cancelamento de autorizacao usa idempotency key estavel;
- webhook valida assinatura Stripe;
- propostas antigas/substituidas nao podem ser aceitas.

## Estados exibidos no chat

O chat nao deve depender apenas de texto de mensagens antigas. Ele usa
`pedido_resumo` no `ChatSerializer`, com dados como:

- `pedido_status`
- `pagamento_status`
- `pagamento_finalizado_pelo_cliente`
- `presenca_status`
- `presenca_origem`
- `servico_fim_previsto`
- `liberacao_automatica_em`
- `solicitacao_reembolso_status`
- `solicitacao_reembolso_tipo`

Prioridade visual atual:

1. Solicitacao de reembolso ativa.
2. Ausencia registrada.
3. Cancelamento aprovado/concluido.
4. Pedido concluido.
5. Pagamento liberado.
6. Presenca confirmada.
7. Pagamento autorizado.
8. Aguardando pagamento.
9. Proposta aceita.
10. Negociacao pendente.

## Limitacoes conhecidas

Estas limitacoes sao conhecidas e devem ser consideradas em uma refatoracao
futura, mas nao devem ser alteradas sem nova etapa planejada:

1. `Pagamento.PENDENTE` tem varios significados.
2. `finalizado_pelo_cliente` representa pagamento autorizado, nao presenca ou
   conclusao do pedido.
3. `/stripe/finalizar/` e semanticamente ambiguo porque confirma presenca e
   tenta liberar pagamento.
4. A captura Stripe ainda nao usa idempotency key explicita.
5. Chamada Stripe de captura ocorre dentro do fluxo protegido por locks de
   banco.
6. Captura externa feita direto na Stripe pode gerar divergencia com o banco.
7. Reembolso real para PaymentIntent ja capturado ainda nao existe.
8. O fluxo automatico depende do management command estar agendado e saudavel.

## Direcao arquitetural futura

Quando o financeiro for refatorado, a direcao recomendada e separar:

- estado operacional do pedido;
- estado financeiro;
- estado de presenca/disputa.

Exemplos de melhoria futura:

- adicionar `pagamento_autorizado_em` ou `stripe_authorized_at`;
- adicionar status financeiro `AUTORIZADO`;
- reduzir a sobrecarga de `Pagamento.PENDENTE`;
- adicionar idempotency key explicita na captura;
- tratar divergencia entre webhook e captura externa;
- revisar ou depreciar `/stripe/finalizar/`;
- implementar refund/reversal real da etapa 6C.

## Comando automatico

O comando deve ser agendado em producao:

```bash
cd backend/probar_api
python manage.py processar_pagamentos_pendentes
```

Sugestao operacional:

```text
*/5 * * * *
```

Logs:

```text
backend/probar_api/logs/pagamentos_cron.log
```

## Resumo executivo

O fluxo atual preserva o dinheiro ate que exista autorizacao Stripe e uma regra
local de liberacao. A ausencia do bartender bloqueia captura e abre caso
financeiro. A liberacao automatica ocorre 5 minutos depois do fim previsto do
servico contratado. O sistema ja cancela autorizacoes aprovadas ainda nao
capturadas, mas ainda nao executa reembolso real de pagamentos capturados.
