"use client"

import type { resolvePedidoVisualStatus } from "@/lib/chat-status"

type Props = {
  status: ReturnType<typeof resolvePedidoVisualStatus>
}

export function ChatStatusBadge({ status }: Props) {
  return (
    <span
      style={{
        display: "inline-flex",
        width: "fit-content",
        maxWidth: "100%",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "12px",
        lineHeight: 1.2,
        padding: "5px 12px",
        borderRadius: "20px",
        fontWeight: 600,
        background: status.bg,
        color: status.color,
        border: status.border,
        whiteSpace: "normal",
        textAlign: "center",
      }}
    >
      {status.label}
    </span>
  )
}
