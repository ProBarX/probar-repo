"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { MessageCircle, Send } from "lucide-react"
import { PropostaCard, type Proposta } from "@/components/client/chat/PropostaCard"
import { CounterPropostaForm } from "@/components/client/chat/CounterPropostaForm"
import { ChatAvatar } from "@/components/client/chat/ChatAvatar"
import { ChatEventoCard, type EventoChatDetails } from "@/components/client/chat/ChatEventoCard"
import { ChatNextStepBanner } from "@/components/client/chat/ChatNextStepBanner"
import { ChatStatusBadge } from "@/components/client/chat/ChatStatusBadge"
import { chatCardContainerStyle } from "@/components/client/chat/chatStyles"
import { useIsCompactChat } from "@/components/client/chat/useIsCompactChat"
import { useChat, type Chat, type Mensagem } from "@/services/useChat"
import { api } from "@/services/api"
import { getPedidoDisplayNumber, resolvePedidoVisualStatus } from "@/lib/chat-status"

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ChatEnriquecido = Chat & {
  cliente_nome: string
  evento_nome: string
}

type PedidoResumo = {
  id: number
  cliente_nome?: string
  evento_nome?: string
}

type PropostaPayload = {
  proposta_id?: number
  pedido_id?: number
  remetente?: number
  tipo?: string
  horas?: number
  valor_adicional?: string | number
  desconto?: string | number
  valor_total?: string | number
  status?: string
}

type EventoPayload = {
  nome?: string
  data?: string
  hora_inicio?: string
  hora_fim?: string
  cep?: string
  rua?: string
  numero?: string
  complemento?: string
  quantidade_convidados?: number
  descricao_evento?: string
}

const avatarColors = ["#3C3489", "#0F6E56", "#993C1D", "#185FA5", "#854F0B"]
const CHAT_HEADER_HEIGHT = 69

function getResults<T>(data: T[] | { results?: T[] }): T[] {
  return Array.isArray(data) ? data : data.results ?? []
}

function parsePedidoParam(value: string | null) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function getPropostaPayload(payload: Mensagem["payload"]): PropostaPayload | null {
  return payload ? (payload as PropostaPayload) : null
}

function getEventoPayload(payload: Mensagem["payload"]): EventoPayload | null {
  return payload ? (payload as EventoPayload) : null
}

function getEventoDetails(payload: EventoPayload | null, chat?: Chat): EventoChatDetails {
  return {
    nome: payload?.nome ?? chat?.evento_nome,
    data: payload?.data ?? chat?.evento_data,
    hora_inicio: payload?.hora_inicio ?? chat?.evento_hora_inicio,
    hora_fim: payload?.hora_fim ?? chat?.evento_hora_fim,
    cep: payload?.cep ?? chat?.evento_cep,
    rua: payload?.rua ?? chat?.evento_rua,
    numero: payload?.numero ?? chat?.evento_numero,
    complemento: payload?.complemento ?? chat?.evento_complemento,
    quantidade_convidados: payload?.quantidade_convidados ?? chat?.evento_quantidade_convidados,
    descricao_evento: payload?.descricao_evento ?? chat?.evento_descricao,
  }
}

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."))
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

function toPropostaStatus(status: unknown): Proposta["status"] {
  if (
    status === "PENDENTE" ||
    status === "ACEITA" ||
    status === "RECUSADA" ||
    status === "CANCELADA" ||
    status === "SUBSTITUIDA"
  ) {
    return status
  }

  return "PENDENTE"
}

function getPendingProposalAction(mensagens: Mensagem[], currentUserId: number): "self" | "other" | null {
  if (!currentUserId) return null
  const pendingMessage = [...mensagens].reverse().find((m) => {
    const payload = getPropostaPayload(m.payload)
    return m.tipo === "card_proposta" && payload?.status === "PENDENTE"
  })
  const payload = pendingMessage ? getPropostaPayload(pendingMessage.payload) : null
  if (!payload?.remetente) return null
  return Number(payload.remetente) === Number(currentUserId) ? "other" : "self"
}

async function getCurrentUserId(): Promise<number> {
  try {
    const res = await fetch("/api/auth/get-token")
    const { token } = await res.json()
    if (!token) return 0
    const payload = JSON.parse(atob(token.split(".")[1]))
    return payload.user_id ?? payload.id ?? 0
  } catch {
    return 0
  }
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function BartenderChatPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isCompact = useIsCompactChat()
  const pedidoParam = searchParams.get("pedido")
  const pedidoIdParam = parsePedidoParam(pedidoParam)
  const {
    getChats,
    getChat,
    getMensagens,
    enviarMensagem,
    aceitarProposta,
    recusarProposta,
    cancelarProposta,
    enviarContraproposta,
    loading: apiLoading,
  } = useChat()

  const [currentUserId, setCurrentUserId] = useState(0)
  const [chats, setChats] = useState<ChatEnriquecido[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [texto, setTexto] = useState("")
  const [counterParaId, setCounterParaId] = useState<number | null>(null)
  const [loadingChats, setLoadingChats] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getCurrentUserId().then(setCurrentUserId)
  }, [])

  // Carrega chats e enriquece com cliente_nome e evento_nome do PedidoSerializer
  const carregarChats = useCallback(async () => {
    try {
      const data = await getChats()
      let chatsData = data

      if (pedidoIdParam && !data.some((chat) => chat.pedido === pedidoIdParam)) {
        const chatDoPedido = await getChats(pedidoIdParam)
        const idsDoPedido = new Set(chatDoPedido.map((chat) => chat.id))
        chatsData = [
          ...chatDoPedido,
          ...data.filter((chat) => !idsDoPedido.has(chat.id)),
        ]
      }

      const { data: pedidosRaw } = await api.get<PedidoResumo[] | { results?: PedidoResumo[] }>("/pedidos/")
      const pedidos = getResults(pedidosRaw)

      const enriquecidos: ChatEnriquecido[] = chatsData.map((c) => {
        const pedido = pedidos.find((p) => p.id === c.pedido)
        const clienteNome = c.cliente_nome?.trim() || pedido?.cliente_nome?.trim() || "Cliente"
        return {
          ...c,
          cliente_nome: clienteNome,
          evento_nome: c.evento_nome ?? pedido?.evento_nome ?? "",
        }
      })

      setChats(enriquecidos)
      setSelectedIdx((current) => {
        if (pedidoIdParam) {
          const index = enriquecidos.findIndex((chat) => chat.pedido === pedidoIdParam)
          if (index >= 0) return index
        }
        return current < enriquecidos.length ? current : 0
      })
      if (pedidoIdParam && enriquecidos.some((chat) => chat.pedido === pedidoIdParam)) {
        setCounterParaId(null)
      }
    } catch {
      setError("Não foi possível carregar as conversas.")
    } finally {
      setLoadingChats(false)
    }
  }, [getChats, pedidoIdParam])

  useEffect(() => {
    carregarChats()
  }, [carregarChats])

  // Scroll automático
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chats, selectedIdx])

  const selectedChatId = chats[selectedIdx]?.id

  // Polling de mensagens
  useEffect(() => {
    if (!selectedChatId) return

    const poll = async () => {
      try {
        const chatAtualizado = await getChat(selectedChatId)
        setChats((prev) =>
          prev.map((c) =>
            c.id === selectedChatId
              ? {
                  ...c,
                  ...chatAtualizado,
                  cliente_nome: chatAtualizado.cliente_nome?.trim() || c.cliente_nome,
                  evento_nome: chatAtualizado.evento_nome ?? c.evento_nome,
                }
              : c
          )
        )
      } catch {}
    }

    poll()
    pollingRef.current = setInterval(poll, 3000)
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [getChat, selectedChatId])

  // ── Ações de proposta ──────────────────────────────────────────────────────

  const updatePropostaLocal = (propostaId: number, novoStatus: string) => {
    setChats((prev) =>
      prev.map((c, i) => {
        if (i !== selectedIdx) return c
        return {
          ...c,
          mensagens: c.mensagens.map((m) => {
            const payload = getPropostaPayload(m.payload)
            if (
              m.tipo === "card_proposta" &&
              payload &&
              payload.proposta_id === propostaId
            ) {
              return { ...m, payload: { ...payload, status: novoStatus } as Record<string, unknown> }
            }
            return m
          }),
        }
      })
    )
  }

  const handleAceitar = async (id: number) => {
    try {
      await aceitarProposta(id)
      updatePropostaLocal(id, "ACEITA")
      // Bartender não paga — apenas aguarda o cliente efetuar o pagamento
    } catch {}
  }

  const handleRecusar = async (id: number) => {
    try {
      await recusarProposta(id)
      updatePropostaLocal(id, "RECUSADA")
    } catch {}
  }

  const handleCancelar = async (id: number) => {
    try {
      await cancelarProposta(id)
      updatePropostaLocal(id, "CANCELADA")
    } catch {}
  }

  const handleEnviarCounter = async (
    propostaId: number,
    dados: { horas: number; desconto?: number; valor_adicional?: number }
  ) => {
    try {
      await enviarContraproposta(propostaId, dados)
      updatePropostaLocal(propostaId, "SUBSTITUIDA")
      setCounterParaId(null)
      const mensagens = await getMensagens(chats[selectedIdx].id)
      setChats((prev) =>
        prev.map((c, i) => (i === selectedIdx ? { ...c, mensagens } : c))
      )
    } catch {}
  }

  const handleEnviarTexto = async () => {
    if (!texto.trim()) return
    const chatId = chats[selectedIdx]?.id
    if (!chatId) return

    const conteudo = texto.trim()
    setTexto("")

    const temp: Mensagem = {
      id: Date.now(),
      chat: chatId,
      remetente: currentUserId,
      tipo: "texto",
      conteudo,
      payload: null,
      criado_em: new Date().toISOString(),
    }

    setChats((prev) =>
      prev.map((c, i) =>
        i === selectedIdx ? { ...c, mensagens: [...c.mensagens, temp] } : c
      )
    )

    try {
      await enviarMensagem(chatId, conteudo)
    } catch {
      setChats((prev) =>
        prev.map((c, i) =>
          i === selectedIdx
            ? { ...c, mensagens: c.mensagens.filter((m) => m.id !== temp.id) }
            : c
        )
      )
      setTexto(conteudo)
    }
  }

  // ── Extrai proposta do payload ─────────────────────────────────────────────

  const extractProposta = (msg: Mensagem): Proposta | null => {
    if (msg.tipo !== "card_proposta" || !msg.payload) return null
    const p = getPropostaPayload(msg.payload)
    if (!p?.proposta_id || !p.pedido_id) return null

    return {
      id: p.proposta_id,
      pedido: p.pedido_id,
      remetente: p.remetente ?? 0,
      tipo: p.tipo ?? "inicial",
      horas: p.horas ?? 0,
      valor_adicional: String(p.valor_adicional ?? "0.00"),
      desconto: String(p.desconto ?? "0.00"),
      status: toPropostaStatus(p.status),
      criado_em: msg.criado_em,
      valor_total: toNumber(p.valor_total),
    }
  }

  const formatarHora = (data: string) => {
    return new Date(data).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  // ── Render de cada mensagem ────────────────────────────────────────────────

  const renderMensagem = (msg: Mensagem) => {
    // const isOwn = msg.remetente !== null && msg.remetente === currentUserId
    const isOwn = Number(msg.remetente) === Number(currentUserId)
    if (msg.tipo === "texto") {
      return (
        <div
          key={msg.id}
          style={{
            maxWidth: isCompact ? "86%" : "75%",
            minWidth: 0,
            padding: "10px 12px 6px",
            borderRadius: "14px",
            fontSize: "15px",
            lineHeight: 1.5,
            alignSelf: isOwn ? "flex-end" : "flex-start",
            background: isOwn ? "#F5C518" : "#fff",
            color: "#1a1a1a",
            border: isOwn ? "none" : "1px solid #eee",
            borderBottomRightRadius: isOwn ? 4 : 14,
            borderBottomLeftRadius: isOwn ? 14 : 4,
            boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            overflowWrap: "anywhere",
          }}
        >
          <span>{msg.conteudo}</span>

          <span
            style={{
              alignSelf: "flex-end",
              fontSize: "10px",
              color: "rgba(0,0,0,0.6)",
              marginTop: "2px",
            }}
          >
            {formatarHora(msg.criado_em)}
          </span>
        </div>
      )
    }

    if (msg.tipo === "card_proposta") {
      const proposta = extractProposta(msg)
      if (!proposta) return null
      const align = Number(proposta.remetente) === Number(currentUserId) ? "right" : "left"
      return (
        <div
          key={msg.id}
          style={chatCardContainerStyle(align)}
        >
          <PropostaCard
            proposta={proposta}
            currentUserId={currentUserId}
            onAceitar={handleAceitar}
            onRecusar={handleRecusar}
            onCancelar={handleCancelar}
            onCounter={(id) =>
              setCounterParaId(counterParaId === id ? null : id)
            }
          />
          {counterParaId === proposta.id && (
            <CounterPropostaForm
              propostaId={proposta.id}
              horasAtual={proposta.horas}
              valorAtual={proposta.valor_total}
              onEnviar={handleEnviarCounter}
              onCancelar={() => setCounterParaId(null)}
            />
          )}
        </div>
      )
    }

    if (msg.tipo === "card_evento") {
      const p = getEventoPayload(msg.payload)
      return (
        <ChatEventoCard
          key={msg.id}
          evento={getEventoDetails(p, chats[selectedIdx])}
          align="left"
        />
      )
    }

    if (msg.tipo === "status_update") {
      return (
        <div
          key={msg.id}
          style={{
            alignSelf: isOwn ? "flex-end" : "flex-start",
            background: "#fff",
            border: "0.5px solid #eee",
            borderRadius: "10px",
            padding: "8px 11px",
            fontSize: "12px",
            color: "#777",
            fontWeight: 400,
            width: "min(100%, 392px)",
            maxWidth: "100%",
            boxSizing: "border-box",
            boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          }}
        >
          {msg.conteudo}
        </div>
      )
    }

    return null
  }

  // ── Estados de loading/erro ────────────────────────────────────────────────

  if (loadingChats) {
    return (
      <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "#888" }}>
        Carregando conversas...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "#e53e3e", flexDirection: "column", gap: "12px" }}>
        <span>{error}</span>
        <button onClick={carregarChats} style={{ padding: "10px 20px", background: "#F5C518", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }}>
          Tentar novamente
        </button>
      </div>
    )
  }

  if (chats.length === 0) {
    return (
      <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "#888", flexDirection: "column", gap: "16px" }}>
        <MessageCircle size={40} color="#aaa" strokeWidth={1.8} />
        <p style={{ margin: 0, fontWeight: 600, fontSize: "16px" }}>Nenhuma negociação ainda</p>
        <p style={{ margin: 0, fontSize: "14px", color: "#aaa" }}>Quando um cliente te contratar, a conversa aparece aqui.</p>
        <button onClick={() => router.back()} style={{ padding: "10px 20px", background: "#F5C518", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }}>Voltar</button>
      </div>
    )
  }

  const conversa = chats[selectedIdx]

  return (
    <div style={{ display: "flex", flexDirection: isCompact ? "column" : "row", height: "100%", width: "100%", overflow: "hidden", fontFamily: "sans-serif" }}>

      {/* Sidebar */}
      <div style={{ width: isCompact ? "100%" : 280, minWidth: isCompact ? 0 : 280, maxHeight: isCompact ? 220 : undefined, borderRight: isCompact ? "none" : "1px solid #eee", borderBottom: isCompact ? "1px solid #eee" : "none", display: "flex", flexDirection: "column", background: "#fff", flexShrink: 0 }}>
        <div style={{ height: CHAT_HEADER_HEIGHT, boxSizing: "border-box", flexShrink: 0, padding: "16px 16px 14px", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontWeight: 600, fontSize: "15px" }}>Negociações</span>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {chats.map((c, i) => {
            const ultima = c.mensagens.at(-1)
            const preview =
              ultima?.tipo === "card_proposta" ? "Proposta enviada"
              : ultima?.tipo === "status_update" ? ultima.conteudo
              : ultima?.conteudo ?? ""

            return (
              <div key={c.id} onClick={() => { setSelectedIdx(i); setCounterParaId(null) }}
                style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", cursor: "pointer", borderBottom: "1px solid #f5f5f5", background: i === selectedIdx ? "#fafafa" : "#fff", transition: "background 0.15s" }}
              >
                <ChatAvatar
                  name={c.cliente_nome}
                  src={c.cliente_foto_perfil}
                  color={avatarColors[i % avatarColors.length]}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: "15px", margin: "0 0 2px" }}>{c.cliente_nome}</p>
                  <p style={{ fontSize: "13px", color: "#999", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Área do chat */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, background: "#fff" }}>

        {/* Header */}
        <div style={{ height: "auto", minHeight: CHAT_HEADER_HEIGHT, boxSizing: "border-box", flexShrink: 0, position: "relative", zIndex: 2, padding: isCompact ? "12px 14px" : "14px 24px", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0, flex: "1 1 260px" }}>
            <ChatAvatar
              name={conversa.cliente_nome}
              src={conversa.cliente_foto_perfil}
              color={avatarColors[selectedIdx % avatarColors.length]}
              size={40}
            />
            <div style={{ minWidth: 0 }}>
              <p style={{ fontWeight: 600, margin: 0, fontSize: "17px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{conversa.cliente_nome}</p>
              <p style={{ fontSize: "12px", color: "#999", margin: 0, overflowWrap: "anywhere" }}>
                Pedido #{getPedidoDisplayNumber(conversa.pedido_resumo, conversa.pedido)}
              </p>
              {conversa.evento_nome && (
                <p style={{ fontSize: "12px", color: "#999", margin: 0, overflowWrap: "anywhere" }}>{conversa.evento_nome}</p>
              )}
            </div>
          </div>
          <ChatStatusBadge status={resolvePedidoVisualStatus(conversa.pedido_resumo)} />
        </div>

        <ChatNextStepBanner
          pedido={conversa.pedido_resumo}
          role="bartender"
          pedidoId={conversa.pedido}
          pendingProposalAction={getPendingProposalAction(conversa.mensagens, currentUserId)}
        />

        {/* Mensagens */}
        <div style={{ flex: 1, overflowY: "auto", padding: isCompact ? "14px 12px" : "20px 24px", display: "flex", flexDirection: "column", gap: "14px", background: "#f9f9f9" }}>
          {conversa.mensagens.map((msg) => renderMensagem(msg))}
          {apiLoading && <div style={{ alignSelf: "center", color: "#aaa", fontSize: "13px" }}>Processando...</div>}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={{ padding: isCompact ? "10px 12px" : "14px 24px", borderTop: "1px solid #eee", display: "flex", alignItems: "center", gap: "10px", background: "#fff" }}>
          <input
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleEnviarTexto()}
            placeholder="Digite uma mensagem..."
            style={{ flex: 1, padding: "10px 16px", border: "1px solid #e5e5e5", borderRadius: "24px", fontSize: "15px", outline: "none", background: "#f5f5f5", color: "#1a1a1a" }}
          />
          <button onClick={handleEnviarTexto} disabled={!texto.trim()}
            style={{ width: 40, height: 40, borderRadius: "50%", background: texto.trim() ? "#F5C518" : "#e5e5e5", border: "none", cursor: texto.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.15s" }}
          >
            <Send size={16} color="#1a1a1a" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Badge de status ────────────────────────────────────────────────────────────

/*
function LegacyPedidoStatusBadge({ mensagens }: { mensagens: Mensagem[] }) {
  const ultimaPropostaMsg = [...mensagens].reverse().find((m) => m.tipo === "card_proposta")
  const payload = ultimaPropostaMsg ? getPropostaPayload(ultimaPropostaMsg.payload) : null
  const status = payload?.status ?? null
  if (!status) return null

  const configs: Record<string, { label: string; bg: string; color: string; border: string }> = {
    PENDENTE:    { label: "Aguardando resposta",    bg: "#fff",     color: "#BA7517", border: "1px solid #EF9F27" },
    ACEITA:      { label: "Proposta aceita ✓",      bg: "#EAF3DE",  color: "#3B6D11", border: "1px solid #97C459" },
    RECUSADA:    { label: "Proposta recusada",       bg: "#FCEBEB",  color: "#A32D2D", border: "1px solid #E24B4A" },
    CANCELADA:   { label: "Cancelada",               bg: "#F1EFE8",  color: "#5F5E5A", border: "1px solid #B4B2A9" },
    SUBSTITUIDA: { label: "Contraproposta enviada",  bg: "#E6F1FB",  color: "#185FA5", border: "1px solid #85B7EB" },
  }

  const cfg = configs[status] ?? configs.PENDENTE
  return (
    <span style={{ fontSize: "12px", padding: "4px 12px", borderRadius: "20px", fontWeight: 500, background: cfg.bg, color: cfg.color, border: cfg.border }}>
      {cfg.label}
    </span>
  )
}
*/
