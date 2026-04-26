"use client"

export type PropostaStatus = "pendente" | "aceita" | "recusada" | "cancelada" | "substituida"
export type PropostaTipo = "inicial" | "counter"

export type Proposta = {
  id: number
  pedido: number
  remetente: number
  tipo: PropostaTipo
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
  pendente: "Pendente",
  aceita: "Aceita",
  recusada: "Recusada",
  cancelada: "Cancelada",
  substituida: "Substituída",
}

const statusStyle: Record<PropostaStatus, React.CSSProperties> = {
  pendente: { background: "#fff", color: "#BA7517", border: "0.5px solid #EF9F27" },
  aceita: { background: "#EAF3DE", color: "#3B6D11", border: "0.5px solid #97C459" },
  recusada: { background: "#FCEBEB", color: "#A32D2D", border: "0.5px solid #E24B4A" },
  cancelada: { background: "#F1EFE8", color: "#5F5E5A", border: "0.5px solid #B4B2A9" },
  substituida: { background: "#E6F1FB", color: "#185FA5", border: "0.5px solid #85B7EB" },
}

export function PropostaCard({ proposta, currentUserId, onAceitar, onRecusar, onCancelar, onCounter }: Props) {
  const isMinhaProosta = proposta.remetente === currentUserId
  const isPendente = proposta.status === "pendente"

  return (
    <div style={{
      borderRadius: "12px",
      overflow: "hidden",
      border: "0.5px solid #eee",
      backgroundColor: "#fff",
      maxWidth: "340px",
      alignSelf: "flex-end",
    }}>
      {/* Header amarelo */}
      <div style={{
        backgroundColor: "#F5C518",
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <span style={{ fontWeight: 500, fontSize: "14px", color: "#1a1a1a" }}>
          $ Proposta
        </span>
        <span style={{
          fontSize: "11px",
          padding: "2px 8px",
          borderRadius: "20px",
          fontWeight: 500,
          ...statusStyle[proposta.status],
        }}>
          {statusLabel[proposta.status]}
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <span style={{ fontSize: "22px", fontWeight: 500 }}>
            R$ {proposta.valor_total.toLocaleString("pt-BR")}
          </span>
          <span style={{ fontSize: "13px", color: "#888" }}>{proposta.horas}h</span>
        </div>

        <p style={{ fontSize: "12px", color: "#888", marginTop: "6px", lineHeight: 1.5 }}>
          {proposta.tipo === "inicial"
            ? "Proposta inicial para o evento"
            : "Contraproposta enviada"}
        </p>
        <p style={{ fontSize: "11px", color: "#aaa", marginTop: "4px" }}>
          De: {isMinhaProosta ? "Você" : "Bartender"}
        </p>

        {/* Ações condicionais */}
        {isPendente && (
          <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
            {isMinhaProosta ? (
              // Cliente enviou → só pode cancelar
              <button
                onClick={() => onCancelar?.(proposta.id)}
                style={btnStyle("cancel")}
              >
                Cancelar proposta
              </button>
            ) : (
              // Bartender enviou → pode aceitar, recusar ou contraproposta
              <>
                <button onClick={() => onRecusar?.(proposta.id)} style={btnStyle("reject")}>
                  Recusar
                </button>
                <button onClick={() => onCounter?.(proposta.id)} style={btnStyle("default")}>
                  Contraproposta
                </button>
                <button onClick={() => onAceitar?.(proposta.id)} style={btnStyle("accept")}>
                  Aceitar
                </button>
              </>
            )}
          </div>
        )}

        {proposta.status === "aceita" && (
          <p style={{ fontSize: "12px", color: "#3B6D11", marginTop: "10px" }}>
            ✓ Contratação confirmada!
          </p>
        )}
        {proposta.status === "recusada" && (
          <p style={{ fontSize: "12px", color: "#A32D2D", marginTop: "10px" }}>
            Proposta recusada.
          </p>
        )}
        {proposta.status === "cancelada" && (
          <p style={{ fontSize: "12px", color: "#888", marginTop: "10px" }}>
            Proposta cancelada pelo cliente.
          </p>
        )}
      </div>
    </div>
  )
}

function btnStyle(variant: "default" | "accept" | "reject" | "cancel"): React.CSSProperties {
  const base: React.CSSProperties = {
    flex: 1, padding: "7px 0", borderRadius: "8px",
    fontSize: "13px", fontWeight: 500, cursor: "pointer",
  }
  if (variant === "accept") return { ...base, background: "#F5C518", border: "0.5px solid #EF9F27", color: "#1a1a1a" }
  if (variant === "reject") return { ...base, background: "#fff", border: "0.5px solid #E24B4A", color: "#A32D2D" }
  if (variant === "cancel") return { ...base, background: "#f5f5f5", border: "0.5px solid #ddd", color: "#888" }
  return { ...base, background: "#fff", border: "0.5px solid #ddd", color: "#333" }
}