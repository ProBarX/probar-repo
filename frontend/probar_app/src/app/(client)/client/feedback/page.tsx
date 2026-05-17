"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Star, ChevronRight, CheckCircle } from "lucide-react"
import { api } from "@/services/api"

const PRIMARY_YELLOW = "#F5C518"

type Pedido = {
  id: number
  bartender_nome: string
  evento_nome: string
  evento_data: string
  status: string
  tem_avaliacao: boolean
}

export default function FeedbackIndexPage() {
  const router = useRouter()
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.get<Pedido[] | { results: Pedido[] }>("/pedidos/")
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : data.results
        const concluidos = list.filter((p) => p.status === "CONCLUIDO")
        setPedidos(concluidos)
      })
      .catch(() => setError("Erro ao carregar serviços. Tente novamente."))
      .finally(() => setLoading(false))
  }, [])

  const pendentes = pedidos.filter((p) => !p.tem_avaliacao)
  const avaliados = pedidos.filter((p) => p.tem_avaliacao)

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "0 16px 40px" }}>
      <h2 style={{ fontSize: "22px", fontWeight: "700", margin: "0 0 24px" }}>Feedback</h2>

      {loading && (
        <p style={{ color: "#aaa", fontSize: "14px" }}>Carregando serviços...</p>
      )}

      {error && (
        <p style={{ color: "#e53e3e", fontSize: "14px" }}>{error}</p>
      )}

      {!loading && !error && pendentes.length === 0 && avaliados.length === 0 && (
        <div style={{
          border: "1px solid #e8e8e8",
          borderRadius: "12px",
          padding: "32px 24px",
          backgroundColor: "#fff",
          textAlign: "center",
          color: "#aaa",
          fontSize: "14px",
        }}>
          Nenhum serviço concluído encontrado.
        </div>
      )}

      {/* Serviços pendentes de avaliação */}
      {pendentes.length > 0 && (
        <div style={{ marginBottom: "28px" }}>
          <h4 style={{ fontSize: "14px", fontWeight: "600", color: "#888", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Aguardando avaliação
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {pendentes.map((pedido) => (
              <button
                key={pedido.id}
                type="button"
                onClick={() => router.push(`/client/feedback/${pedido.id}?bartender=${encodeURIComponent(pedido.bartender_nome)}`)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  border: `1px solid ${PRIMARY_YELLOW}`,
                  borderRadius: "12px",
                  padding: "16px 20px",
                  backgroundColor: "#fff",
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <span style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    backgroundColor: "#fdf6dc",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <Star size={18} fill={PRIMARY_YELLOW} color={PRIMARY_YELLOW} />
                  </span>
                  <div>
                    <p style={{ margin: 0, fontWeight: "600", fontSize: "14px", color: "#1a1a1a" }}>
                      {pedido.bartender_nome}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#888" }}>
                      {pedido.evento_nome} · {pedido.evento_data}
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{
                    fontSize: "11px",
                    fontWeight: "600",
                    color: "#8a6d00",
                    backgroundColor: "#fdf6dc",
                    border: "1px solid #f5e090",
                    borderRadius: "20px",
                    padding: "3px 10px",
                  }}>
                    Avaliar
                  </span>
                  <ChevronRight size={16} color="#ccc" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Serviços já avaliados */}
      {avaliados.length > 0 && (
        <div>
          <h4 style={{ fontSize: "14px", fontWeight: "600", color: "#888", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Já avaliados
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {avaliados.map((pedido) => (
              <div
                key={pedido.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  border: "1px solid #e8e8e8",
                  borderRadius: "12px",
                  padding: "16px 20px",
                  backgroundColor: "#fafafa",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <span style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    backgroundColor: "#e8f5e9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <CheckCircle size={18} color="#2e7d32" />
                  </span>
                  <div>
                    <p style={{ margin: 0, fontWeight: "600", fontSize: "14px", color: "#555" }}>
                      {pedido.bartender_nome}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#aaa" }}>
                      {pedido.evento_nome} · {pedido.evento_data}
                    </p>
                  </div>
                </div>
                <span style={{ fontSize: "12px", color: "#2e7d32", fontWeight: "600" }}>
                  Avaliado
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
