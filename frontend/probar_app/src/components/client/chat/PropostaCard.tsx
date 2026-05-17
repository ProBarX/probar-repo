"use client"

import { Ban, Check, ClipboardList, RotateCcw, X } from "lucide-react"
import {
  chatCardBorder,
  chatCardShellStyle,
  probarBlack,
  probarYellow,
  probarYellowBorder,
} from "@/components/client/chat/chatStyles"

export type PropostaStatus = "PENDENTE" | "ACEITA" | "RECUSADA" | "CANCELADA" | "SUBSTITUIDA"
export type PropostaTipo = "inicial" | "adicional" | "desconto"

export type Proposta = {
  id: number
  pedido: number
  remetente: number
  tipo: PropostaTipo | string
  valor_hora?: number
  horas: number
  valor_adicional: string
  desconto: string
  status: PropostaStatus
  criado_em: string
  valor_total: number
}

type Props = {
  proposta: Proposta
  currentUserId: number
  onAceitar?: (id: number) => void
  onRecusar?: (id: number) => void
  onCancelar?: (id: number) => void
  onCounter?: (id: number) => void
}

const statusLabel: Record<PropostaStatus, string> = {
  PENDENTE: "Pendente",
  ACEITA: "Aceita",
  RECUSADA: "Recusada",
  CANCELADA: "Cancelada",
  SUBSTITUIDA: "Substituida",
}

const statusStyle: Record<PropostaStatus, React.CSSProperties> = {
  PENDENTE: { background: "#F5F5F5", color: "#5F5E5A", border: "0.5px solid #DDDDDD" },
  ACEITA: { background: "#EAF3DE", color: "#3B6D11", border: "0.5px solid #97C459" },
  RECUSADA: { background: "#FCEBEB", color: "#A32D2D", border: "0.5px solid #E24B4A" },
  CANCELADA: { background: "#F1EFE8", color: "#5F5E5A", border: "0.5px solid #B4B2A9" },
  SUBSTITUIDA: { background: "#F5F5F5", color: probarBlack, border: "0.5px solid #21242C" },
}

function money(value: number | string) {
  return Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function PropostaCard({
  proposta,
  currentUserId,
  onAceitar,
  onRecusar,
  onCancelar,
  onCounter,
}: Props) {
  const hasCurrentUser = Number(currentUserId) > 0
  const isMinhaProposta = hasCurrentUser && Number(proposta.remetente) === Number(currentUserId)
  const isPendente = proposta.status === "PENDENTE"
  const status = (proposta.status?.toUpperCase() ?? "PENDENTE") as PropostaStatus
  const senderLabel = isMinhaProposta ? "Enviada por voce" : "Recebida para resposta"
  const desconto = Number(proposta.desconto || 0)
  const adicional = Number(proposta.valor_adicional || 0)
  const isContraproposta = proposta.tipo !== "inicial"

  return (
    <div
      style={{
        ...chatCardShellStyle,
        borderRadius: "12px",
        overflow: "hidden",
        border: chatCardBorder,
        backgroundColor: "#fff",
      }}
    >
      <div
        style={{
          backgroundColor: probarYellow,
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontWeight: 600,
            fontSize: "15px",
            color: "#1a1a1a",
            minWidth: 0,
          }}
        >
          <ClipboardList size={16} strokeWidth={2} />
          Proposta
        </span>
        <span
          style={{
            flexShrink: 0,
            fontSize: "12px",
            padding: "2px 8px",
            borderRadius: "20px",
            fontWeight: 600,
            ...(statusStyle[status] ?? statusStyle.PENDENTE),
          }}
        >
          {statusLabel[status] ?? status}
        </span>
      </div>

      <div style={{ padding: "12px 14px" }}>
        <div style={{ display: "grid", gap: 8 }}>
          <p style={{ fontSize: "13px", color: "#777", margin: 0, lineHeight: 1.4 }}>{senderLabel}</p>
          {isContraproposta && (
            <p
              style={{
                display: "inline-flex",
                width: "fit-content",
                alignItems: "center",
                gap: 6,
                fontSize: "12px",
                color: probarBlack,
                background: "#F5F5F5",
                border: "0.5px solid #21242C",
                borderRadius: "20px",
                padding: "4px 9px",
                margin: 0,
                fontWeight: 600,
              }}
            >
              <RotateCcw size={13} />
              Resposta a proposta anterior
            </p>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.3fr) minmax(78px, 0.7fr)",
            gap: 10,
            alignItems: "stretch",
            marginTop: 12,
          }}
        >
          <Metric label="Valor total" value={`R$ ${money(proposta.valor_total)}`} strong />
          <Metric label="Horas" value={`${proposta.horas}h`} />
        </div>

        {(desconto > 0 || adicional > 0) && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 9 }}>
            {desconto > 0 && <Pill tone="discount" label={`Desconto de R$ ${money(desconto)}`} />}
            {adicional > 0 && <Pill tone="additional" label={`Adicional de R$ ${money(adicional)}`} />}
          </div>
        )}

        {hasCurrentUser && isPendente && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "13px" }}>
            {isMinhaProposta ? (
              <button type="button" onClick={() => onCancelar?.(proposta.id)} style={btnStyle("cancel")}>
                <Ban size={15} />
                Cancelar proposta
              </button>
            ) : (
              <>
                <button type="button" onClick={() => onAceitar?.(proposta.id)} style={btnStyle("accept")}>
                  <Check size={15} />
                  Aceitar
                </button>
                <button type="button" onClick={() => onCounter?.(proposta.id)} style={btnStyle("default")}>
                  <RotateCcw size={15} />
                  Contraproposta
                </button>
                <button type="button" onClick={() => onRecusar?.(proposta.id)} style={btnStyle("reject")}>
                  <X size={15} />
                  Recusar
                </button>
              </>
            )}
          </div>
        )}

        {status === "ACEITA" && (
          <p style={{ fontSize: "13px", color: "#5F5E5A", margin: "10px 0 0" }}>Proposta aceita.</p>
        )}
        {status === "RECUSADA" && (
          <p style={{ fontSize: "14px", color: "#A32D2D", margin: "10px 0 0" }}>Proposta recusada.</p>
        )}
        {status === "CANCELADA" && (
          <p style={{ fontSize: "14px", color: "#777", margin: "10px 0 0" }}>Proposta cancelada.</p>
        )}
        {status === "SUBSTITUIDA" && (
          <p style={{ fontSize: "14px", color: probarBlack, margin: "10px 0 0" }}>
            Proposta substituida por nova versao.
          </p>
        )}
      </div>
    </div>
  )
}

function Metric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      style={{
        display: "grid",
        gap: 3,
        background: "#FAFAFA",
        border: "0.5px solid #eee",
        borderRadius: "9px",
        padding: "9px 10px",
        minWidth: 0,
      }}
    >
      <span style={{ fontSize: "11px", color: "#999", fontWeight: 700, textTransform: "uppercase" }}>{label}</span>
      <span
        style={{
          fontSize: strong ? "20px" : "16px",
          fontWeight: strong ? 700 : 600,
          color: "#1a1a1a",
          lineHeight: 1.2,
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </span>
    </div>
  )
}

function Pill({ label, tone }: { label: string; tone: "discount" | "additional" }) {
  const isDiscount = tone === "discount"
  return (
    <span
      style={{
        display: "inline-flex",
        width: "fit-content",
        fontSize: "12px",
        fontWeight: 600,
        borderRadius: "20px",
        padding: "4px 9px",
        background: isDiscount ? "#F4FAEC" : "#F1F6FB",
        color: isDiscount ? probarBlack : probarBlack,
        border: isDiscount ? "0.5px solid #acacac" : "0.5px solid #C8DBEE",
      }}
    >
      {label}
    </span>
  )
}

function btnStyle(variant: "default" | "accept" | "reject" | "cancel"): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 38,
    padding: "8px 10px",
    borderRadius: "8px",
    fontSize: "13px",
    lineHeight: 1.2,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "normal",
    textAlign: "center",
    boxSizing: "border-box",
  }
  if (variant === "accept") {
    return {
      ...base,
      gridColumn: "1 / -1",
      background: probarYellow,
      border: `0.5px solid ${probarYellowBorder}`,
      color: "#1a1a1a",
    }
  }
  if (variant === "reject") return { ...base, background: "#fff", border: "0.5px solid #E24B4A", color: "#A32D2D" }
  if (variant === "cancel") {
    return {
      ...base,
      gridColumn: "1 / -1",
      background: "#f5f5f5",
      border: "0.5px solid #ddd",
      color: "#777",
    }
  }
  return { ...base, background: "#fff", border: "0.5px solid #ddd", color: "#333" }
}
