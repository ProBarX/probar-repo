"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { fetchEventos, type EventoAPI } from "@/services/useEvent"
import { api } from "@/services/api"

export default function ChooseEventPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const bartenderEmail = searchParams.get("bartender") ?? ""
  const horas = Number(searchParams.get("horas") ?? "1")
  const eventoParam = searchParams.get("evento") ?? ""

  const [bartenderId, setBartenderId] = useState<number | null>(null)
  const [eventos, setEventos] = useState<EventoAPI[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      try {
        const [eventosData, bartendersRaw] = await Promise.all([
          fetchEventos(),
          api.get("/bartenders/"),
        ])

        setEventos(eventosData)
        if (eventosData.length > 0) {
          const eventoId = Number(eventoParam)
          const selected = eventosData.find((ev) => ev.id === eventoId)
          setSelectedId(selected?.id ?? eventosData[0].id)
        }

        if (bartenderEmail) {
          const bartenders = Array.isArray(bartendersRaw.data)
            ? bartendersRaw.data
            : bartendersRaw.data.results ?? []

          // user_id agora é exposto pelo BartenderSerializer
          const found = bartenders.find((b: any) => b.email === bartenderEmail)
          if (found?.user_id) {
            setBartenderId(found.user_id)
          } else {
            setError("Bartender não encontrado. Volte e tente novamente.")
          }
        }
      } catch {
        setError("Não foi possível carregar os dados.")
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [bartenderEmail, eventoParam])

  async function handleContinuar() {
    if (!selectedId || !bartenderId) return
    setSubmitting(true)
    setError(null)

    try {
      await api.post("/pedidos/", {
        bartender: bartenderId,
        evento: selectedId,
        horas,
      })

      router.push("/client/chat")
    } catch (err: any) {
      const detail = err?.response?.data
        ? JSON.stringify(err.response.data, null, 2)
        : "Verifique os dados e tente novamente."
      setError(`Erro ao criar pedido:\n${detail}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
        <button
          onClick={() => router.back()}
          style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", color: "#888", lineHeight: 1 }}
        >
          ‹ <span style={{ fontSize: "18px", fontWeight: 500 }}>Voltar</span>
        </button>
      </div>

      <h2 style={{ fontSize: "32px", fontWeight: 600, marginBottom: "8px" }}>Escolha o evento</h2>
      <p style={{ fontSize: "16px", color: "#888", marginBottom: "24px" }}>
        Selecione um evento existente ou crie um novo para enviar ao bartender
      </p>

      {bartenderEmail && (
        <div style={{
          background: "#fffbea", border: "1px solid #EF9F27",
          borderRadius: "10px", padding: "10px 16px",
          fontSize: "14px", color: "#7a5000", marginBottom: "20px",
          display: "flex", gap: "8px", alignItems: "center",
        }}>
          <span>🍸</span>
          <span><strong>{bartenderEmail}</strong> · {horas}h de serviço</span>
        </div>
      )}

      {!bartenderEmail && (
        <div style={{
          background: "#fff5f5", border: "1px solid #E24B4A",
          borderRadius: "10px", padding: "10px 16px",
          fontSize: "14px", color: "#A32D2D", marginBottom: "20px",
        }}>
          ⚠️ Bartender não identificado. Volte e selecione um bartender.
        </div>
      )}

      {loading && <p style={{ color: "#888", fontSize: "15px" }}>Carregando...</p>}

      {error && (
        <pre style={{
          color: "#e53e3e", fontSize: "13px", marginBottom: "16px",
          background: "#fff5f5", padding: "12px", borderRadius: "8px",
          whiteSpace: "pre-wrap", wordBreak: "break-word",
        }}>
          {error}
        </pre>
      )}

      {!loading && !error && eventos.length === 0 && (
        <p style={{ color: "#888", fontSize: "15px" }}>Nenhum evento encontrado.</p>
      )}

      {eventos.map((ev) => (
        <div
          key={ev.id}
          onClick={() => setSelectedId(ev.id)}
          style={{
            border: selectedId === ev.id ? "1.5px solid #F5C518" : "0.5px solid #ddd",
            borderRadius: "10px", padding: "20px 24px", marginBottom: "12px",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "18px", height: "18px", borderRadius: "50%",
              border: selectedId === ev.id ? "2px solid #F5C518" : "2px solid #ddd",
              position: "relative", flexShrink: 0,
            }}>
              {selectedId === ev.id && (
                <div style={{
                  position: "absolute", width: "8px", height: "8px",
                  background: "#F5C518", borderRadius: "50%",
                  top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                }} />
              )}
            </div>
            <div>
              <p style={{ fontWeight: 500, fontSize: "17px", margin: 0 }}>{ev.nome}</p>
              <p style={{ fontSize: "15px", color: "#888", margin: "2px 0 0" }}>
                {ev.data} — {ev.rua}{ev.numero ? `, ${ev.numero}` : ""}
              </p>
            </div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation()
              const params = new URLSearchParams(searchParams.toString())
              params.set("evento", String(ev.id))
              router.push(`/client/event/${ev.id}/edit?${params.toString()}`)
            }}
            style={{
              fontSize: "15px", color: "#F5C518", fontWeight: 500,
              cursor: "pointer", background: "none", border: "none", padding: "4px 8px",
            }}
          >
            Editar
          </button>
        </div>
      ))}

      <button
        onClick={() => {
          const params = bartenderEmail
            ? `?bartender=${encodeURIComponent(bartenderEmail)}&horas=${horas}`
            : ""
          router.push(`/client/event/new${params}`)
        }}
        style={{
          color: "#F5C518", fontSize: "16px", fontWeight: 500,
          background: "none", border: "none", cursor: "pointer",
          padding: "4px 0", display: "block", marginBottom: "32px",
        }}
      >
        + Criar novo evento
      </button>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          disabled={selectedId === null || !bartenderId || submitting}
          onClick={handleContinuar}
          style={{
            padding: "14px 36px",
            background: selectedId === null || !bartenderId || submitting ? "#ddd" : "#F5C518",
            border: "none", borderRadius: "10px", fontSize: "17px", fontWeight: 600,
            cursor: selectedId === null || !bartenderId || submitting ? "not-allowed" : "pointer",
            color: "#1a1a1a",
          }}
        >
          {submitting ? "Criando pedido..." : "Continuar"}
        </button>
      </div>
    </div>
  )
}
