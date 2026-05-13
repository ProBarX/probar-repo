"use client"

import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { CalendarDays, MessageSquare, Star, User } from "lucide-react"
import { api } from "@/services/api"

const PRIMARY_YELLOW = "#F5C518"

type Avaliacao = {
  id: number
  pedido_id: number
  nota: number
  comentario: string
  cliente_nome: string
  evento_nome: string
  criado_em: string
}

type PaginatedResponse<T> = { results?: T[] }

function getResults<T>(data: T[] | PaginatedResponse<T>): T[] {
  return Array.isArray(data) ? data : data.results ?? []
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso))
}

function StarRow({ nota, size = 16 }: { nota: number; size?: number }) {
  return (
    <div style={{ display: "flex", gap: "2px" }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          fill={i <= nota ? PRIMARY_YELLOW : "#E5E5E5"}
          color={i <= nota ? PRIMARY_YELLOW : "#E5E5E5"}
        />
      ))}
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: "120px",
        border: "1px solid #e8e8e8",
        borderRadius: "12px",
        padding: "20px 24px",
        backgroundColor: "#fff",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
      }}
    >
      <p style={{ margin: 0, fontSize: "13px", color: "#888" }}>{label}</p>
      <p style={{ margin: 0, fontSize: "28px", fontWeight: 700, color: "#1a1a1a", lineHeight: 1.1 }}>
        {value}
      </p>
      {sub && <p style={{ margin: 0, fontSize: "12px", color: "#aaa" }}>{sub}</p>}
    </div>
  )
}

function DistributionBar({ nota, count, total }: { nota: number; count: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((count / total) * 100)
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "4px", width: "28px", flexShrink: 0 }}>
        <span style={{ fontSize: "13px", color: "#555", fontWeight: 500 }}>{nota}</span>
        <Star size={11} fill={PRIMARY_YELLOW} color={PRIMARY_YELLOW} />
      </div>
      <div
        style={{
          flex: 1,
          height: "8px",
          borderRadius: "99px",
          backgroundColor: "#f0f0f0",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            backgroundColor: PRIMARY_YELLOW,
            borderRadius: "99px",
            transition: "width 0.4s ease",
          }}
        />
      </div>
      <span style={{ fontSize: "12px", color: "#aaa", width: "28px", textAlign: "right", flexShrink: 0 }}>
        {count}
      </span>
    </div>
  )
}

export default function BartenderFeedbackPage() {
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api
      .get<Avaliacao[] | PaginatedResponse<Avaliacao>>("/avaliacoes/")
      .then(({ data }) => {
        setAvaliacoes(getResults(data))
        setError(null)
      })
      .catch(() => setError("Não foi possível carregar os feedbacks."))
      .finally(() => setLoading(false))
  }, [])

  const media = useMemo(() => {
    if (avaliacoes.length === 0) return 0
    const soma = avaliacoes.reduce((acc, a) => acc + a.nota, 0)
    return soma / avaliacoes.length
  }, [avaliacoes])

  const distribuicao = useMemo(() => {
    const counts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    for (const a of avaliacoes) {
      counts[a.nota] = (counts[a.nota] ?? 0) + 1
    }
    return counts
  }, [avaliacoes])

  return (
    <div style={{ maxWidth: "720px" }}>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <p style={{ color: "#888", margin: 0, fontSize: "14px" }}>Avaliações</p>
        <h1 style={{ margin: "4px 0 0", color: "#1a1a1a", fontSize: "32px", lineHeight: 1.15 }}>
          Feedbacks
        </h1>
        <p style={{ margin: "6px 0 0", color: "#777", fontSize: "14px" }}>
          {avaliacoes.length === 0
            ? "Nenhuma avaliação recebida ainda"
            : `${avaliacoes.length} avaliação${avaliacoes.length > 1 ? "ões" : ""} recebida${avaliacoes.length > 1 ? "s" : ""}`}
        </p>
      </div>

      {/* Stats */}
      {!loading && !error && avaliacoes.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: "16px",
            marginBottom: "24px",
            flexWrap: "wrap",
          }}
        >
          <StatCard
            label="Média geral"
            value={
              <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {media.toFixed(1).replace(".", ",")}
                <Star size={22} fill={PRIMARY_YELLOW} color={PRIMARY_YELLOW} />
              </span>
            }
            sub={`${avaliacoes.length} avaliação${avaliacoes.length > 1 ? "ões" : ""}`}
          />

          <div
            style={{
              flex: 2,
              minWidth: "200px",
              border: "1px solid #e8e8e8",
              borderRadius: "12px",
              padding: "20px 24px",
              backgroundColor: "#fff",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <p style={{ margin: "0 0 4px", fontSize: "13px", color: "#888" }}>Distribuição</p>
            {[5, 4, 3, 2, 1].map((nota) => (
              <DistributionBar
                key={nota}
                nota={nota}
                count={distribuicao[nota] ?? 0}
                total={avaliacoes.length}
              />
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          style={{
            border: "1px solid #FECACA",
            background: "#FEF2F2",
            color: "#991B1B",
            borderRadius: "8px",
            padding: "12px 14px",
            marginBottom: "16px",
          }}
        >
          {error}
        </div>
      )}

      {/* List */}
      {loading ? (
        <EmptyState text="Carregando feedbacks..." />
      ) : avaliacoes.length === 0 ? (
        <EmptyState text="Você ainda não recebeu avaliações. Conclua eventos para receber feedback dos clientes." />
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {avaliacoes.map((av) => (
            <div
              key={av.id}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                padding: "16px 18px",
                borderRadius: "12px",
                backgroundColor: "#FFFFFF",
                border: "1px solid #eee",
                borderLeft: `4px solid ${av.nota >= 4 ? PRIMARY_YELLOW : av.nota === 3 ? "#B4B2A9" : "#E24B4A"}`,
                boxSizing: "border-box",
              }}
            >
              {/* Top row */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <StarRow nota={av.nota} size={15} />
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      color:
                        av.nota >= 4 ? "#7A5600" : av.nota === 3 ? "#5F5E5A" : "#A32D2D",
                      backgroundColor:
                        av.nota >= 4 ? "#FFF8DB" : av.nota === 3 ? "#F5F5F5" : "#F8EAEA",
                      border: `1px solid ${av.nota >= 4 ? "#F1D46A" : av.nota === 3 ? "#DDDDDD" : "#E2B6B6"}`,
                      borderRadius: "99px",
                      padding: "2px 10px",
                      alignSelf: "flex-start",
                    }}
                  >
                    {av.nota === 5
                      ? "Excelente"
                      : av.nota === 4
                        ? "Muito bom"
                        : av.nota === 3
                          ? "Regular"
                          : av.nota === 2
                            ? "Ruim"
                            : "Péssimo"}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "3px", alignItems: "flex-end" }}>
                  <MetaItem icon={<User size={12} />} text={av.cliente_nome || "Cliente"} />
                  <MetaItem icon={<CalendarDays size={12} />} text={formatDate(av.criado_em)} />
                </div>
              </div>

              {/* Evento */}
              {av.evento_nome && (
                <p style={{ margin: 0, fontSize: "12px", color: "#888", fontStyle: "italic" }}>
                  Pedido #{av.pedido_id} · {av.evento_nome}
                </p>
              )}

              {/* Comentário */}
              {av.comentario ? (
                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    padding: "12px 14px",
                    backgroundColor: "#fafafa",
                    borderRadius: "8px",
                    border: "1px solid #f0f0f0",
                  }}
                >
                  <MessageSquare size={15} color="#aaa" style={{ flexShrink: 0, marginTop: "1px" }} />
                  <p style={{ margin: 0, fontSize: "14px", color: "#444", lineHeight: 1.5 }}>
                    {av.comentario}
                  </p>
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: "13px", color: "#ccc", fontStyle: "italic" }}>
                  Sem comentário
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MetaItem({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        fontSize: "12px",
        color: "#888",
        fontWeight: 500,
      }}
    >
      {icon}
      {text}
    </span>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div
      style={{
        border: "1px solid #eee",
        background: "#FFFFFF",
        borderRadius: "12px",
        padding: "40px 32px",
        color: "#888",
        fontSize: "14px",
        fontWeight: 500,
        textAlign: "center",
        lineHeight: 1.6,
      }}
    >
      {text}
    </div>
  )
}
