"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createEvento, type EventoForm } from "@/services/useEvent"
import type { ApiError } from "@/types/user"

function formDateToInput(brDate: string): string {
  if (!brDate || !brDate.includes("/")) return ""
  const [day, month, year] = brDate.split("/")
  return `${year}-${month}-${day}`
}
function inputDateToForm(isoDate: string): string {
  if (!isoDate || !isoDate.includes("-")) return ""
  const [year, month, day] = isoDate.split("-")
  return `${day}/${month}/${year}`
}

const emptyForm: EventoForm = {
  cep: "", rua: "", numero: "", semNumero: false, complemento: "",
  nome: "", quantidade: "", descricao: "", data: "", horarioInicio: "", horarioFim: "",
}

export default function AddEventPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const bartenderEmail = searchParams.get("bartender") ?? ""
  const horas = searchParams.get("horas") ?? ""
  const [form, setForm] = useState<EventoForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function chooseEventPath(eventoId?: number) {
    const params = new URLSearchParams()
    if (bartenderEmail) params.set("bartender", bartenderEmail)
    if (horas) params.set("horas", horas)
    if (eventoId) params.set("evento", String(eventoId))

    const query = params.toString()
    return `/client/event/choose${query ? `?${query}` : ""}`
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const evento = await createEvento(form)
      router.push(chooseEventPath(evento.id))
    } catch (err) {
      const apiErr = err as ApiError
      const detail = apiErr?.response?.data
        ? JSON.stringify(apiErr.response.data, null, 2)
        : "Verifique os dados e tente novamente."
      setError(`Erro: ${detail}`)
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 16px", borderRadius: "8px",
    border: "0.5px solid #ddd", fontSize: "16px", color: "#1a1a1a",
    fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  }
  const labelStyle: React.CSSProperties = {
    fontSize: "15px", color: "#888", marginBottom: "6px", display: "block",
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
        <button
          onClick={() => router.push(chooseEventPath())}
          style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", color: "#888" }}
        >
          ‹ <span style={{ fontSize: "18px", fontWeight: 500 }}>Voltar</span>
        </button>
      </div>

      <h2 style={{ fontSize: "32px", fontWeight: 600, marginBottom: "24px" }}>
        Adicione informações sobre o evento
      </h2>

      {error && (
        <pre style={{
          color: "#e53e3e", fontSize: "13px", marginBottom: "16px",
          background: "#fff5f5", padding: "12px", borderRadius: "8px",
          whiteSpace: "pre-wrap", wordBreak: "break-word",
        }}>
          {error}
        </pre>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div>
          <label style={labelStyle}>CEP do local do evento</label>
          <input type="text" placeholder="01000000" value={form.cep}
            onChange={(e) => handleChange("cep", e.target.value)} style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Rua / Avenida</label>
          <input type="text" placeholder="Av. Paulista" value={form.rua}
            onChange={(e) => handleChange("rua", e.target.value)} style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Número</label>
          <div style={{ position: "relative" }}>
            <input type="text" placeholder="1000" value={form.numero}
              disabled={form.semNumero}
              onChange={(e) => handleChange("numero", e.target.value)}
              style={{ ...inputStyle, paddingRight: "120px", opacity: form.semNumero ? 0.4 : 1 }}
            />
            <div style={{
              position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
              display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", color: "#888", whiteSpace: "nowrap",
            }}>
              Sem Número
              <div onClick={() => handleChange("semNumero", !form.semNumero)} style={{
                width: "28px", height: "16px", background: form.semNumero ? "#F5C518" : "#ddd",
                borderRadius: "8px", cursor: "pointer", position: "relative", flexShrink: 0, transition: "background 0.15s",
              }}>
                <div style={{
                  position: "absolute", width: "12px", height: "12px", background: "#fff",
                  borderRadius: "50%", top: "2px", left: form.semNumero ? "14px" : "2px", transition: "left 0.15s",
                }} />
              </div>
            </div>
          </div>
        </div>

        <div>
          <label style={labelStyle}>Complemento (opcional)</label>
          <input type="text" placeholder="Ex: 201" value={form.complemento}
            onChange={(e) => handleChange("complemento", e.target.value)} style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Nome do evento</label>
          <input type="text" placeholder="Conexão Digital" value={form.nome}
            onChange={(e) => handleChange("nome", e.target.value)} style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Quantidade de pessoas</label>
          <input type="number" placeholder="150" min={1} value={form.quantidade}
            onChange={(e) => handleChange("quantidade", e.target.value)} style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Descrição do evento</label>
          <textarea maxLength={128} placeholder="Evento de tecnologia com networking e coquetel"
            value={form.descricao}
            onChange={(e) => handleChange("descricao", e.target.value)}
            style={{ ...inputStyle, height: "100px", resize: "none" }}
          />
          <span style={{ fontSize: "13px", color: "#aaa" }}>{form.descricao.length}/128</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label style={labelStyle}>Data</label>
            <input
              type="date"
              value={formDateToInput(form.data)}
              onChange={(e) => handleChange("data", inputDateToForm(e.target.value))}
              style={inputStyle}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={labelStyle}>Horário de início</label>
              <input type="time" value={form.horarioInicio}
                onChange={(e) => handleChange("horarioInicio", e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Horário de fim</label>
              <input type="time" value={form.horarioFim}
                onChange={(e) => handleChange("horarioFim", e.target.value)} style={inputStyle} />
            </div>
          </div>
        </div>
      </div>

      <button onClick={handleSave} disabled={saving} style={{
        width: "459px", padding: "14px", background: saving ? "#ddd" : "#F5C518",
        border: "none", borderRadius: "20px", fontSize: "17px", fontWeight: 600,
        cursor: saving ? "not-allowed" : "pointer", margin: "24px auto 0 auto",
        display: "block", color: "#1a1a1a",
      }}>
        {saving ? "Salvando..." : "Salvar"}
      </button>
    </div>
  )
}
