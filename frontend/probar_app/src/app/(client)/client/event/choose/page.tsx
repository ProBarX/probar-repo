"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { fetchEventos, type EventoAPI } from "@/services/useEvent"

export default function ChooseEventPage() {
  const router = useRouter()

  const [eventos, setEventos] = useState<EventoAPI[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchEventos()
      .then((data) => {
        setEventos(data)
        if (data.length > 0) setSelectedId(data[0].id)
      })
      .catch(() => setError("Não foi possível carregar os eventos."))
      .finally(() => setLoading(false))
  }, [])

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

      {/* Estados de loading / erro */}
      {loading && (
        <p style={{ color: "#888", fontSize: "15px" }}>Carregando eventos...</p>
      )}
      {error && (
        <p style={{ color: "#e53e3e", fontSize: "15px" }}>{error}</p>
      )}

      {/* Lista de eventos */}
      {!loading && !error && eventos.length === 0 && (
        <p style={{ color: "#888", fontSize: "15px" }}>Nenhum evento encontrado.</p>
      )}

      {eventos.map((ev) => (
        <div
          key={ev.id}
          onClick={() => setSelectedId(ev.id)}
          style={{
            border: selectedId === ev.id ? "1.5px solid #F5C518" : "0.5px solid #ddd",
            borderRadius: "10px",
            padding: "20px 24px",
            marginBottom: "12px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* Radio customizado */}
            <div
              style={{
                width: "18px",
                height: "18px",
                borderRadius: "50%",
                border: selectedId === ev.id ? "2px solid #F5C518" : "2px solid #ddd",
                position: "relative",
                flexShrink: 0,
              }}
            >
              {selectedId === ev.id && (
                <div
                  style={{
                    position: "absolute",
                    width: "8px",
                    height: "8px",
                    background: "#F5C518",
                    borderRadius: "50%",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                  }}
                />
              )}
            </div>

            <div>
              <p style={{ fontWeight: 500, fontSize: "17px", margin: 0 }}>{ev.nome}</p>
              <p style={{ fontSize: "15px", color: "#888", margin: "2px 0 0" }}>
                {ev.rua} — CEP {ev.cep}
              </p>
            </div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation()
              router.push(`/client/event/${ev.id}/edit`)
            }}
            style={{
              fontSize: "15px",
              color: "#F5C518",
              fontWeight: 500,
              cursor: "pointer",
              background: "none",
              border: "none",
              padding: "4px 8px",
            }}
          >
            Editar
          </button>
        </div>
      ))}

      <button
        onClick={() => router.push("/client/event/new")}
        style={{
          color: "#F5C518",
          fontSize: "16px",
          fontWeight: 500,
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "4px 0",
          display: "block",
          marginBottom: "32px",
        }}
      >
        + Criar novo evento
      </button>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          disabled={selectedId === null}
          onClick={() => router.push(`/client/chat/${selectedId}`)}
          style={{
            padding: "14px 36px",
            background: selectedId === null ? "#ddd" : "#F5C518",
            border: "none",
            borderRadius: "10px",
            fontSize: "17px",
            fontWeight: 600,
            cursor: selectedId === null ? "not-allowed" : "pointer",
            color: "#1a1a1a",
          }}
        >
          Continuar
        </button>
      </div>
    </div>
  )
}