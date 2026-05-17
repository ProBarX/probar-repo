"use client"

import { CalendarDays, Clock, FileText, MapPin, Users } from "lucide-react"
import {
  type ChatAlign,
  chatCardBorder,
  chatCardContainerStyle,
  chatCardShellStyle,
  probarYellow,
} from "@/components/client/chat/chatStyles"

export type EventoChatDetails = {
  nome?: string | null
  data?: string | null
  hora_inicio?: string | null
  hora_fim?: string | null
  cep?: string | null
  rua?: string | null
  numero?: string | null
  complemento?: string | null
  quantidade_convidados?: number | null
  descricao_evento?: string | null
}

function formatDate(value?: string | null) {
  if (!value) return "Data nao informada"
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return value

  return new Date(year, month - 1, day).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function formatTime(value?: string | null) {
  return value?.slice(0, 5) || "--:--"
}

function formatAddress(evento: EventoChatDetails) {
  const street = [evento.rua, evento.numero].filter(Boolean).join(", ")
  const address = [street, evento.complemento, evento.cep].filter(Boolean).join(" - ")
  return address || "Endereco nao informado"
}

export function ChatEventoCard({ evento, align = "left" }: { evento: EventoChatDetails; align?: ChatAlign }) {
  const horario = `${formatTime(evento.hora_inicio)} - ${formatTime(evento.hora_fim)}`
  const endereco = formatAddress(evento)

  return (
    <div style={chatCardContainerStyle(align)}>
      <div
        style={{
          ...chatCardShellStyle,
          borderRadius: "12px",
          overflow: "hidden",
          border: chatCardBorder,
          backgroundColor: "#fff",
          color: "#1a1a1a",
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        }}
      >
        <div
          style={{
            backgroundColor: probarYellow,
            padding: "12px 14px",
            display: "grid",
            gap: 4,
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontWeight: 700,
              fontSize: "15px",
              minWidth: 0,
            }}
          >
            <CalendarDays size={16} strokeWidth={2} style={{ flexShrink: 0 }} />
            <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{evento.nome || "Evento"}</span>
          </span>
          <span style={{ fontSize: "12px", color: "rgba(0,0,0,0.68)", lineHeight: 1.35 }}>
            Resumo do evento combinado para este pedido
          </span>
        </div>

        <div style={{ display: "grid", gap: 11, padding: "13px 14px", fontSize: "13px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
            <InfoRow icon={<CalendarDays size={15} />} label="Data" value={formatDate(evento.data)} />
            <InfoRow icon={<Clock size={15} />} label="Horario" value={horario} />
          </div>
          <InfoRow icon={<MapPin size={15} />} label="Local" value={endereco} />
          <InfoRow
            icon={<Users size={15} />}
            label="Convidados"
            value={`${evento.quantidade_convidados ?? "-"} convidados`}
          />
          {evento.descricao_evento && (
            <InfoRow icon={<FileText size={15} />} label="Descricao" value={evento.descricao_evento} muted />
          )}
        </div>
      </div>
    </div>
  )
}

function InfoRow({
  icon,
  label,
  value,
  muted = false,
}: {
  icon: React.ReactNode
  label: string
  value: string
  muted?: boolean
}) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", color: muted ? "#777" : "#555", minWidth: 0 }}>
      <span style={{ color: "#8a6d00", lineHeight: 0, marginTop: 1, flexShrink: 0 }}>{icon}</span>
      <span style={{ display: "grid", gap: 2, lineHeight: 1.35, minWidth: 0 }}>
        <span style={{ fontSize: "11px", color: "#999", fontWeight: 700, textTransform: "uppercase" }}>{label}</span>
        <span style={{ overflowWrap: "anywhere" }}>{value}</span>
      </span>
    </div>
  )
}
