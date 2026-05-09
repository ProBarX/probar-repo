"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/services/api"

const tabs = [
  { label: "Todos", active: true },
  { label: "Pendentes", active: false },
  { label: "Aceitos", active: false },
  { label: "Cancelados", active: false },
  { label: "Pagos", active: false },
  { label: "Concluídos", active: false },
]

const orders = [
  {
    id: "Pedido #1",
    client: "Nome Cliente",
    date: "26/02/2026",
    schedule: "19 - 4hrs",
    address: "Ruas dos Alfaneiros, nº 4",
    amount: "R$ 2.400",
    status: "Pendente",
    action: "Aceitar",
  },
  {
    id: "Pedido #2",
    client: "Nome Cliente",
    date: "26/02/2026",
    schedule: "20 - 2hrs",
    address: "Ruas dos Alfaneiros, nº 4",
    amount: "R$ 1.800",
    status: "Pendente",
    action: "Aceitar",
  },
  {
    id: "Pedido #3",
    client: "Nome Cliente",
    date: "26/02/2026",
    schedule: "18 - 5hrs",
    address: "Ruas dos Alfaneiros, nº 4",
    amount: "R$ 3.000",
    status: "Aceito",
    action: "Detalhes",
  },
  {
    id: "Pedido #4",
    client: "Nome Cliente",
    date: "26/02/2026",
    schedule: "18 - 3hrs",
    address: "Ruas dos Alfaneiros, nº 4",
    amount: "R$ 1.800",
    status: "Concluído",
    action: "Feedback",
  },
]

type StripeStatus = {
  tem_conta_stripe: boolean
  onboarding_completo: boolean
}

type ApiErrorResponse = {
  status?: number
  data?: {
    erro?: string
    detail?: string
  }
}

function getApiErrorResponse(error: unknown): ApiErrorResponse | undefined {
  if (!error || typeof error !== "object" || !("response" in error)) {
    return undefined
  }

  return (error as { response?: ApiErrorResponse }).response
}

function isAuthError(error: unknown) {
  return getApiErrorResponse(error)?.status === 401
}

function getStripeErrorMessage(error: unknown) {
  const response = getApiErrorResponse(error)

  if (response?.status === 401) {
    return "Sua sessao expirou. Entre novamente para conectar a Stripe."
  }

  return response?.data?.erro || response?.data?.detail || "Nao foi possivel verificar sua conta Stripe."
}

function statusStyle(status: string) {
  const base = {
    padding: "6px 12px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
  } as const

  if (status === "Pendente") return { ...base, backgroundColor: "#E5E7EB", color: "#374151" }
  if (status === "Aceito") return { ...base, backgroundColor: "#FDE68A", color: "#78350F" }
  if (status === "Concluído") return { ...base, backgroundColor: "#ECFDF5", color: "#166534" }
  if (status === "Cancelado") return { ...base, backgroundColor: "#FEF2F2", color: "#B91C1C" }
  return base
}

export default function BartenderHomePage() {
  const router = useRouter()
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null)
  const [showStripePopup, setShowStripePopup] = useState(false)
  const [stripeLoading, setStripeLoading] = useState(false)
  const [stripeError, setStripeError] = useState<string | null>(null)
  const [stripeAuthError, setStripeAuthError] = useState(false)

  useEffect(() => {
    let active = true

    api.get<StripeStatus>("/stripe/status/")
      .then(({ data }) => {
        if (!active) return
        setStripeStatus(data)
        setStripeError(null)
        setStripeAuthError(false)
        setShowStripePopup(!data.tem_conta_stripe || !data.onboarding_completo)
      })
      .catch((error: unknown) => {
        if (!active) return
        setStripeAuthError(isAuthError(error))
        setStripeError(getStripeErrorMessage(error))
        setShowStripePopup(true)
      })

    return () => {
      active = false
    }
  }, [])

  async function handleStripeOnboarding() {
    setStripeLoading(true)
    setStripeError(null)
    setStripeAuthError(false)

    try {
      const { data } = await api.post<{ url?: string }>("/stripe/onboarding/")
      if (data.url) {
        window.location.href = data.url
        return
      }

      setStripeError("Nao foi possivel abrir o cadastro da Stripe.")
    } catch (error: unknown) {
      setStripeAuthError(isAuthError(error))
      setStripeError(getStripeErrorMessage(error) || "Nao foi possivel criar sua conta Stripe agora.")
    } finally {
      setStripeLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      {showStripePopup && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(17, 24, 39, 0.45)",
            zIndex: 100,
            display: "grid",
            placeItems: "center",
            padding: "24px",
          }}
        >
          <div
            style={{
              width: "min(100%, 460px)",
              background: "#FFFFFF",
              borderRadius: "8px",
              border: "1px solid #E5E7EB",
              boxShadow: "0 24px 60px rgba(15, 23, 42, 0.22)",
              padding: "24px",
              display: "grid",
              gap: "14px",
            }}
          >
            <div>
              <div>
                <p style={{ margin: "0 0 4px", color: "#6B7280", fontSize: "13px" }}>Pagamentos</p>
                <h2 style={{ margin: 0, color: "#111827", fontSize: "24px", fontWeight: 750 }}>
                  {stripeStatus?.tem_conta_stripe ? "Concluir conta Stripe" : "Criar conta Stripe"}
                </h2>
              </div>
            </div>

            <p style={{ margin: 0, color: "#4B5563", fontSize: "14px", lineHeight: 1.55 }}>
              {stripeStatus?.tem_conta_stripe
                ? "Sua conta Stripe ja existe, mas o cadastro precisa ser concluido para receber pagamentos dos clientes."
                : "Para receber pagamentos dos clientes, voce precisa ter uma conta Stripe conectada ao ProBar. O cadastro e seguro e leva poucos minutos."}
            </p>

            {stripeError && (
              <div
                style={{
                  border: "1px solid #FECACA",
                  background: "#FEF2F2",
                  color: "#991B1B",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  fontSize: "13px",
                }}
              >
                {stripeError}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "4px" }}>
              <button
                type="button"
                onClick={stripeAuthError ? () => router.push("/login") : handleStripeOnboarding}
                disabled={stripeLoading}
                style={{
                  border: "none",
                  background: stripeLoading ? "#D1D5DB" : "#F5C518",
                  borderRadius: "8px",
                  color: "#111827",
                  padding: "10px 14px",
                  fontWeight: 750,
                  cursor: stripeLoading ? "wait" : "pointer",
                }}
              >
                {stripeAuthError ? "Entrar novamente" : stripeLoading ? "Abrindo..." : "Ir para Stripe"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "24px", marginBottom: "28px" }}>
        <div>
          <p style={{ margin: 0, color: "#374151", fontSize: "14px" }}>Pedidos</p>
          <h1 style={{ margin: "8px 0 0", fontSize: "32px", fontWeight: 700 }}>Você tem 2 pedidos pendentes</h1>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "14px", width: "360px" }}>
          <div style={{ flex: 1 }}>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                placeholder="Buscar pedidos"
                style={{
                  width: "100%",
                  borderRadius: "16px",
                  border: "1px solid #D1D5DB",
                  padding: "16px 20px",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
              <span style={{ position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", fontSize: "14px" }}>
                🔍
              </span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "20px" }}>
        {tabs.map((tab) => (
          <button
            key={tab.label}
            style={{
              padding: "10px 18px",
              borderRadius: "999px",
              border: tab.active ? "1px solid #FBBF24" : "1px solid #D1D5DB",
              backgroundColor: tab.active ? "#FDE68A" : "#FFFFFF",
              color: "#111827",
              fontWeight: tab.active ? 700 : 500,
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gap: "18px" }}>
        {orders.map((order) => (
          <div
            key={order.id}
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "16px",
              padding: "22px",
              borderRadius: "24px",
              backgroundColor: "#FFFFFF",
              border: order.status === "Aceito" ? "1px solid #FDE68A" : "1px solid #E5E7EB",
              boxShadow: "0px 4px 16px rgba(15, 23, 42, 0.04)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "18px", minWidth: "280px", flex: 1, minHeight: "80px" }}>
              <div style={{ width: "72px", height: "72px", borderRadius: "50%", backgroundColor: "#F3F4F6", flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                  <strong style={{ fontSize: "16px" }}>{order.id}</strong>
                  <span style={statusStyle(order.status)}>{order.status}</span>
                </div>
                <p style={{ margin: 0, fontSize: "14px", color: "#4B5563" }}>{order.client}</p>
              </div>
            </div>

            <div style={{ display: "flex", flex: 1, flexWrap: "wrap", gap: "12px", minWidth: "260px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "12px", color: "#6B7280" }}>Data</span>
                <span style={{ fontWeight: 600 }}>{order.date}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "12px", color: "#6B7280" }}>Horário</span>
                <span style={{ fontWeight: 600 }}>{order.schedule}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "180px" }}>
                <span style={{ fontSize: "12px", color: "#6B7280" }}>Local</span>
                <span style={{ fontWeight: 600 }}>{order.address}</span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "16px", minWidth: "190px", justifyContent: "flex-end" }}>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>Valor</p>
                <p style={{ margin: "6px 0 0", fontSize: "18px", fontWeight: 700 }}>{order.amount}</p>
              </div>
              <button
                style={{
                  border: "none",
                  borderRadius: "999px",
                  padding: "12px 22px",
                  backgroundColor: order.action === "Aceitar" ? "#FBBF24" : "#FFFFFF",
                  color: order.action === "Aceitar" ? "#111827" : "#111827",
                  boxShadow: order.action !== "Aceitar" ? "0 0 0 1px rgba(209, 213, 219, 0.9)" : "none",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                {order.action}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
