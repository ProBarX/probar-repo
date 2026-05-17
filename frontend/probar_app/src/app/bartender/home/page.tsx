"use client"

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react"
import {
  CalendarDays,
  CircleAlert,
  CircleCheck,
  Clock3,
  Hourglass,
  MapPin,
  MessageCircle,
  Search,
  XCircle,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { api } from "@/services/api"

type PedidoStatus =
  | "EM_NEGOCIACAO"
  | "ACEITO"
  | "RECUSADO"
  | "CANCELADO"
  | "PAGO"
  | "CONCLUIDO"

type PropostaStatus = "PENDENTE" | "ACEITA" | "RECUSADA" | "CANCELADA" | "SUBSTITUIDA"
type PagamentoStatus = "PENDENTE" | "PAGO" | "CANCELADO" | string
type PagamentoDisplayStatus = "AGUARDANDO_PAGAMENTO" | "PENDENTE" | "PAGO" | "CANCELADO"
type TabKey = "TODOS" | "PENDENTES" | "ACEITOS" | "PAGOS" | "CONCLUIDOS" | "CANCELADOS"

type BadgeConfig = {
  label: string
  bg: string
  color: string
  border: string
  stripe: string
}

type PropostaApi = {
  id: number
  pedido: number
  remetente: number | null
  tipo: string
  horas: number
  valor_adicional: string
  desconto: string
  status: PropostaStatus | string
  criado_em: string
  valor_total: number | string
}

type PedidoApi = {
  id: number
  numero_bartender?: number | null
  cliente: number
  cliente_nome: string
  bartender: number
  bartender_nome: string
  bartender_especialidade: string
  evento: number
  evento_nome: string
  evento_data: string | null
  evento_hora_inicio: string | null
  evento_hora_fim: string | null
  evento_cep: string
  evento_rua: string
  evento_numero: string
  evento_complemento: string
  evento_quantidade_convidados: number | null
  status: PedidoStatus | string
  criado_em: string
  propostas: PropostaApi[]
  proposta_aprovada: number | null
  valor_hora_aprovado: string | null
  horas_aprovadas: number | null
  valor_total_aprovado: string | null
  pagamento_id: number | null
  pagamento_status: PagamentoStatus | null
  pagamento_valor: string | null
  pagamento_finalizado_pelo_cliente: boolean
}

type PaginatedResponse<T> = {
  results?: T[]
}

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

const PRIMARY_YELLOW = "#F5C518"

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "TODOS", label: "Todos" },
  { key: "PENDENTES", label: "Pendentes" },
  { key: "ACEITOS", label: "Aceitos" },
  { key: "CANCELADOS", label: "Cancelados" },
  { key: "PAGOS", label: "Liberados" },
  { key: "CONCLUIDOS", label: "Concluidos" },
]

const statusConfigs: Record<PedidoStatus, BadgeConfig> = {
  EM_NEGOCIACAO: { label: "Pendente", bg: "#F5F5F5", color: "#5F5E5A", border: "1px solid #DDDDDD", stripe: "#B4B2A9" },
  ACEITO: { label: "Proposta aceita", bg: "#EEF7E8", color: "#3B6D11", border: "1px solid #B8D99E", stripe: "#97C459" },
  RECUSADO: { label: "Recusado", bg: "#F8EAEA", color: "#A32D2D", border: "1px solid #E2B6B6", stripe: "#E24B4A" },
  CANCELADO: { label: "Cancelado", bg: "#F8EAEA", color: "#A32D2D", border: "1px solid #E2B6B6", stripe: "#E24B4A" },
  PAGO: { label: "Pagamento liberado", bg: "#FFF8DB", color: "#7A5600", border: "1px solid #F1D46A", stripe: PRIMARY_YELLOW },
  CONCLUIDO: { label: "Pedido concluido", bg: "#EAF3DE", color: "#3B6D11", border: "1px solid #97C459", stripe: "#97C459" },
}

const paymentStatusConfigs: Record<PagamentoDisplayStatus, BadgeConfig> = {
  AGUARDANDO_PAGAMENTO: { label: "Aguardando pagamento", bg: "#FFF8DB", color: "#7A5600", border: "1px solid #F1D46A", stripe: PRIMARY_YELLOW },
  PENDENTE: { label: "Pagamento pendente", bg: "#F5F5F5", color: "#5F5E5A", border: "1px solid #DDDDDD", stripe: "#B4B2A9" },
  PAGO: { label: "Pagamento liberado", bg: "#FFF8DB", color: "#7A5600", border: "1px solid #F1D46A", stripe: PRIMARY_YELLOW },
  CANCELADO: { label: "Pagamento cancelado", bg: "#F8EAEA", color: "#A32D2D", border: "1px solid #E2B6B6", stripe: "#E24B4A" },
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

function getErrorMessage(error: unknown, fallback: string) {
  const response = getApiErrorResponse(error)

  if (response?.status === 401) {
    return "Sua sessao expirou. Entre novamente para continuar."
  }

  return response?.data?.erro || response?.data?.detail || fallback
}

function getResults<T>(data: T[] | PaginatedResponse<T>): T[] {
  return Array.isArray(data) ? data : data.results ?? []
}

async function getCurrentUserId(): Promise<number> {
  try {
    const res = await fetch("/api/auth/get-token", { cache: "no-store" })
    const { token } = await res.json()
    if (!token) return 0

    const payload = JSON.parse(atob(token.split(".")[1])) as { user_id?: number; id?: number }
    return payload.user_id ?? payload.id ?? 0
  } catch {
    return 0
  }
}

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null
  const numberValue = typeof value === "number" ? value : Number(value.replace(",", "."))
  return Number.isFinite(numberValue) ? numberValue : null
}

function formatCurrency(value: number | string | null | undefined) {
  const numberValue = toNumber(value)
  if (numberValue === null) return "A combinar"

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(numberValue)
}

function formatDate(date: string | null) {
  if (!date) return "Data nao informada"
  const parsed = new Date(`${date}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return date

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed)
}

function formatTime(time: string | null) {
  return time ? time.slice(0, 5) : ""
}

function getLatestProposta(pedido: PedidoApi) {
  if (pedido.propostas.length === 0) return null

  return pedido.propostas.reduce((latest, current) => {
    const latestDate = Date.parse(latest.criado_em)
    const currentDate = Date.parse(current.criado_em)
    return currentDate > latestDate ? current : latest
  })
}

function getIncomingPendingProposta(pedido: PedidoApi, currentUserId: number) {
  if (!currentUserId) return null

  return (
    pedido.propostas.find(
      (proposta) => proposta.status === "PENDENTE" && proposta.remetente !== currentUserId
    ) ?? null
  )
}

function getPedidoStatus(pedido: PedidoApi) {
  return pedido.status
}

function getDisplayPedidoStatus(pedido: PedidoApi) {
  return pedido.status
}

function getPedidoPaymentStatus(pedido: PedidoApi) {
  if (pedido.pagamento_status) return pedido.pagamento_status
  if (pedido.status === "PAGO") return "PAGO"
  if (pedido.status === "ACEITO") return "AGUARDANDO_PAGAMENTO"
  return null
}

function getStatusConfig(status: string) {
  return statusConfigs[status as PedidoStatus] ?? {
    label: status,
    bg: "#F3F3F3",
    color: "#111111",
    border: "1px solid #D8D8D8",
    stripe: "#7A7A7A",
  }
}

function getPaymentStatusConfig(status: PagamentoStatus | PagamentoDisplayStatus | null) {
  const normalized = (status ?? "PENDENTE").toUpperCase()

  if (normalized === "PAGO") return paymentStatusConfigs.PAGO
  if (normalized === "CANCELADO") return paymentStatusConfigs.CANCELADO
  if (normalized === "AGUARDANDO_PAGAMENTO") return paymentStatusConfigs.AGUARDANDO_PAGAMENTO
  return paymentStatusConfigs.PENDENTE
}

function badgeStyle(cfg: BadgeConfig): CSSProperties {
  return {
    minWidth: "auto",
    height: "24px",
    padding: "0 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    backgroundColor: cfg.bg,
    color: cfg.color,
    border: cfg.border,
    lineHeight: 1,
  }
}

function statusStyle(status: string): CSSProperties {
  return badgeStyle(getStatusConfig(status))
}

function paymentStatusStyle(status: PagamentoStatus | null): CSSProperties {
  return badgeStyle(getPaymentStatusConfig(status))
}

function matchesTab(pedido: PedidoApi, tab: TabKey) {
  const status = getPedidoStatus(pedido)
  const paymentStatus = pedido.pagamento_status?.toUpperCase()

  if (tab === "TODOS") return true
  if (tab === "PENDENTES") return status === "EM_NEGOCIACAO"
  if (tab === "ACEITOS") return status === "ACEITO"
  if (tab === "PAGOS") return status === "PAGO" || paymentStatus === "PAGO"
  if (tab === "CONCLUIDOS") return status === "CONCLUIDO"
  return status === "CANCELADO" || status === "RECUSADO"
}

function getPedidoValue(pedido: PedidoApi) {
  const latestProposta = getLatestProposta(pedido)
  return pedido.valor_total_aprovado ?? pedido.pagamento_valor ?? latestProposta?.valor_total ?? null
}

function getPedidoHours(pedido: PedidoApi) {
  return pedido.horas_aprovadas ?? getLatestProposta(pedido)?.horas ?? null
}

function getSchedule(pedido: PedidoApi) {
  const start = formatTime(pedido.evento_hora_inicio)
  const end = formatTime(pedido.evento_hora_fim)
  const hours = getPedidoHours(pedido)

  if (start && hours) return `${start} - ${hours}hrs`
  if (start && end) return `${start} - ${end}`
  if (hours) return `${hours}hrs`
  return "Horario nao informado"
}

function getAddress(pedido: PedidoApi) {
  const street = [pedido.evento_rua, pedido.evento_numero].filter(Boolean).join(", ")
  const parts = [street, pedido.evento_complemento, pedido.evento_cep].filter(Boolean)
  return parts.length > 0 ? parts.join(" - ") : "Local nao informado"
}

function getClientName(pedido: PedidoApi) {
  return pedido.cliente_nome?.trim() || "Cliente"
}

function getPedidoDisplayNumber(pedido: PedidoApi) {
  return pedido.numero_bartender ?? "-"
}

function getSearchText(pedido: PedidoApi) {
  const status = getStatusConfig(getDisplayPedidoStatus(pedido)).label
  const paymentStatus = getPedidoPaymentStatus(pedido)
  const paymentStatusLabel = paymentStatus ? getPaymentStatusConfig(paymentStatus).label : ""
  return [
    `pedido ${getPedidoDisplayNumber(pedido)}`,
    getClientName(pedido),
    pedido.evento_nome,
    getAddress(pedido),
    status,
    paymentStatusLabel,
  ].join(" ").toLowerCase()
}

function getPrimaryActionLabel(pedido: PedidoApi, currentUserId: number) {
  const status = getPedidoStatus(pedido)
  const incomingProposta = getIncomingPendingProposta(pedido, currentUserId)

  if (status === "EM_NEGOCIACAO" && incomingProposta) return "Aceitar"
  if (status === "CONCLUIDO") return "Feedback"
  return "Detalhes"
}

function getStatusIcon(status: string) {
  if (status === "EM_NEGOCIACAO") return <CircleAlert size={14} />
  if (status === "ACEITO" || status === "PAGO" || status === "CONCLUIDO") return <CircleCheck size={14} />
  return <XCircle size={14} />
}

function getPaymentStatusIcon(status: PagamentoStatus | null) {
  const normalized = (status ?? "PENDENTE").toUpperCase()
  if (normalized === "PAGO") return <CircleCheck size={14} />
  if (normalized === "CANCELADO") return <XCircle size={14} />
  return <Hourglass size={14} />
}

export default function BartenderHomePage() {
  const router = useRouter()
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null)
  const [showStripePopup, setShowStripePopup] = useState(false)
  const [stripeLoading, setStripeLoading] = useState(false)
  const [stripeError, setStripeError] = useState<string | null>(null)
  const [stripeAuthError, setStripeAuthError] = useState(false)
  const [pedidos, setPedidos] = useState<PedidoApi[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [ordersError, setOrdersError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>("TODOS")
  const [searchTerm, setSearchTerm] = useState("")
  const [currentUserId, setCurrentUserId] = useState(0)
  const [actionPedidoId, setActionPedidoId] = useState<number | null>(null)

  const carregarPedidos = useCallback(async () => {
    setOrdersLoading(true)
    setOrdersError(null)

    try {
      const { data } = await api.get<PedidoApi[] | PaginatedResponse<PedidoApi>>("/pedidos/")
      setPedidos(getResults(data))
    } catch (error: unknown) {
      setOrdersError(getErrorMessage(error, "Nao foi possivel carregar seus pedidos."))
    } finally {
      setOrdersLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true

    getCurrentUserId().then((userId) => {
      if (active) setCurrentUserId(userId)
    })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    carregarPedidos()
  }, [carregarPedidos])

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
        setStripeError(getErrorMessage(error, "Nao foi possivel verificar sua conta Stripe."))
        setShowStripePopup(true)
      })

    return () => {
      active = false
    }
  }, [])

  const filteredPedidos = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return pedidos.filter((pedido) => {
      const matchesFilter = matchesTab(pedido, activeTab)
      const matchesSearch = !normalizedSearch || getSearchText(pedido).includes(normalizedSearch)
      return matchesFilter && matchesSearch
    })
  }, [activeTab, pedidos, searchTerm])

  const pendingCount = useMemo(
    () => pedidos.filter((pedido) => getPedidoStatus(pedido) === "EM_NEGOCIACAO").length,
    [pedidos]
  )

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
      setStripeError(getErrorMessage(error, "Nao foi possivel criar sua conta Stripe agora."))
    } finally {
      setStripeLoading(false)
    }
  }

  function openPedidoChat(pedidoId: number) {
    router.push(`/bartender/chat?pedido=${pedidoId}`)
  }

  async function handlePrimaryAction(pedido: PedidoApi) {
    const incomingProposta = getIncomingPendingProposta(pedido, currentUserId)

    if (!incomingProposta) {
      openPedidoChat(pedido.id)
      return
    }

    setActionPedidoId(pedido.id)
    setOrdersError(null)

    try {
      await api.post(`/propostas/${incomingProposta.id}/accept/`, {})
      await carregarPedidos()
    } catch (error: unknown) {
      setOrdersError(getErrorMessage(error, "Nao foi possivel aceitar a proposta."))
    } finally {
      setActionPedidoId(null)
    }
  }

  return (
    <div style={{ display: "grid", gap: "24px" }}>
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
              <p style={{ margin: "0 0 4px", color: "#6B7280", fontSize: "13px" }}>Pagamentos</p>
              <h2 style={{ margin: 0, color: "#111827", fontSize: "24px", fontWeight: 750 }}>
                {stripeStatus?.tem_conta_stripe ? "Concluir conta Stripe" : "Criar conta Stripe"}
              </h2>
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
                  background: stripeLoading ? "#D1D5DB" : PRIMARY_YELLOW,
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

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "24px", marginBottom: "24px" }}>
          <div>
            <p style={{ color: "#888", margin: 0, fontSize: "14px" }}>Pedidos</p>
            <h1 style={{ margin: "4px 0 0", color: "#1a1a1a", fontSize: "32px", lineHeight: 1.15 }}>
              Seus pedidos
            </h1>
            <p style={{ margin: "6px 0 0", color: "#777", fontSize: "14px" }}>
              {pendingCount === 1 ? "Voce tem 1 pedido pendente" : `Voce tem ${pendingCount} pedidos pendentes`}
            </p>
          </div>

          <label style={{ position: "relative", width: "280px", flexShrink: 0 }}>
            <Search
              size={16}
              aria-hidden="true"
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#aaa",
                pointerEvents: "none",
              }}
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar pedidos"
              style={{
                width: "100%",
                padding: "10px 16px 10px 38px",
                borderRadius: "8px",
                border: "1px solid #ddd",
                fontSize: "14px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </label>
        </div>

        <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
          {tabs.map((tab) => {
            const active = activeTab === tab.key

            return (
              <button
                type="button"
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: "8px 20px",
                  borderRadius: "20px",
                  border: "1px solid #ddd",
                  backgroundColor: active ? PRIMARY_YELLOW : "#fff",
                  color: "#1a1a1a",
                  fontSize: "14px",
                  fontWeight: active ? 600 : 400,
                  cursor: "pointer",
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        {ordersError && (
          <div
            style={{
              border: "1px solid #FECACA",
              background: "#FEF2F2",
              color: "#991B1B",
              borderRadius: "8px",
              padding: "12px 14px",
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
            }}
          >
            <span>{ordersError}</span>
            <button
              type="button"
              onClick={carregarPedidos}
              style={{
                border: "1px solid #FCA5A5",
                background: "#FFFFFF",
                borderRadius: "8px",
                padding: "8px 12px",
                color: "#991B1B",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Tentar novamente
            </button>
          </div>
        )}

        {ordersLoading ? (
          <EmptyState text="Carregando pedidos..." />
        ) : filteredPedidos.length === 0 ? (
          <EmptyState text="Nenhum pedido encontrado." />
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {filteredPedidos.map((pedido) => {
              const status = getDisplayPedidoStatus(pedido)
              const statusCfg = getStatusConfig(status)
              const paymentStatus = getPedidoPaymentStatus(pedido)
              const paymentCfg = getPaymentStatusConfig(paymentStatus)
              const showPaymentStatus = Boolean(paymentStatus)
              const clientName = getClientName(pedido)
              const primaryLabel = getPrimaryActionLabel(pedido, currentUserId)
              const accepting = actionPedidoId === pedido.id
              const isPrimaryAction = primaryLabel === "Aceitar"

              return (
                <div
                  key={pedido.id}
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    padding: "14px 16px",
                    borderRadius: "12px",
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #eee",
                    borderLeft: `4px solid ${statusCfg.stripe}`,
                    boxSizing: "border-box",
                  }}
                >
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "50%",
                      background: "#f1f1f1",
                      border: "1px solid #e5e5e5",
                      flexShrink: 0,
                    }}
                  />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
                      <strong style={{ color: "#1a1a1a", fontSize: "15px", fontWeight: 600, lineHeight: 1.2 }}>
                        Pedido #{getPedidoDisplayNumber(pedido)}
                      </strong>
                      <span style={statusStyle(status)}>
                        {getStatusIcon(status)}
                        {statusCfg.label}
                      </span>
                      {showPaymentStatus && (
                        <span style={paymentStatusStyle(paymentStatus)}>
                          {getPaymentStatusIcon(paymentStatus)}
                          {paymentCfg.label}
                        </span>
                      )}
                    </div>

                    <p style={{ margin: "0 0 6px", color: "#555", fontSize: "14px", fontWeight: 500 }}>
                      {clientName}
                    </p>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        flexWrap: "wrap",
                        color: "#888",
                        fontSize: "12px",
                        fontWeight: 500,
                      }}
                    >
                      <OrderMeta icon={<CalendarDays size={14} />} value={formatDate(pedido.evento_data)} />
                      <OrderMeta icon={<Clock3 size={14} />} value={getSchedule(pedido)} />
                      <OrderMeta icon={<MapPin size={14} />} value={getAddress(pedido)} />
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: "10px",
                      justifyContent: "flex-end",
                      minWidth: 0,
                    }}
                  >
                    <strong style={{ color: "#1a1a1a", fontSize: "16px", fontWeight: 600, whiteSpace: "nowrap" }}>
                      {formatCurrency(getPedidoValue(pedido))}
                    </strong>

                    <button
                      type="button"
                      title="Abrir chat"
                      onClick={() => openPedidoChat(pedido.id)}
                      style={{
                        width: "32px",
                        height: "32px",
                        position: "relative",
                        borderRadius: "50%",
                        border: "1px solid #e5e5e5",
                        background: "#FFFFFF",
                        color: "#1a1a1a",
                        display: "grid",
                        placeItems: "center",
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                    >
                      <MessageCircle size={16} />
                      {status === "EM_NEGOCIACAO" && (
                        <span
                          aria-hidden="true"
                          style={{
                            position: "absolute",
                            top: "3px",
                            right: "-1px",
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            background: PRIMARY_YELLOW,
                          }}
                        />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePrimaryAction(pedido)}
                      disabled={accepting}
                      style={{
                        padding: "8px 14px",
                        border: isPrimaryAction ? `1px solid ${PRIMARY_YELLOW}` : "1px solid #ddd",
                        borderRadius: "8px",
                        backgroundColor: isPrimaryAction ? PRIMARY_YELLOW : "#FFFFFF",
                        color: "#1a1a1a",
                        cursor: accepting ? "wait" : "pointer",
                        fontSize: "14px",
                        fontWeight: 600,
                      }}
                    >
                      {accepting ? "..." : primaryLabel}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div
      style={{
        border: "1px solid #eee",
        background: "#FFFFFF",
        borderRadius: "12px",
        padding: "32px",
        color: "#888",
        fontSize: "14px",
        fontWeight: 500,
        textAlign: "center",
      }}
    >
      {text}
    </div>
  )
}

function OrderMeta({ icon, value }: { icon: ReactNode; value: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", minWidth: 0 }}>
      <span style={{ display: "inline-flex", color: "#888", flexShrink: 0 }}>{icon}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
    </span>
  )
}
