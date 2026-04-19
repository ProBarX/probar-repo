"use client"

import { useState } from "react"
import type { CSSProperties } from "react"

export type ClientProfile = {
  nome: string
  email: string
  data_nascimento: string
  membro_desde: string
  total_eventos: number
  eventos: {
    nome: string
    data: string
    status: "Concluído" | "Em andamento" | "Cancelado"
  }[]
}

type Props = {
  profile: ClientProfile
}

export function ProfileView({ profile }: Props) {
  const initials = profile.nome
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase()

  const statusColor: Record<string, string> = {
    "Concluído":    "#888",
    "Em andamento": "#d4860a",
    "Cancelado":    "#e53e3e",
  }

  return (
    <div style={{ maxWidth: "780px" }} className="mx-auto">
      <h2 style={{ fontSize: "22px", fontWeight: "700", margin: "0 0 24px" }}>Meu perfil</h2>

      {/* Card principal — avatar + info lado a lado */}
      <div style={cardStyle}>
        {/* Avatar */}
        <div style={{
          width: "72px",
          height: "72px",
          borderRadius: "50%",
          background: "#ddd",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "24px",
          fontWeight: "700",
          color: "#555",
          flexShrink: 0,
        }}>
          {initials}
        </div>

        {/* Info */}
        <div>
          <h3 style={{ margin: "0 0 4px", fontSize: "20px", fontWeight: "700" }}>{profile.nome}</h3>
          <p style={{ margin: "0 0 12px", color: "#888", fontSize: "13px" }}>
            Membro desde {profile.membro_desde}
          </p>
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            background: "#fdf6dc",
            border: "1px solid #f5e090",
            borderRadius: "20px",
            padding: "4px 14px",
            fontSize: "13px",
            fontWeight: "500",
            color: "#8a6d00",
          }}>
            🎉 {profile.total_eventos} eventos criados
          </span>
        </div>
      </div>

      {/* Informações pessoais */}
      <div style={{ ...cardStyle, flexDirection: "column", alignItems: "stretch", gap: "0" }}>
        <h4 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: "600" }}>Informações pessoais</h4>

        <InfoRow icon="✉️" label="Email"              value={profile.email} />
        <div style={{ height: "1px", background: "#f0f0f0", margin: "0 -4px" }} />
        <InfoRow icon="👥" label="Data de nascimento" value={profile.data_nascimento} />
      </div>

      {/* Eventos recentes */}
      <div style={{ ...cardStyle, flexDirection: "column", alignItems: "stretch", gap: "0" }}>
        <h4 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: "600" }}>Eventos recentes</h4>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {profile.eventos.map((evento, i) => (
            <div key={i} style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#f5f5f5",
              borderRadius: "8px",
              padding: "12px 16px",
            }}>
              <div>
                <p style={{ margin: 0, fontWeight: "600", fontSize: "14px" }}>{evento.nome}</p>
                <p style={{ margin: 0, color: "#888", fontSize: "12px" }}>{evento.data}</p>
              </div>
              <span style={{
                fontSize: "13px",
                fontWeight: "500",
                color: statusColor[evento.status] ?? "#888",
              }}>
                {evento.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── InfoRow ───────────────────────────────────────────────────────────────────
function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value)

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      background: "#f9f9f9",
      borderRadius: "8px",
      padding: "12px 14px",
      margin: "6px 0",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <span style={{
          width: "32px",
          height: "32px",
          background: "#fdf6dc",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "16px",
          flexShrink: 0,
        }}>
          {icon}
        </span>
        <div>
          <p style={{ margin: 0, fontSize: "11px", color: "#aaa" }}>{label}</p>
          {editing ? (
            <input
              autoFocus
              value={val}
              onChange={(e) => setVal(e.target.value)}
              onBlur={() => setEditing(false)}
              onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
              style={{
                border: "none",
                borderBottom: "1px solid #F5C518",
                outline: "none",
                fontSize: "14px",
                fontWeight: "500",
                background: "transparent",
                padding: "2px 0",
                width: "260px",
              }}
            />
          ) : (
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "500" }}>{val}</p>
          )}
        </div>
      </div>
      <button
        onClick={() => setEditing((e) => !e)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#bbb",
          fontSize: "15px",
          padding: "4px",
          lineHeight: 1,
        }}
        title="Editar"
      >
        ✏️
      </button>
    </div>
  )
}

// ── Estilo compartilhado ──────────────────────────────────────────────────────
const cardStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "20px",
  border: "1px solid #e8e8e8",
  borderRadius: "12px",
  padding: "20px 24px",
  marginBottom: "20px",
  backgroundColor: "#fff",
}