import type { PedidoResumoChat } from "@/services/useChat"

type BadgeTone = {
  label: string
  bg: string
  color: string
  border: string
}

const ACTIVE_REIMBURSEMENT_STATUSES = new Set(["ABERTA", "CONTESTADA", "APROVADA", "FALHOU"])

const tones = {
  neutral: { bg: "#F5F5F5", color: "#5F5E5A", border: "1px solid #DDDDDD" },
  final: { bg: "#FFF8DB", color: "#7A5600", border: "1px solid #F5C518" },
  positive: { bg: "#EAF3DE", color: "#3B6D11", border: "1px solid #97C459" },
  danger: { bg: "#FCEBEB", color: "#A32D2D", border: "1px solid #E24B4A" },
}

function normalize(value: string | null | undefined) {
  return value?.toUpperCase() ?? null
}

export function getPedidoDisplayNumber(pedido: PedidoResumoChat | null | undefined, fallbackId?: number) {
  return pedido?.numero_bartender ?? fallbackId ?? pedido?.pedido_id ?? "-"
}

export function resolvePedidoVisualStatus(pedido: PedidoResumoChat | null | undefined): BadgeTone {
  if (!pedido) {
    return { label: "Negociacao pendente", ...tones.neutral }
  }

  const pedidoStatus = normalize(pedido.pedido_status)
  const pagamentoStatus = normalize(pedido.pagamento_status)
  const presencaStatus = normalize(pedido.presenca_status)
  const solicitacaoStatus = normalize(pedido.solicitacao_reembolso_status)
  const solicitacaoTipo = normalize(pedido.solicitacao_reembolso_tipo)

  if (solicitacaoStatus && ACTIVE_REIMBURSEMENT_STATUSES.has(solicitacaoStatus)) {
    if (solicitacaoTipo === "CANCELAMENTO_AUTORIZACAO" && solicitacaoStatus === "APROVADA") {
      return { label: "Cancelamento aprovado", ...tones.danger }
    }

    if (solicitacaoStatus === "FALHOU") {
      return { label: "Reembolso pendente", ...tones.danger }
    }

    return { label: "Solicitacao de reembolso", ...tones.danger }
  }

  if (presencaStatus === "AUSENTE") {
    return { label: "Ausencia registrada", ...tones.danger }
  }

  if (solicitacaoTipo === "CANCELAMENTO_AUTORIZACAO" && solicitacaoStatus === "CONCLUIDA") {
    return { label: "Cancelamento concluido", ...tones.final }
  }

  if (pedidoStatus === "CONCLUIDO") {
    return { label: "Pedido concluido", ...tones.final }
  }

  if (pedidoStatus === "PAGO" || pagamentoStatus === "PAGO") {
    return { label: "Pagamento liberado", ...tones.final }
  }

  if (presencaStatus === "PRESENTE") {
    return { label: "Presenca confirmada", ...tones.final }
  }

  if (pagamentoStatus === "PENDENTE" && pedido.pagamento_finalizado_pelo_cliente) {
    return { label: "Pagamento autorizado", ...tones.positive }
  }

  if (pedidoStatus === "ACEITO" && (!pagamentoStatus || pagamentoStatus === "PENDENTE")) {
    return { label: "Aguardando pagamento", ...tones.neutral }
  }

  if (pedidoStatus === "ACEITO") {
    return { label: "Proposta aceita", ...tones.positive }
  }

  return { label: "Negociacao pendente", ...tones.neutral }
}
