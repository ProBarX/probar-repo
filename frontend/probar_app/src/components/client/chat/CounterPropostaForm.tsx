"use client"

import { useMemo, useState } from "react"
import { Calculator, Minus, Plus, RotateCcw, Send, X } from "lucide-react"
import {
  chatCardBorder,
  chatCardShellStyle,
  probarBlue,
  probarYellow,
  probarYellowBorder,
} from "@/components/client/chat/chatStyles"

type Props = {
  propostaId: number
  horasAtual: number
  valorAtual: number
  onEnviar: (propostaId: number, dados: { horas: number; desconto?: number; valor_adicional?: number }) => void
  onCancelar: () => void
}

export function CounterPropostaForm({ propostaId, horasAtual, valorAtual, onEnviar, onCancelar }: Props) {
  const [horas, setHoras] = useState(Math.max(1, horasAtual || 1))
  const [ajusteTipo, setAjusteTipo] = useState<"desconto" | "adicional">("desconto")
  const [ajusteValor, setAjusteValor] = useState("")
  const [error, setError] = useState<string | null>(null)

  const valorBase = horasAtual > 0 ? valorAtual / horasAtual : valorAtual
  const ajusteNumerico = parseMoneyInput(ajusteValor)
  const ajusteParaCalculo = Number.isNaN(ajusteNumerico) ? 0 : ajusteNumerico
  const novoTotal = useMemo(
    () =>
      Math.max(
        0,
        valorBase * horas + (ajusteTipo === "adicional" ? ajusteParaCalculo : -ajusteParaCalculo)
      ),
    [ajusteParaCalculo, ajusteTipo, horas, valorBase]
  )

  const handleEnviar = () => {
    setError(null)
    if (Number.isNaN(ajusteNumerico)) {
      setError("Informe um valor numerico valido.")
      return
    }

    onEnviar(propostaId, {
      horas,
      desconto: ajusteTipo === "desconto" && ajusteNumerico > 0 ? ajusteNumerico : undefined,
      valor_adicional: ajusteTipo === "adicional" && ajusteNumerico > 0 ? ajusteNumerico : undefined,
    })
  }

  return (
    <div
      style={{
        ...chatCardShellStyle,
        background: "#fff",
        border: chatCardBorder,
        borderRadius: "12px",
        padding: "14px",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 12 }}>
        <RotateCcw size={17} color={probarBlue} style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <p style={{ fontSize: "15px", fontWeight: 700, margin: 0 }}>Contraproposta para esta proposta</p>
          <p style={{ fontSize: "13px", color: "#777", margin: "3px 0 0", lineHeight: 1.4 }}>
            Ajuste horas e escolha um unico tipo de valor para responder a proposta recebida.
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gap: "10px", marginBottom: "10px" }}>
        <Field label="Horas">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "38px 1fr 38px",
              alignItems: "center",
              border: "0.5px solid #ddd",
              borderRadius: "8px",
              overflow: "hidden",
              background: "#fff",
            }}
          >
            <StepperButton label="Diminuir horas" onClick={() => setHoras((value) => Math.max(1, value - 1))}>
              <Minus size={14} />
            </StepperButton>
            <span style={{ textAlign: "center", fontSize: "14px", fontWeight: 700, color: "#1a1a1a" }}>{horas}h</span>
            <StepperButton label="Aumentar horas" onClick={() => setHoras((value) => value + 1)}>
              <Plus size={14} />
            </StepperButton>
          </div>
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <ModeButton active={ajusteTipo === "desconto"} onClick={() => setAjusteTipo("desconto")}>
            Desconto
          </ModeButton>
          <ModeButton active={ajusteTipo === "adicional"} onClick={() => setAjusteTipo("adicional")}>
            Valor adicional
          </ModeButton>
        </div>

        <Field label={ajusteTipo === "desconto" ? "Desconto (R$)" : "Valor adicional (R$)"}>
          <input
            type="text"
            inputMode="decimal"
            value={ajusteValor}
            onChange={(e) => setAjusteValor(cleanMoneyInput(e.target.value))}
            placeholder="0,00"
            style={inputStyle}
          />
        </Field>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "#fffbea",
          border: `0.5px solid ${probarYellowBorder}`,
          borderRadius: "8px",
          padding: "9px 10px",
          fontSize: "13px",
          color: "#1a1a1a",
          marginBottom: "10px",
          minWidth: 0,
        }}
      >
        <Calculator size={15} color="#8a6d00" style={{ flexShrink: 0 }} />
        <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
          Novo total: <strong>R$ {novoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong> - {horas}h
        </span>
      </div>

      {error && (
        <p style={{ margin: "0 0 10px", color: "#A32D2D", fontSize: "13px", lineHeight: 1.35 }}>{error}</p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: "8px" }}>
        <button type="button" onClick={onCancelar} style={btnSecondary}>
          <X size={15} />
          Descartar
        </button>
        <button type="button" onClick={handleEnviar} style={btnPrimary}>
          <Send size={15} />
          Enviar contraproposta
        </button>
      </div>
    </div>
  )
}

function parseMoneyInput(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return 0
  const normalized = trimmed.includes(",") ? trimmed.replace(/\./g, "").replace(",", ".") : trimmed
  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : Number.NaN
}

function cleanMoneyInput(value: string) {
  return value.replace(/[^\d,.]/g, "")
}

function StepperButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        height: 38,
        border: "none",
        background: "#F5F5F5",
        color: "#555",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  )
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minHeight: 36,
        borderRadius: "8px",
        border: active ? `0.5px solid ${probarYellowBorder}` : "0.5px solid #ddd",
        background: active ? "#FFF8DB" : "#fff",
        color: active ? "#7A5600" : "#555",
        fontSize: "13px",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 4, minWidth: 0 }}>
      <span style={{ fontSize: "13px", color: "#777" }}>{label}</span>
      {children}
    </label>
  )
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 10px",
  border: "0.5px solid #ddd",
  borderRadius: "6px",
  fontSize: "13px",
  color: "#1a1a1a",
  background: "#fff",
}

const buttonBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  minHeight: 38,
  padding: "8px 10px",
  borderRadius: "8px",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
  boxSizing: "border-box",
}

const btnPrimary: React.CSSProperties = {
  ...buttonBase,
  background: probarYellow,
  border: `0.5px solid ${probarYellowBorder}`,
  color: "#1a1a1a",
}

const btnSecondary: React.CSSProperties = {
  ...buttonBase,
  background: "#f5f5f5",
  border: "0.5px solid #ddd",
  color: "#777",
}
