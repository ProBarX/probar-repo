"use client"

import { useState } from "react"

type Props = {
  propostaId: number
  horasAtual: number
  valorAtual: number
  onEnviar: (propostaId: number, dados: { horas: number; desconto?: number; valor_adicional?: number }) => void
  onCancelar: () => void
}

export function CounterPropostaForm({ propostaId, horasAtual, valorAtual, onEnviar, onCancelar }: Props) {
  const [horas, setHoras] = useState(horasAtual)
  const [desconto, setDesconto] = useState(0)
  const [adicional, setAdicional] = useState(0)

  const valorBase = valorAtual / horasAtual
  const novoTotal = valorBase * horas - desconto + adicional

  const handleEnviar = () => {
    if (desconto > 0 && adicional > 0) {
      alert("Não é permitido enviar desconto e valor adicional ao mesmo tempo.")
      return
    }
    onEnviar(propostaId, {
      horas,
      desconto: desconto > 0 ? desconto : undefined,
      valor_adicional: adicional > 0 ? adicional : undefined,
    })
  }

  return (
    <div style={{
      background: "#fff",
      border: "0.5px solid #eee",
      borderRadius: "12px",
      padding: "14px",
      maxWidth: "340px",
      alignSelf: "flex-end",
    }}>
      <p style={{ fontSize: "15px", fontWeight: 500, marginBottom: "10px" }}>
        Enviar contraproposta
      </p>

      <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: "13px", color: "#888", marginBottom: "4px" }}>Horas</p>
          <input
            type="number"
            min={1}
            value={horas}
            onChange={(e) => setHoras(parseInt(e.target.value) || 1)}
            style={inputStyle}
          />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: "13px", color: "#888", marginBottom: "4px" }}>Desconto (R$)</p>
          <input
            type="number"
            min={0}
            value={desconto}
            onChange={(e) => setDesconto(parseFloat(e.target.value) || 0)}
            style={inputStyle}
          />
        </div>
      </div>

      <div style={{ marginBottom: "8px" }}>
        <p style={{ fontSize: "11px", color: "#888", marginBottom: "4px" }}>Valor adicional (R$)</p>
        <input
          type="number"
          min={0}
          value={adicional}
          onChange={(e) => setAdicional(parseFloat(e.target.value) || 0)}
          style={{ ...inputStyle, width: "100%" }}
        />
      </div>

      <div style={{
        background: "#fffbea",
        border: "0.5px solid #EF9F27",
        borderRadius: "8px",
        padding: "8px 10px",
        fontSize: "13px",
        color: "#1a1a1a",
        marginBottom: "10px",
      }}>
        Novo total:{" "}
        <strong>R$ {novoTotal > 0 ? novoTotal.toLocaleString("pt-BR") : "—"}</strong>
        {" "}· {horas}h
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
        <button onClick={onCancelar} style={btnSecondary}>Cancelar</button>
        <button onClick={handleEnviar} style={btnPrimary}>Enviar</button>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 10px",
  border: "0.5px solid #ddd",
  borderRadius: "6px",
  fontSize: "13px",
}

const btnPrimary: React.CSSProperties = {
  flex: 1, padding: "7px 0", borderRadius: "8px",
  fontSize: "13px", fontWeight: 500, cursor: "pointer",
  background: "#F5C518", border: "0.5px solid #EF9F27", color: "#1a1a1a",
}

const btnSecondary: React.CSSProperties = {
  flex: 1, padding: "7px 0", borderRadius: "8px",
  fontSize: "13px", cursor: "pointer",
  background: "#f5f5f5", border: "0.5px solid #ddd", color: "#888",
}