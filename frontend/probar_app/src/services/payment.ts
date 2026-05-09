import { api } from "@/services/api"

export type PaymentSession = {
  pagamento_id: number
  pedido_id: number
  valor: string
  status: "PENDENTE" | "PAGO" | "CANCELADO" | string
  finalizado_pelo_cliente: boolean
  payment_intent_id: string | null
  client_secret: string | null
  stripe_status: string | null
}

export async function criarPagamento(pedidoId: number) {
  const { data } = await api.post<PaymentSession>(`/stripe/pagar/${pedidoId}/`)
  return data
}

export async function capturarPagamento(pagamentoId: number) {
  const { data } = await api.post<{ status: string }>(`/stripe/capturar/${pagamentoId}/`)
  return data
}

export async function finalizarPagamento(pagamentoId: number) {
  const { data } = await api.post<{ status: string }>(`/stripe/finalizar/${pagamentoId}/`)
  return data
}
