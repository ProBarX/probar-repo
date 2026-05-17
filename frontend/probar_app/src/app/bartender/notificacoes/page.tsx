"use client"

import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import {
  Bell,
  CheckCircle2,
  CircleCheck,
  MessageCircle,
  XCircle,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { api } from "@/services/api"

const PRIMARY_YELLOW = "#F5C518"

type PedidoStatus = "EM_NEGOCIACAO" | "ACEITO" | "RECUSADO" | "CANCELADO" | "PAGO" | "CONCLUIDO"

type PropostaApi = {
  id: number
  pedido: number
  remetente: number | null
  status: string
  criado_em: string
}

type PedidoApi = {
  id: number
  numero_bartender?: number | null
  cliente_nome: string
  evento_nome: string
  status: PedidoStatus | string
  criado_em: string
  propostas: PropostaApi[]
}

type NotifTipo =
  | "pedido_novo"
  | "proposta_cliente"
  | "aceito"
  | "pago"
  | "concluido"
  | "cancelado"
  | "recusado"

type Notification = {
  id: string
  tipo: NotifTipo
  titulo: string
  descricao: string
  tempo: string
  pedidoId: number
  lida: boolean
  criadoEm: Date
}

type NotifConfig = {
  icon: ReactNode
  iconBg: string
  iconColor: string
  stripe: string
}

const notifConfigs: Record<NotifTipo, NotifConfig> = {
  pedido_novo: {
    icon: <Bell size={18} />,
    iconBg: "#EFF6FF",
    iconColor: "#2563EB",
    stripe: "#3B82F6",
  },
  proposta_cliente: {
    icon: <MessageCircle size={18} />,
    iconBg: "#FFF8DB",
    iconColor: "#8a6d00",
    stripe: PRIMARY_YELLOW,
  },
  aceito: {
    icon: <CircleCheck size={18} />,
    iconBg: "#EEF7E8",
    iconColor: "#3B6D11",
    stripe: "#97C459",
  },
  pago: {
    icon: <CheckCircle2 size={18} />,
    iconBg: "#FFF8DB",
    iconColor: "#7A5600",
    stripe: PRIMARY_YELLOW,
  },
  concluido: {
    icon: <CircleCheck size={18} />,
    iconBg: "#FFF8DB",
    iconColor: "#7A5600",
    stripe: PRIMARY_YELLOW,
  },
  cancelado: {
    icon: <XCircle size={18} />,
    iconBg: "#F8EAEA",
    iconColor: "#A32D2D",
    stripe: "#E24B4A",
  },
  recusado: {
    icon: <XCircle size={18} />,
    iconBg: "#F8EAEA",
    iconColor: "#A32D2D",
    stripe: "#E24B4A",
  },
}

function getPedidoDisplayNumber(pedido: PedidoApi) {
  return pedido.numero_bartender ?? "-"
}

function buildNotifications(pedidos: PedidoApi[], currentUserId: number): Notification[] {
  const notifs: Notification[] = []

  for (const pedido of pedidos) {
    const status = pedido.status as PedidoStatus
    const clientName = pedido.cliente_nome?.trim() || "Cliente"
    const eventoNome = pedido.evento_nome || "evento"
    const pedidoNumero = getPedidoDisplayNumber(pedido)

    const incomingProposta = pedido.propostas.find(
      (p) => p.status === "PENDENTE" && p.remetente !== currentUserId
    )

    if (status === "EM_NEGOCIACAO") {
      if (incomingProposta) {
        notifs.push({
          id: `proposta-${incomingProposta.id}`,
          tipo: "proposta_cliente",
          titulo: "Nova proposta recebida",
          descricao: `${clientName} enviou uma contraproposta para o pedido #${pedidoNumero}.`,
          tempo: incomingProposta.criado_em,
          pedidoId: pedido.id,
          lida: false,
          criadoEm: new Date(incomingProposta.criado_em),
        })
      } else {
        notifs.push({
          id: `pedido-${pedido.id}`,
          tipo: "pedido_novo",
          titulo: "Novo pedido recebido",
          descricao: `${clientName} solicitou você para o evento "${eventoNome}".`,
          tempo: pedido.criado_em,
          pedidoId: pedido.id,
          lida: false,
          criadoEm: new Date(pedido.criado_em),
        })
      }
    } else if (status === "ACEITO") {
      notifs.push({
        id: `aceito-${pedido.id}`,
        tipo: "aceito",
        titulo: "Proposta aceita",
        descricao: `O pedido #${pedidoNumero} de ${clientName} aguarda pagamento.`,
        tempo: pedido.criado_em,
        pedidoId: pedido.id,
        lida: true,
        criadoEm: new Date(pedido.criado_em),
      })
    } else if (status === "PAGO") {
      notifs.push({
        id: `pago-${pedido.id}`,
        tipo: "pago",
        titulo: "Pagamento liberado",
        descricao: `O pagamento do pedido #${pedidoNumero} de ${clientName} foi capturado e liberado.`,
        tempo: pedido.criado_em,
        pedidoId: pedido.id,
        lida: true,
        criadoEm: new Date(pedido.criado_em),
      })
    } else if (status === "CONCLUIDO") {
      notifs.push({
        id: `concluido-${pedido.id}`,
        tipo: "concluido",
        titulo: "Evento concluído",
        descricao: `O evento "${eventoNome}" com ${clientName} foi concluído com sucesso.`,
        tempo: pedido.criado_em,
        pedidoId: pedido.id,
        lida: true,
        criadoEm: new Date(pedido.criado_em),
      })
    } else if (status === "CANCELADO") {
      notifs.push({
        id: `cancelado-${pedido.id}`,
        tipo: "cancelado",
        titulo: "Pedido cancelado",
        descricao: `O pedido #${pedidoNumero} de ${clientName} foi cancelado.`,
        tempo: pedido.criado_em,
        pedidoId: pedido.id,
        lida: true,
        criadoEm: new Date(pedido.criado_em),
      })
    } else if (status === "RECUSADO") {
      notifs.push({
        id: `recusado-${pedido.id}`,
        tipo: "recusado",
        titulo: "Pedido recusado",
        descricao: `O pedido #${pedidoNumero} de ${clientName} foi recusado.`,
        tempo: pedido.criado_em,
        pedidoId: pedido.id,
        lida: true,
        criadoEm: new Date(pedido.criado_em),
      })
    }
  }

  return notifs.sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime())
}

function formatTimeAgo(isoDate: string): string {
  const date = new Date(isoDate)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "Agora mesmo"
  if (diffMins < 60) return `Há ${diffMins} min`
  if (diffHours < 24) return `Há ${diffHours}h`
  if (diffDays === 1) return "Ontem"
  if (diffDays < 7) return `Há ${diffDays} dias`

  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date)
}

type PaginatedResponse<T> = { results?: T[] }

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

export default function BartenderNotificacoesPage() {
  const router = useRouter()
  const [pedidos, setPedidos] = useState<PedidoApi[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState(0)
  const [readIds, setReadIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    getCurrentUserId().then(setCurrentUserId)
  }, [])

  useEffect(() => {
    api
      .get<PedidoApi[] | PaginatedResponse<PedidoApi>>("/pedidos/")
      .then(({ data }) => {
        setPedidos(getResults(data))
        setError(null)
      })
      .catch(() => setError("Não foi possível carregar as notificações."))
      .finally(() => setLoading(false))
  }, [])

  const notifications = useMemo(
    () => buildNotifications(pedidos, currentUserId),
    [pedidos, currentUserId]
  )

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.lida && !readIds.has(n.id)).length,
    [notifications, readIds]
  )

  function markAllRead() {
    setReadIds(new Set(notifications.map((n) => n.id)))
  }

  function handleClick(notif: Notification) {
    setReadIds((prev) => new Set([...prev, notif.id]))
    router.push(`/bartender/chat?pedido=${notif.pedidoId}`)
  }

  return (
    <div style={{ maxWidth: "720px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: "16px",
          marginBottom: "28px",
        }}
      >
        <div>
          <p style={{ color: "#888", margin: 0, fontSize: "14px" }}>Central</p>
          <h1 style={{ margin: "4px 0 0", color: "#1a1a1a", fontSize: "32px", lineHeight: 1.15 }}>
            Notificações
          </h1>
          <p style={{ margin: "6px 0 0", color: "#777", fontSize: "14px" }}>
            {unreadCount === 0
              ? "Nenhuma notificação não lida"
              : `${unreadCount} notificaç${unreadCount === 1 ? "ão não lida" : "ões não lidas"}`}
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            style={{
              border: "1px solid #ddd",
              background: "#fff",
              borderRadius: "8px",
              padding: "8px 14px",
              fontSize: "13px",
              fontWeight: 600,
              color: "#555",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Marcar todas como lidas
          </button>
        )}
      </div>

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

      {loading ? (
        <EmptyState text="Carregando notificações..." />
      ) : notifications.length === 0 ? (
        <EmptyState text="Você não tem notificações." />
      ) : (
        <div style={{ display: "grid", gap: "10px" }}>
          {notifications.map((notif) => {
            const cfg = notifConfigs[notif.tipo]
            const isRead = notif.lida || readIds.has(notif.id)

            return (
              <button
                key={notif.id}
                type="button"
                onClick={() => handleClick(notif)}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "14px",
                  padding: "14px 16px",
                  borderRadius: "12px",
                  backgroundColor: isRead ? "#FFFFFF" : "#FAFBFF",
                  border: `1px solid ${isRead ? "#eee" : "#dde6f7"}`,
                  borderLeft: `4px solid ${cfg.stripe}`,
                  boxSizing: "border-box",
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                  font: "inherit",
                }}
              >
                <div
                  style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "50%",
                    background: cfg.iconBg,
                    color: cfg.iconColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {cfg.icon}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "8px",
                      marginBottom: "3px",
                    }}
                  >
                    <strong
                      style={{
                        fontSize: "14px",
                        fontWeight: isRead ? 500 : 700,
                        color: "#1a1a1a",
                      }}
                    >
                      {notif.titulo}
                    </strong>
                    <span
                      style={{
                        fontSize: "12px",
                        color: "#aaa",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      {formatTimeAgo(notif.tempo)}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: "13px", color: "#666", lineHeight: 1.45 }}>
                    {notif.descricao}
                  </p>
                </div>

                {!isRead && (
                  <div
                    aria-hidden="true"
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: PRIMARY_YELLOW,
                      flexShrink: 0,
                      marginTop: "6px",
                    }}
                  />
                )}
              </button>
            )
          })}
        </div>
      )}
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
