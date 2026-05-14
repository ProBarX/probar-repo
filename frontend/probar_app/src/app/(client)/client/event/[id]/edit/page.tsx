"use client"

import type { CSSProperties } from "react"
import { use, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react"
import { EventForm } from "@/components/client/event/EventForm"
import { getApiErrorMessage } from "@/lib/api-error"
import {
  apiToForm,
  emptyEventoForm,
  fetchEvento,
  hasEventoFormErrors,
  updateEvento,
  validateEventoForm,
  type EventoForm,
  type EventoFormErrors,
} from "@/services/useEvent"

type Props = { params: Promise<{ id: string }> }

export default function EditEventPage({ params }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { id } = use(params)
  const eventId = Number(id)
  const isValidEventId = Number.isInteger(eventId) && eventId > 0

  const [form, setForm] = useState<EventoForm>(emptyEventoForm)
  const [errors, setErrors] = useState<EventoFormErrors>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!isValidEventId) {
      setLoadError("Evento invalido.")
      setLoading(false)
      return
    }

    let active = true

    fetchEvento(eventId)
      .then((data) => {
        if (active) setForm(apiToForm(data))
      })
      .catch((err) => {
        if (active) {
          setLoadError(getApiErrorMessage(err, "Nao foi possivel carregar o evento."))
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [eventId, isValidEventId])

  function handleChange(field: keyof EventoForm, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value } as EventoForm))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })
    setSaveError(null)
  }

  function chooseEventPath() {
    const queryParams = new URLSearchParams(searchParams.toString())
    if (isValidEventId) queryParams.set("evento", String(eventId))

    const query = queryParams.toString()
    return `/client/event/choose${query ? `?${query}` : ""}`
  }

  async function handleSave() {
    if (!isValidEventId) return

    const validation = validateEventoForm(form)
    setErrors(validation)

    if (hasEventoFormErrors(validation)) {
      setSaveError("Revise os campos destacados para salvar o evento.")
      return
    }

    setSaving(true)
    setSaveError(null)

    try {
      await updateEvento(eventId, form)
      router.push(chooseEventPath())
    } catch (err) {
      setSaveError(getApiErrorMessage(err, "Nao foi possivel atualizar o evento."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <main style={pageStyle}>
      <button type="button" onClick={() => router.back()} style={backButtonStyle}>
        <ArrowLeft size={16} />
        Voltar
      </button>

      {loading && (
        <section style={statePanelStyle}>
          <Loader2 size={24} className="animate-spin" />
          <span>Carregando evento...</span>
        </section>
      )}

      {!loading && loadError && (
        <section style={statePanelStyle}>
          <AlertCircle size={26} color="#991B1B" />
          <h1 style={stateTitleStyle}>Evento indisponivel</h1>
          <p style={stateTextStyle}>{loadError}</p>
        </section>
      )}

      {!loading && !loadError && (
        <EventForm
          title="Editar evento"
          description="Atualize as informacoes do evento antes de enviar ou continuar a negociacao."
          submitLabel="Salvar alteracoes"
          form={form}
          errors={errors}
          errorMessage={saveError}
          saving={saving}
          onChange={handleChange}
          onSubmit={handleSave}
        />
      )}
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

const statePanelStyle: CSSProperties = {
  minHeight: 280,
  border: "1px solid #E5E7EB",
  borderRadius: 8,
  background: "#fff",
  display: "grid",
  placeItems: "center",
  alignContent: "center",
  gap: 10,
  color: "#6B7280",
  padding: 24,
  textAlign: "center",
}

const stateTitleStyle: CSSProperties = {
  margin: 0,
  color: "#111827",
  fontSize: 22,
  fontWeight: 800,
}

const stateTextStyle: CSSProperties = {
  margin: 0,
  color: "#6B7280",
  fontSize: 14,
  lineHeight: 1.5,
}
