"use client"

import type { CSSProperties, ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  Edit3,
  Loader2,
  MapPin,
  Plus,
  UserRound,
} from "lucide-react"
import { getApiErrorMessage } from "@/lib/api-error"
import { api } from "@/services/api"
import { fetchBartenderByIdentifier } from "@/services/bartenders"
import { fetchEventos, formatEventoStatus, type EventoAPI } from "@/services/useEvent"

export default function ChooseEventPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const bartenderParam = searchParams.get("bartender") ?? ""
  const bartenderNameParam = searchParams.get("bartenderName") ?? ""
  const horasParam = searchParams.get("horas")
  const eventoParam = searchParams.get("evento") ?? ""
  const horas = useMemo(() => parseServiceHours(horasParam), [horasParam])

  const [bartenderId, setBartenderId] = useState<number | null>(null)
  const [bartenderName, setBartenderName] = useState(bartenderNameParam)
  const [eventos, setEventos] = useState<EventoAPI[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [bartenderError, setBartenderError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function init() {
      setLoading(true)
      setLoadError(null)
      setBartenderError(null)
      setSubmitError(null)
      setBartenderId(null)

      try {
        const [eventosData, bartender] = await Promise.all([
          fetchEventos(),
          bartenderParam ? fetchBartenderByIdentifier(bartenderParam) : Promise.resolve(null),
        ])

        if (!active) return

        setEventos(eventosData)

        if (eventosData.length > 0) {
          const eventoId = Number(eventoParam)
          const selected = eventosData.find((ev) => ev.id === eventoId)
          setSelectedId(selected?.id ?? eventosData[0].id)
        } else {
          setSelectedId(null)
        }

        if (!bartenderParam) {
          setBartenderName("")
          return
        }

        if (bartender?.user_id) {
          setBartenderId(bartender.user_id)
          setBartenderName(bartenderNameParam || bartender.nome || bartender.email)
        } else {
          setBartenderError("Bartender nao encontrado. Volte e selecione outro profissional.")
        }
      } catch (err) {
        if (active) {
          setLoadError(getApiErrorMessage(err, "Nao foi possivel carregar seus eventos."))
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    init()

    return () => {
      active = false
    }
  }, [bartenderNameParam, bartenderParam, eventoParam])

  function currentQueryWithEvento(eventoId: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("evento", String(eventoId))
    return params.toString()
  }

  function goToNewEvent() {
    const query = searchParams.toString()
    router.push(`/client/event/new${query ? `?${query}` : ""}`)
  }

  function goToEditEvent(eventoId: number) {
    router.push(`/client/event/${eventoId}/edit?${currentQueryWithEvento(eventoId)}`)
  }

  async function handleContinuar() {
    if (!selectedId) {
      setSubmitError("Selecione ou crie um evento para continuar.")
      return
    }

    if (!bartenderId) {
      setSubmitError("Selecione um bartender antes de criar o pedido.")
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    try {
      await api.post("/pedidos/", {
        bartender: bartenderId,
        evento: selectedId,
        horas,
      })

      router.push("/client/chat")
    } catch (err) {
      setSubmitError(getApiErrorMessage(err, "Nao foi possivel criar o pedido."))
    } finally {
      setSubmitting(false)
    }
  }

  const canContinue = Boolean(selectedId && bartenderId && !loading && !submitting)

  return (
    <main style={pageStyle}>
      <button type="button" onClick={() => router.back()} style={backButtonStyle}>
        <ArrowLeft size={16} />
        Voltar
      </button>

      <header style={headerStyle}>
        <h1 style={titleStyle}>Escolha o evento</h1>
        <p style={subtitleStyle}>
          Selecione um evento existente ou crie um novo para enviar ao bartender.
        </p>
      </header>

      {bartenderParam && !bartenderError && (
        <Notice
          tone="info"
          icon={<UserRound size={18} />}
          message={`${bartenderName || bartenderParam} - ${horas}h de servico`}
        />
      )}

      {!bartenderParam && (
        <Notice
          tone="error"
          icon={<AlertCircle size={18} />}
          message="Bartender nao identificado. Volte e selecione um bartender."
        />
      )}

      {bartenderError && (
        <Notice tone="error" icon={<AlertCircle size={18} />} message={bartenderError} />
      )}

      {submitError && (
        <Notice tone="error" icon={<AlertCircle size={18} />} message={submitError} />
      )}

      <section style={panelStyle}>
        <div style={panelHeaderStyle}>
          <div>
            <h2 style={panelTitleStyle}>Meus eventos</h2>
            <p style={panelDescriptionStyle}>Use os dados do evento para abrir a negociacao.</p>
          </div>
          <button type="button" onClick={goToNewEvent} style={secondaryButtonStyle}>
            <Plus size={16} />
            Criar evento
          </button>
        </div>

        {loading && (
          <div style={stateStyle}>
            <Loader2 size={24} className="animate-spin" />
            <span>Carregando eventos...</span>
          </div>
        )}

        {!loading && loadError && (
          <div style={stateStyle}>
            <AlertCircle size={26} color="#991B1B" />
            <strong style={{ color: "#111827" }}>Eventos indisponiveis</strong>
            <span>{loadError}</span>
          </div>
        )}

        {!loading && !loadError && eventos.length === 0 && (
          <div style={stateStyle}>
            <CalendarDays size={28} color="#8A6D00" />
            <strong style={{ color: "#111827" }}>Nenhum evento cadastrado</strong>
            <span>Crie um evento para iniciar a negociacao com o bartender.</span>
            <button type="button" onClick={goToNewEvent} style={primaryButtonStyle(false)}>
              <Plus size={16} />
              Criar evento
            </button>
          </div>
        )}

        {!loading && !loadError && eventos.length > 0 && (
          <div role="radiogroup" aria-label="Eventos" style={eventListStyle}>
            {eventos.map((ev) => {
              const selected = selectedId === ev.id

              return (
                <article
                  key={ev.id}
                  role="radio"
                  aria-checked={selected}
                  tabIndex={0}
                  onClick={() => {
                    setSelectedId(ev.id)
                    setSubmitError(null)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      setSelectedId(ev.id)
                      setSubmitError(null)
                    }
                  }}
                  style={eventCardStyle(selected)}
                >
                  <div style={radioStyle(selected)}>
                    {selected && <CheckCircle2 size={15} />}
                  </div>

                  <div style={eventContentStyle}>
                    <div style={eventTitleRowStyle}>
                      <div style={{ minWidth: 0 }}>
                        <h3 style={eventNameStyle}>{ev.nome}</h3>
                        <EventStatusBadge status={ev.status} />
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          goToEditEvent(ev.id)
                        }}
                        style={editButtonStyle}
                      >
                        <Edit3 size={15} />
                        Editar
                      </button>
                    </div>

                    <div style={metaGridStyle}>
                      <MetaItem icon={<CalendarDays size={14} />} text={formatEventDate(ev.data)} />
                      <MetaItem icon={<Clock size={14} />} text={formatTimeRange(ev)} />
                      <MetaItem icon={<MapPin size={14} />} text={formatAddress(ev)} wide />
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {!loadError && (
        <div style={actionsStyle}>
          <button type="button" disabled={!canContinue} onClick={handleContinuar} style={primaryButtonStyle(!canContinue)}>
            {submitting ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}
            {submitting ? "Criando pedido..." : "Continuar"}
          </button>
        </div>
      )}
    </main>
  )
}

function parseServiceHours(value: string | null) {
  const parsed = Number(value ?? 1)
  if (!Number.isInteger(parsed) || parsed < 1) return 1
  return Math.min(parsed, 24)
}

function formatEventDate(value: string) {
  if (!value) return "Data nao informada"

  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

function formatTimeRange(evento: EventoAPI) {
  const start = evento.hora_inicio?.slice(0, 5)
  const end = evento.hora_fim?.slice(0, 5)

  if (start && end) return `${start} - ${end}`
  if (start) return start

  return "Horario nao informado"
}

function formatAddress(evento: EventoAPI) {
  const street = [evento.rua, evento.numero].filter(Boolean).join(", ")
  return [street, evento.complemento, evento.cep].filter(Boolean).join(" - ") || "Endereco nao informado"
}

function Notice({
  tone,
  icon,
  message,
}: {
  tone: "info" | "error"
  icon: ReactNode
  message: string
}) {
  const isError = tone === "error"

  return (
    <div
      role={isError ? "alert" : "status"}
      style={{
        ...noticeStyle,
        color: isError ? "#991B1B" : "#7A5000",
        background: isError ? "#FEF2F2" : "#FFFBEB",
        borderColor: isError ? "#FECACA" : "#F5C518",
      }}
    >
      {icon}
      <span>{message}</span>
    </div>
  )
}

function MetaItem({ icon, text, wide = false }: { icon: ReactNode; text: string; wide?: boolean }) {
  return (
    <span style={{ ...metaItemStyle, gridColumn: wide ? "1 / -1" : undefined }}>
      {icon}
      {text}
    </span>
  )
}

function EventStatusBadge({ status }: { status?: string }) {
  const label = formatEventoStatus(status)
  const styles: Record<string, { color: string; background: string; border: string }> = {
    "Em andamento": { color: "#7A5000", background: "#FFFBEB", border: "#FDE68A" },
    Confirmado: { color: "#185FA5", background: "#EFF6FF", border: "#BFDBFE" },
    Finalizado: { color: "#166534", background: "#F0FDF4", border: "#BBF7D0" },
    Cancelado: { color: "#991B1B", background: "#FEF2F2", border: "#FECACA" },
  }
  const cfg = styles[label]

  return (
    <span
      style={{
        display: "inline-flex",
        width: "fit-content",
        marginTop: 6,
        borderRadius: 999,
        border: `1px solid ${cfg.border}`,
        background: cfg.background,
        color: cfg.color,
        padding: "3px 8px",
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {label}
    </span>
  )
}

const pageStyle: CSSProperties = {
  maxWidth: 920,
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

const headerStyle: CSSProperties = {
  display: "grid",
  gap: 6,
}

const titleStyle: CSSProperties = {
  margin: 0,
  color: "#111827",
  fontSize: 30,
  lineHeight: 1.15,
  fontWeight: 800,
}

const subtitleStyle: CSSProperties = {
  margin: 0,
  color: "#6B7280",
  fontSize: 14,
  lineHeight: 1.5,
}

const noticeStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  border: "1px solid",
  borderRadius: 8,
  padding: "11px 13px",
  fontSize: 14,
  fontWeight: 650,
}

const panelStyle: CSSProperties = {
  border: "1px solid #E5E7EB",
  borderRadius: 8,
  background: "#fff",
  padding: 20,
  display: "grid",
  gap: 16,
  minWidth: 0,
}

const panelHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
}

const panelTitleStyle: CSSProperties = {
  margin: 0,
  color: "#111827",
  fontSize: 18,
  fontWeight: 800,
}

const panelDescriptionStyle: CSSProperties = {
  margin: "4px 0 0",
  color: "#6B7280",
  fontSize: 13,
  lineHeight: 1.4,
}

const stateStyle: CSSProperties = {
  minHeight: 220,
  display: "grid",
  placeItems: "center",
  alignContent: "center",
  gap: 10,
  color: "#6B7280",
  textAlign: "center",
  padding: 18,
}

const eventListStyle: CSSProperties = {
  display: "grid",
  gap: 12,
}

function eventCardStyle(selected: boolean): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "24px minmax(0, 1fr)",
    gap: 14,
    border: selected ? "1px solid #F5C518" : "1px solid #E5E7EB",
    borderRadius: 8,
    background: selected ? "#FFFBEB" : "#fff",
    padding: 16,
    cursor: "pointer",
    minWidth: 0,
    boxSizing: "border-box",
  }
}

function radioStyle(selected: boolean): CSSProperties {
  return {
    width: 22,
    height: 22,
    borderRadius: "50%",
    border: selected ? "1px solid #F5C518" : "1px solid #D1D5DB",
    background: selected ? "#F5C518" : "#fff",
    color: "#111827",
    display: "grid",
    placeItems: "center",
    marginTop: 2,
    flexShrink: 0,
  }
}

const eventContentStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  minWidth: 0,
}

const eventTitleRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  minWidth: 0,
}

const eventNameStyle: CSSProperties = {
  margin: 0,
  color: "#111827",
  fontSize: 17,
  fontWeight: 800,
  lineHeight: 1.25,
  overflowWrap: "anywhere",
}

const editButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  border: "1px solid #D1D5DB",
  borderRadius: 8,
  background: "#fff",
  color: "#111827",
  minHeight: 34,
  padding: "0 10px",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13,
  flexShrink: 0,
}

const metaGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))",
  gap: 8,
  minWidth: 0,
}

const metaItemStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  color: "#4B5563",
  fontSize: 13,
  lineHeight: 1.4,
  minWidth: 0,
  overflowWrap: "anywhere",
}

const actionsStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
}

const secondaryButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  minHeight: 38,
  border: "1px solid #F5C518",
  borderRadius: 8,
  background: "#F5C518",
  color: "#111827",
  cursor: "pointer",
  fontWeight: 750,
  padding: "0 12px",
}

function primaryButtonStyle(disabled: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 44,
    minWidth: 168,
    border: "none",
    borderRadius: 8,
    background: disabled ? "#D1D5DB" : "#F5C518",
    color: "#111827",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 800,
    fontSize: 15,
    padding: "0 16px",
  }
}
