"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type Event = {
  id: number
  name: string
  city: string
  cep: string
}

const mockEvents: Event[] = [
  { id: 1, name: "Conexão Digital",  city: "São Paulo",    cep: "01000000" },
  { id: 2, name: "Agro Experience",  city: "Rio de Janeiro", cep: "06410001" },
]

export default function ChooseEventPage() {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<number>(mockEvents[0].id)

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
        <button
          onClick={() => router.back()}
          style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", color: "#888" }}
        >
          ‹ <span style={{ flex: 1, textAlign: "center", fontSize: "20px", fontWeight: 500 }}>Voltar</span>
        </button>
        
      </div>

      <h2 style={{ fontSize: "26px", fontWeight: 600, marginBottom: "8px" }}>Escolha o evento</h2>
      <p style={{ fontSize: "14px", color: "#888", marginBottom: "24px" }}>
        Selecione um evento existente ou crie um novo para enviar ao bartender
      </p>

      {mockEvents.map((ev) => (
        <div
          key={ev.id}
          onClick={() => setSelectedId(ev.id)}
          style={{
            border: selectedId === ev.id ? "1.5px solid #F5C518" : "0.5px solid #ddd",
            borderRadius: "10px",
            padding: "16px 20px",
            marginBottom: "12px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
              <p style={{ fontWeight: 500, fontSize: "15px", margin: 0 }}>{ev.name}</p>
              <p style={{ fontSize: "13px", color: "#888", margin: "2px 0 0" }}>
                {ev.city} - CEP {ev.cep}
              </p>
            </div>
          </div>
          <span
            onClick={(e) => { e.stopPropagation(); router.push(`/client/event/${ev.id}/edit`) }}
            style={{ fontSize: "13px", color: "#F5C518", fontWeight: 500, cursor: "pointer" }}
          >
            Editar
          </span>
        </div>
      ))}

      <button
        onClick={() => router.push("/client/event/new")}
        style={{ color: "#F5C518", fontSize: "14px", fontWeight: 500, background: "none", border: "none", cursor: "pointer", padding: "4px 0", display: "block", marginBottom: "24px" }}
      >
        + Criar novo evento
      </button>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          style={{
            padding: "12px 32px",
            background: "#F5C518",
            border: "none",
            borderRadius: "10px",
            fontSize: "15px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Continuar
        </button>
      </div>
    </div>
  )
}