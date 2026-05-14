"use client"

import type { CSSProperties } from "react"
import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { EventForm } from "@/components/client/event/EventForm"
import { getApiErrorMessage } from "@/lib/api-error"
import {
  createEvento,
  emptyEventoForm,
  hasEventoFormErrors,
  validateEventoForm,
  type EventoForm,
  type EventoFormErrors,
} from "@/services/useEvent"

export default function AddEventPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const bartenderParam = searchParams.get("bartender") ?? ""
  const bartenderName = searchParams.get("bartenderName") ?? ""
  const horas = searchParams.get("horas") ?? ""

  const [form, setForm] = useState<EventoForm>(emptyEventoForm)
  const [errors, setErrors] = useState<EventoFormErrors>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(field: keyof EventoForm, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value } as EventoForm))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })
    setError(null)
  }

  function chooseEventPath(eventoId?: number) {
    const params = new URLSearchParams()
    if (bartenderParam) params.set("bartender", bartenderParam)
    if (bartenderName) params.set("bartenderName", bartenderName)
    if (horas) params.set("horas", horas)
    if (eventoId) params.set("evento", String(eventoId))

    const query = params.toString()
    return `/client/event/choose${query ? `?${query}` : ""}`
  }

  async function handleSave() {
    const validation = validateEventoForm(form)
    setErrors(validation)

    if (hasEventoFormErrors(validation)) {
      setError("Revise os campos destacados para salvar o evento.")
      return
    }

    setSaving(true)
    setError(null)

    try {
      const evento = await createEvento(form)
      router.push(chooseEventPath(evento.id))
    } catch (err) {
      setError(getApiErrorMessage(err, "Nao foi possivel criar o evento."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <main style={pageStyle}>
      <button type="button" onClick={() => router.push(chooseEventPath())} style={backButtonStyle}>
        <ArrowLeft size={16} />
        Voltar
      </button>

      <EventForm
        title="Novo evento"
        description="Preencha o local, a data e os detalhes que o bartender precisa para avaliar o pedido."
        submitLabel="Salvar evento"
        form={form}
        errors={errors}
        errorMessage={error}
        saving={saving}
        onChange={handleChange}
        onSubmit={handleSave}
      />
    </main>
  )
}

const pageStyle: CSSProperties = {
  maxWidth: 900,
  margin: "0 auto",
  display: "grid",
  gap: 18,
}

const backButtonStyle: CSSProperties = {
  width: "fit-content",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  border: "1px solid #D1D5DB",
  background: "#fff",
  color: "#111827",
  borderRadius: 8,
  padding: "9px 12px",
  cursor: "pointer",
  fontWeight: 700,
}
