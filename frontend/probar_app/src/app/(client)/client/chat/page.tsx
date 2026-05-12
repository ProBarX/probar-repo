"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { PropostaCard, type Proposta } from "@/components/client/chat/PropostaCard"
import { CounterPropostaForm } from "@/components/client/chat/CounterPropostaForm"
import { useChat, type Chat, type Mensagem } from "@/services/useChat"
import { api } from "@/services/api"

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ChatEnriquecido = Chat & {
  bartender_nome: string
  bartender_especialidade: string
  evento_nome: string
}

type PedidoResumo = {
  id: number
  bartender_nome?: string
  bartender_especialidade?: string
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
  quantidade_convidados?: number
  descricao_evento?: string
}

const avatarColors = ["#3C3489", "#0F6E56", "#993C1D", "#185FA5", "#854F0B"]

function getResults<T>(data: T[] | { results?: T[] }): T[] {
  return Array.isArray(data) ? data : data.results ?? []
}

function getPropostaPayload(payload: Mensagem["payload"]): PropostaPayload | null {
  return payload ? (payload as PropostaPayload) : null
}

function getEventoPayload(payload: Mensagem["payload"]): EventoPayload | null {
  return payload ? (payload as EventoPayload) : null
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

export default function ClientChatPage() {
  const router = useRouter()
  const {
    getChats,
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

  // Carrega user_id do token
  useEffect(() => {
    getCurrentUserId().then(setCurrentUserId)
  }, [])

  // Carrega chats e enriquece com dados do bartender vindos do PedidoSerializer
  const carregarChats = useCallback(async () => {
    try {
      const data = await getChats()

      const { data: pedidosRaw } = await api.get<PedidoResumo[] | { results?: PedidoResumo[] }>("/pedidos/")
      const pedidos = getResults(pedidosRaw)

      const enriquecidos: ChatEnriquecido[] = data.map((c) => {
        const pedido = pedidos.find((p) => p.id === c.pedido)
        const bartenderNome = c.bartender_nome?.trim() || pedido?.bartender_nome?.trim() || "Bartender"

        return {
          ...c,
          bartender_nome: bartenderNome,
          bartender_especialidade: c.bartender_especialidade ?? pedido?.bartender_especialidade ?? "",
          evento_nome: c.evento_nome ?? pedido?.evento_nome ?? "",
        }
      })

      setChats(enriquecidos)
    } catch {
      setError("Não foi possível carregar as conversas.")
    } finally {
      setLoadingChats(false)
    }
  }, [getChats])

  useEffect(() => {
    carregarChats()
  }, [carregarChats])

  // Scroll automático ao fim das mensagens
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chats, selectedIdx])

  const selectedChatId = chats[selectedIdx]?.id

  // Polling de mensagens do chat selecionado
  useEffect(() => {
    if (!selectedChatId) return

    const poll = async () => {
      try {
        const mensagens = await getMensagens(selectedChatId)
        setChats((prev) =>
          prev.map((c) => (c.id === selectedChatId ? { ...c, mensagens } : c))
        )
      } catch {}
    }

    poll()
    pollingRef.current = setInterval(poll, 3000)
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [getMensagens, selectedChatId])

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
      const propostaAceita = await aceitarProposta(id)
      updatePropostaLocal(id, "ACEITA")
      // Redireciona para pagamento após aceitar
      router.push(`/client/payment?pedido=${propostaAceita.pedido}`)
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
      // Recarrega mensagens para exibir a nova proposta vinda do backend
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

    // Otimismo: adiciona a mensagem localmente antes da resposta da API
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
      // Reverte em caso de erro
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

  // ── Extrai proposta do payload de uma mensagem card_proposta ───────────────

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
            maxWidth: "75%",
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
      return (
        <div
          key={msg.id}
          style={{ display: "flex", flexDirection: "column", gap: "8px" }}
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
      if (!p) return null
      return (
        <div
          key={msg.id}
          style={{
            alignSelf: "center",
            background: "#fff",
            border: "1px solid #eee",
            borderRadius: "12px",
            padding: "12px 16px",
            fontSize: "13px",
            color: "#555",
            maxWidth: "340px",
            width: "100%",
          }}
        >
          <p
            style={{
              margin: "0 0 6px",
              fontWeight: 600,
              fontSize: "14px",
              color: "#1a1a1a",
            }}
          >
            📅 {p.nome}
          </p>
          <p style={{ margin: 0, color: "#888" }}>
            {p.data} · {p.hora_inicio?.slice(0, 5)} – {p.hora_fim?.slice(0, 5)}
          </p>
          <p style={{ margin: "4px 0 0", color: "#888" }}>
            {p.quantidade_convidados} convidados
          </p>
          {p.descricao_evento && (
            <p style={{ margin: "4px 0 0", color: "#aaa", fontSize: "12px" }}>
              {p.descricao_evento}
            </p>
          )}
        </div>
      )
    }

    if (msg.tipo === "status_update") {
      const isAceite = msg.conteudo?.toLowerCase().includes("aceita")
      const pedidoId =
        typeof msg.payload?.pedido_id === "number" ? msg.payload.pedido_id : null
      return (
        <div
          key={msg.id}
          style={{
            alignSelf: "center",
            background: isAceite ? "#EAF3DE" : "#f5f5f5",
            border: isAceite ? "1px solid #97C459" : "none",
            borderRadius: "20px",
            padding: "6px 16px",
            fontSize: "12px",
            color: isAceite ? "#3B6D11" : "#888",
            fontWeight: isAceite ? 600 : 400,
          }}
        >
          {msg.conteudo}
          {/* Botão de ir para pagamento quando proposta for aceita */}
          {isAceite && (
            <button
              onClick={() => router.push(pedidoId ? `/client/payment?pedido=${pedidoId}` : "/client/chat")}
              style={{
                display: "block",
                marginTop: "8px",
                padding: "6px 16px",
                background: "#F5C518",
                border: "none",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                color: "#1a1a1a",
              }}
            >
              Ir para pagamento →
            </button>
          )}
        </div>
      )
    }

    return null
  }

  // ── Estados de loading/erro ────────────────────────────────────────────────

  if (loadingChats) {
    return (
      <div
        style={{
          display: "flex",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          color: "#888",
        }}
      >
        Carregando conversas...
      </div>
    )
  }

  if (error) {
    return (
      <div
        style={{
          display: "flex",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          color: "#e53e3e",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <span>{error}</span>
        <button
          onClick={carregarChats}
          style={{
            padding: "10px 20px",
            background: "#F5C518",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  if (chats.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          color: "#888",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div style={{ fontSize: "40px" }}>💬</div>
        <p style={{ margin: 0, fontWeight: 600, fontSize: "16px" }}>
          Nenhuma conversa ainda
        </p>
        <p style={{ margin: 0, fontSize: "14px", color: "#aaa" }}>
          Contrate um bartender para começar a negociar.
        </p>
        <button
          onClick={() => router.push("/client/home")}
          style={{
            padding: "10px 20px",
            background: "#F5C518",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Encontrar bartenders
        </button>
      </div>
    )
  }

  const conversa = chats[selectedIdx]

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        overflow: "hidden",
        fontFamily: "sans-serif",
      }}
    >
      {/* ── Sidebar de conversas ──────────────────────────────────────────── */}
      <div
        style={{
          width: 280,
          minWidth: 280,
          borderRight: "1px solid #eee",
          display: "flex",
          flexDirection: "column",
          background: "#fff",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 16px 14px",
            borderBottom: "1px solid #eee",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <button
            onClick={() => router.back()}
            style={{
              background: "none",
              border: "1px solid #eee",
              borderRadius: "8px",
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
              color: "#444",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
          <span style={{ fontWeight: 600, fontSize: "15px" }}>Conversas</span>
        </div>

        {/* Lista de chats */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {chats.map((c, i) => {
            const ultima = c.mensagens.at(-1)
            const preview =
              ultima?.tipo === "card_proposta"
                ? "📋 Proposta enviada"
                : ultima?.tipo === "status_update"
                ? ultima.conteudo
                : ultima?.conteudo ?? ""

            // Badge quando bartender enviou contraproposta pendente
            const temRespostaPendente = c.mensagens.some(
              (m) => {
                const payload = getPropostaPayload(m.payload)
                return (
                  m.tipo === "card_proposta" &&
                  payload?.status === "PENDENTE" &&
                  payload.remetente !== currentUserId
                )
              }
            )

            return (
              <div
                key={c.id}
                onClick={() => {
                  setSelectedIdx(i)
                  setCounterParaId(null)
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "14px 16px",
                  cursor: "pointer",
                  borderBottom: "1px solid #f5f5f5",
                  background: i === selectedIdx ? "#fafafa" : "#fff",
                  transition: "background 0.15s",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: avatarColors[i % avatarColors.length],
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: "15px",
                    flexShrink: 0,
                    position: "relative",
                  }}
                >
                  {c.bartender_nome[0]?.toUpperCase() ?? "B"}
                  {temRespostaPendente && (
                    <div
                      style={{
                        position: "absolute",
                        top: -2,
                        right: -2,
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        background: "#F5C518",
                        border: "2px solid #fff",
                      }}
                    />
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontWeight: 600,
                      fontSize: "15px",
                      margin: "0 0 2px",
                    }}
                  >
                    {c.bartender_nome}
                  </p>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "#999",
                      margin: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {preview}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Área principal do chat ────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          background: "#fff",
        }}
      >
        {/* Header do chat */}
        <div
          style={{
            padding: "14px 24px",
            borderBottom: "1px solid #eee",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: avatarColors[selectedIdx % avatarColors.length],
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 600,
                fontSize: "15px",
              }}
            >
              {conversa.bartender_nome[0]?.toUpperCase() ?? "B"}
            </div>
            <div>
              <p style={{ fontWeight: 600, margin: 0, fontSize: "17px" }}>
                {conversa.bartender_nome}
              </p>
              <p style={{ fontSize: "12px", color: "#999", margin: 0 }}>
                {conversa.bartender_especialidade}
                {conversa.evento_nome && ` · 📅 ${conversa.evento_nome}`}
              </p>
            </div>
          </div>

          {/* Badge de status */}
          <PedidoStatusBadge mensagens={conversa.mensagens} />
        </div>

        {/* Mensagens */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            background: "#f9f9f9",
          }}
        >
          {conversa.mensagens.map((msg) => renderMensagem(msg))}

          {apiLoading && (
            <div
              style={{
                alignSelf: "center",
                color: "#aaa",
                fontSize: "13px",
              }}
            >
              Processando...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid #eee",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            background: "#fff",
          }}
        >
          <input
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleEnviarTexto()}
            placeholder="Digite uma mensagem..."
            style={{
              flex: 1,
              padding: "10px 16px",
              border: "1px solid #e5e5e5",
              borderRadius: "24px",
              fontSize: "15px",
              outline: "none",
              background: "#f5f5f5",
              color: "#1a1a1a",
            }}
          />
          <button
            onClick={handleEnviarTexto}
            disabled={!texto.trim()}
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: texto.trim() ? "#F5C518" : "#e5e5e5",
              border: "none",
              cursor: texto.trim() ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "background 0.15s",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#1a1a1a"
              strokeWidth="2"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Badge de status do pedido ──────────────────────────────────────────────────

function PedidoStatusBadge({ mensagens }: { mensagens: Mensagem[] }) {
  const ultimaPropostaMsg = [...mensagens]
    .reverse()
    .find((m) => m.tipo === "card_proposta")

  const payload = ultimaPropostaMsg ? getPropostaPayload(ultimaPropostaMsg.payload) : null
  const status = payload?.status ?? null

  if (!status) return null

  const configs: Record<
    string,
    { label: string; bg: string; color: string; border: string }
  > = {
    PENDENTE: {
      label: "Aguardando resposta",
      bg: "#fff",
      color: "#BA7517",
      border: "1px solid #EF9F27",
    },
    ACEITA: {
      label: "Proposta aceita ✓",
      bg: "#EAF3DE",
      color: "#3B6D11",
      border: "1px solid #97C459",
    },
    RECUSADA: {
      label: "Proposta recusada",
      bg: "#FCEBEB",
      color: "#A32D2D",
      border: "1px solid #E24B4A",
    },
    CANCELADA: {
      label: "Cancelada",
      bg: "#F1EFE8",
      color: "#5F5E5A",
      border: "1px solid #B4B2A9",
    },
    SUBSTITUIDA: {
      label: "Contraproposta enviada",
      bg: "#E6F1FB",
      color: "#185FA5",
      border: "1px solid #85B7EB",
    },
  }

  const cfg = configs[status] ?? configs.PENDENTE

  return (
    <span
      style={{
        fontSize: "12px",
        padding: "4px 12px",
        borderRadius: "20px",
        fontWeight: 500,
        background: cfg.bg,
        color: cfg.color,
        border: cfg.border,
      }}
    >
      {cfg.label}
    </span>
  )
}
