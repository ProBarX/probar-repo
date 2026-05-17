"use client"

import { Info } from "lucide-react"

type Props = {
  conteudo: string
  criadoEm?: string
}

function formatarHora(data?: string) {
  if (!data) return null

  return new Date(data).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function ChatSystemMessage({ conteudo, criadoEm }: Props) {
  const hora = formatarHora(criadoEm)

  return (
    <div
      style={{
        alignSelf: "center",
        width: "min(100%, 420px)",
        display: "flex",
        justifyContent: "center",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "grid",
          justifyItems: "center",
          gap: 5,
          padding: "8px 12px",
          borderRadius: "12px",
          border: "0.5px solid #E7E5DE",
          background: "#F4F3EF",
          color: "#6F6B61",
          fontSize: "12px",
          lineHeight: 1.4,
          textAlign: "center",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            minHeight: 18,
            padding: "2px 7px",
            borderRadius: "999px",
            background: "#fff",
            border: "0.5px solid #E7E5DE",
            color: "#777",
            fontSize: "10px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 0,
          }}
        >
          <Info size={12} />
          Sistema
        </span>
        <span style={{ overflowWrap: "anywhere" }}>{conteudo}</span>
        {hora && <span style={{ fontSize: "10px", color: "#999" }}>{hora}</span>}
      </div>
    </div>
  )
}
