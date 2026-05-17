"use client"

import { AlertTriangle, CheckCircle2, Clock3, CreditCard, ShieldCheck, UserCheck } from "lucide-react"
import type { PedidoResumoChat } from "@/services/useChat"
import { probarYellow, probarYellowBorder } from "@/components/client/chat/chatStyles"

type Role = "client" | "bartender"
type Tone = "neutral" | "positive" | "final" | "danger" | "action"

type Props = {
  pedido?: PedidoResumoChat | null
  role: Role
  pedidoId: number
  pendingProposalAction?: "self" | "other" | null
  onPay?: (pedidoId: number) => void
}

const activeReimbursementStatuses = new Set(["ABERTA", "CONTESTADA", "APROVADA", "FALHOU"])

function normalize(value: string | null | undefined) {
  return value?.toUpperCase() ?? null
}

function getToneStyle(tone: Tone) {
  if (tone === "action") return { bg: "#FFFFFF", border: "#E4E1D8", color: "#4D4B45", icon: "#777" }
  if (tone === "positive") return { bg: "#F4FAEC", border: "#97C459", color: "#2F5C0E", icon: "#3B6D11" }
  if (tone === "final") return { bg: "#FFF8DB", border: "#F5C518", color: "#7A5600", icon: "#8a6d00" }
  if (tone === "danger") return { bg: "#FCEBEB", border: "#E24B4A", color: "#A32D2D", icon: "#A32D2D" }
  return { bg: "#FFFFFF", border: "#E4E1D8", color: "#5F5E5A", icon: "#777" }
}

function resolveNextStep(
  pedido: PedidoResumoChat | null | undefined,
  role: Role,
  pendingProposalAction?: "self" | "other" | null
) {
  if (!pedido) {
    return {
      tone: "neutral" as Tone,
      icon: Clock3,
      title: "Negociacao em andamento",
      description: "Acompanhe as mensagens e propostas desta conversa.",
      action: false,
    }
  }

  const pedidoStatus = normalize(pedido.pedido_status)
  const pagamentoStatus = normalize(pedido.pagamento_status)
  const presencaStatus = normalize(pedido.presenca_status)
  const reembolsoStatus = normalize(pedido.solicitacao_reembolso_status)
  const reembolsoTipo = normalize(pedido.solicitacao_reembolso_tipo)

  if (reembolsoStatus && activeReimbursementStatuses.has(reembolsoStatus)) {
    return {
      tone: "danger" as Tone,
      icon: AlertTriangle,
      title: "Solicitacao em analise",
      description:
        role === "client"
          ? "A plataforma esta acompanhando a solicitacao financeira deste pedido."
          : "Ha uma solicitacao financeira aberta para este pedido.",
      action: false,
    }
  }

  if (presencaStatus === "AUSENTE") {
    return {
      tone: "danger" as Tone,
      icon: AlertTriangle,
      title: "Ausencia registrada",
      description: "A captura permanece bloqueada enquanto o caso financeiro estiver em analise.",
      action: false,
    }
  }

  if (reembolsoTipo === "CANCELAMENTO_AUTORIZACAO" && reembolsoStatus === "CONCLUIDA") {
    return {
      tone: "final" as Tone,
      icon: CheckCircle2,
      title: "Cancelamento concluido",
      description: "A autorizacao do pagamento foi cancelada para este pedido.",
      action: false,
    }
  }

  if (pedidoStatus === "CONCLUIDO") {
    return {
      tone: "final" as Tone,
      icon: CheckCircle2,
      title: "Pedido concluido",
      description: "Este atendimento foi finalizado.",
      action: false,
    }
  }

  if (pedidoStatus === "PAGO" || pagamentoStatus === "PAGO") {
    return {
      tone: "final" as Tone,
      icon: ShieldCheck,
      title: "Pagamento liberado",
      description: "O pagamento ja foi liberado para este pedido.",
      action: false,
    }
  }

  if (presencaStatus === "PRESENTE") {
    return {
      tone: "final" as Tone,
      icon: CheckCircle2,
      title: "Presenca confirmada",
      description: "A presenca foi confirmada e a liberacao segue o fluxo do pedido.",
      action: false,
    }
  }

  if (pagamentoStatus === "PENDENTE" && pedido.pagamento_finalizado_pelo_cliente) {
    return {
      tone: "positive" as Tone,
      icon: ShieldCheck,
      title: "Pagamento autorizado",
      description:
        role === "client"
          ? "Acesse a etapa de presenca quando o servico terminar."
          : "O pagamento esta autorizado. Compareca no horario combinado.",
      action: role === "client",
      actionLabel: "Gerenciar presenca",
      actionIcon: UserCheck,
    }
  }

  if (pedidoStatus === "ACEITO" && !pedido.pagamento_finalizado_pelo_cliente && pagamentoStatus !== "PAGO") {
    return {
      tone: role === "client" ? ("action" as Tone) : ("neutral" as Tone),
      icon: role === "client" ? CreditCard : Clock3,
      title: role === "client" ? "Pagamento pendente" : "Aguardando pagamento do cliente",
      description:
        role === "client"
          ? "Conclua o pagamento para reservar o bartender."
          : "O cliente precisa concluir o pagamento antes da proxima etapa.",
      action: role === "client",
      actionLabel: "Pagar agora",
      actionIcon: CreditCard,
    }
  }

  return {
    tone: pendingProposalAction === "self" ? ("action" as Tone) : ("neutral" as Tone),
    icon: Clock3,
    title:
      pendingProposalAction === "self"
        ? "Sua resposta e necessaria"
        : role === "client"
          ? "Aguardando resposta do bartender"
          : "Aguardando resposta do cliente",
    description:
      pendingProposalAction === "self"
        ? "Aceite, recuse ou envie uma contraproposta no card da proposta."
        : "Quando houver nova proposta ou resposta, ela aparecera nesta conversa.",
    action: false,
  }
}

export function ChatNextStepBanner({ pedido, role, pedidoId, pendingProposalAction, onPay }: Props) {
  const state = resolveNextStep(pedido, role, pendingProposalAction)
  const style = getToneStyle(state.tone)
  const Icon = state.icon
  const ActionIcon = state.actionIcon ?? CreditCard

  return (
    <div
      style={{
        flexShrink: 0,
        position: "relative",
        zIndex: 1,
        width: "100%",
        padding: "10px clamp(12px, 3vw, 24px)",
        background: "#fff",
        borderBottom: "1px solid #eee",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          padding: "12px 14px",
          border: `0.5px solid ${style.border}`,
          borderRadius: "12px",
          background: style.bg,
          color: style.color,
          boxSizing: "border-box",
          flexWrap: "wrap",
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0, flex: "1 1 260px" }}>
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              background: state.tone === "action" ? "#FFF8DB" : "rgba(255,255,255,0.68)",
              border: `0.5px solid ${state.tone === "action" ? probarYellowBorder : style.border}`,
            }}
          >
            <Icon size={16} color={style.icon} />
          </span>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, lineHeight: 1.25 }}>{state.title}</p>
            <p style={{ margin: "3px 0 0", fontSize: "12px", lineHeight: 1.4, color: style.color }}>
              {state.description}
            </p>
          </div>
        </div>

        {state.action && (
          <button
            type="button"
            onClick={() => onPay?.(pedidoId)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              minHeight: 38,
              padding: "9px 14px",
              borderRadius: "9px",
              border: `0.5px solid ${probarYellowBorder}`,
              background: probarYellow,
              color: "#1a1a1a",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
              boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
            }}
          >
            <ActionIcon size={15} />
            {state.actionLabel ?? "Continuar"}
          </button>
        )}
      </div>
    </div>
  )
}
