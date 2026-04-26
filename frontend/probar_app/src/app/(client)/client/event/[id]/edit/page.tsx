"use client"

import { use, useState } from "react"
import { useRouter } from "next/navigation"

// Mock de eventos — substituir por fetch real usando o `id` da rota
const mockEvents: Record<number, {
  cep: string
  rua: string
  numero: string
  semNumero: boolean
  complemento: string
  nome: string
  quantidade: string
  descricao: string
  data: string
  horarioInicio: string
  horarioFim: string
}> = {
  1: {
    cep: "01000000",
    rua: "Av. Paulista",
    numero: "1000",
    semNumero: false,
    complemento: "",
    nome: "Conexão Digital",
    quantidade: "150",
    descricao: "Evento de tecnologia com networking e coquetel",
    data: "15/04/2026",
    horarioInicio: "19:00",
    horarioFim: "23:00",
  },
  2: {
    cep: "06410001",
    rua: "Rua das Flores",
    numero: "200",
    semNumero: false,
    complemento: "",
    nome: "Agro Experience",
    quantidade: "300",
    descricao: "Feira agropecuária com degustação",
    data: "20/05/2026",
    horarioInicio: "10:00",
    horarioFim: "18:00",
  },
}

type Props = {
  params: Promise<{ id: string }>
}

export default function EditEventPage({ params }: Props) {
  const router = useRouter()
  const { id } = use(params)
  const eventId = Number(id)
  const initial = mockEvents[eventId] ?? mockEvents[1]

  const [form, setForm] = useState(initial)

  function handleChange(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSave() {
    // Aqui entraria a lógica de salvar via API
    router.push("/client/event/choose")
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "8px",
    border: "0.5px solid #ddd",
    fontSize: "14px",
    color: "#1a1a1a",
    fontFamily: "inherit",
    outline: "none",
  }

  const labelStyle: React.CSSProperties = {
    fontSize: "13px",
    color: "#888",
    marginBottom: "6px",
    display: "block",
  }

  return (
    <div>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
        <button
          onClick={() => router.push("/client/event/choose")}
          style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", color: "#888", lineHeight: 1 }}
        >
          ‹
        </button>
        <span style={{ flex: 1, textAlign: "center", fontSize: "15px", fontWeight: 500 }}>Voltar</span>
      </div>

      <h2 style={{ fontSize: "26px", fontWeight: 600, marginBottom: "24px" }}>Editar evento</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        {/* CEP */}
        <div>
          <label style={labelStyle}>CEP do local do evento</label>
          <input
            type="text"
            value={form.cep}
            onChange={(e) => handleChange("cep", e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Rua */}
        <div>
          <label style={labelStyle}>Rua / Avenida</label>
          <input
            type="text"
            value={form.rua}
            onChange={(e) => handleChange("rua", e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Número */}
        <div>
          <label style={labelStyle}>Número</label>
          <div style={{ position: "relative" }}>
            <input
              type="text"
              value={form.numero}
              disabled={form.semNumero}
              onChange={(e) => handleChange("numero", e.target.value)}
              style={{ ...inputStyle, paddingRight: "120px", opacity: form.semNumero ? 0.4 : 1 }}
            />
            <div
              style={{
                position: "absolute",
                right: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                color: "#888",
                whiteSpace: "nowrap",
              }}
            >
              Sem Número
              <div
                onClick={() => handleChange("semNumero", !form.semNumero)}
                style={{
                  width: "28px",
                  height: "16px",
                  background: form.semNumero ? "#F5C518" : "#ddd",
                  borderRadius: "8px",
                  cursor: "pointer",
                  position: "relative",
                  flexShrink: 0,
                  transition: "background 0.15s",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    width: "12px",
                    height: "12px",
                    background: "#fff",
                    borderRadius: "50%",
                    top: "2px",
                    left: form.semNumero ? "14px" : "2px",
                    transition: "left 0.15s",
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Complemento */}
        <div>
          <label style={labelStyle}>Complemento (opcional)</label>
          <input
            type="text"
            placeholder="Ex: 201"
            value={form.complemento}
            onChange={(e) => handleChange("complemento", e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Nome */}
        <div>
          <label style={labelStyle}>Nome do evento</label>
          <input
            type="text"
            value={form.nome}
            onChange={(e) => handleChange("nome", e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Quantidade */}
        <div>
          <label style={labelStyle}>Quantidade de pessoas</label>
          <input
            type="text"
            value={form.quantidade}
            onChange={(e) => handleChange("quantidade", e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Descrição */}
        <div>
          <label style={labelStyle}>Descrição do evento</label>
          <textarea
            maxLength={128}
            value={form.descricao}
            onChange={(e) => handleChange("descricao", e.target.value)}
            style={{ ...inputStyle, height: "100px", resize: "none" }}
          />
          <span style={{ fontSize: "11px", color: "#aaa" }}>{form.descricao.length}/128</span>
        </div>

        {/* Data + Horários */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label style={labelStyle}>Data</label>
            <input
              type="text"
              value={form.data}
              onChange={(e) => handleChange("data", e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={labelStyle}>Horário de início</label>
              <input
                type="text"
                value={form.horarioInicio}
                onChange={(e) => handleChange("horarioInicio", e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Horário de fim</label>
              <input
                type="text"
                value={form.horarioFim}
                onChange={(e) => handleChange("horarioFim", e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        style={{
          width: "100%",
          padding: "14px",
          background: "#F5C518",
          border: "none",
          borderRadius: "28px",
          fontSize: "15px",
          fontWeight: 600,
          cursor: "pointer",
          marginTop: "24px",
          color: "#1a1a1a",
        }}
      >
        Salvar
      </button>
    </div>
  )
}