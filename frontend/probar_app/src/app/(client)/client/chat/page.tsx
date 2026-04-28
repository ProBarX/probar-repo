"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { PropostaCard, Proposta } from "@/components/client/chat/PropostaCard"
import { CounterPropostaForm } from "@/components/client/chat/CounterPropostaForm"
import { useChat, type Chat, type Mensagem } from "@/services/useChat"

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ChatEnriquecido = Chat & {
  bartender_nome: string
  bartender_especialidade: string
  nao_lidas: number
}

const avatarColors = ["#3C3489", "#0F6E56", "#993C1D", "#185FA5", "#854F0B"]

const CURRENT_USER_ID = (() => {
  if (typeof window === "undefined") return 0
  try {
    const token = localStorage.getItem("access_token")
    if (!token) return 0
    const payload = JSON.parse(atob(token.split(".")[1]))
    return payload.user_id ?? payload.id ?? 0
  } catch {
    return 0
  }
})()

// ─── Componente ───────────────────────────────────────────────────────────────

export default function ChatPage() {
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

  const [chats, setChats] = useState<ChatEnriquecido[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [texto, setTexto] = useState("")
  const [counterParaId, setCounterParaId] = useState<number | null>(null)
  const [loadingChats, setLoadingChats] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // ── Carregar chats ─────────────────────────────────────────────────────────

  const carregarChats = useCallback(async () => {
    try {
      const data = await getChats()
      // Enriquecer com dados do pedido (bartender vem via pedido)
      const enriquecidos: ChatEnriquecido[] = data.map((c, i) => ({
        ...c,
        // Os dados do bartender virão da API de pedidos; por ora extraímos do payload se disponível
        bartender_nome: (c as any).bartender_nome ?? `Chat ${c.pedido}`,
        bartender_especialidade: (c as any).bartender_especialidade ?? "",
        nao_lidas: 0,
      }))
      setChats(enriquecidos)
    } catch (e) {
      setError("Não foi possível carregar as conversas.")
    } finally {
      setLoadingChats(false)
    }
  }, [getChats])

  useEffect(() => {
    carregarChats()
  }, [carregarChats])

  // ── Scroll automático ao fim das mensagens ─────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chats, selectedIdx])

  // ── Polling para atualizar mensagens do chat selecionado ───────────────────

  useEffect(() => {
    if (chats.length === 0) return

    const chatAtual = chats[selectedIdx]
    if (!chatAtual) return

    const poll = async () => {
      try {
        const mensagens = await getMensagens(chatAtual.id)
        setChats(prev =>
          prev.map((c, i) =>
            i === selectedIdx ? { ...c, mensagens } : c
          )
        )
      } catch {
        // silencioso para não exibir erros de polling
      }
    }

    poll() // busca imediata ao trocar de chat
    pollingRef.current = setInterval(poll, 3000)
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [selectedIdx, chats.length, getMensagens])

  // ── Ações de proposta ──────────────────────────────────────────────────────

  const updatePropostaLocal = (propostaId: number, novoStatus: Proposta["status"]) => {
    setChats(prev =>
      prev.map((c, i) => {
        if (i !== selectedIdx) return c
        return {
          ...c,
          mensagens: c.mensagens.map(m => {
            if (m.payload && (m.payload as any).id === propostaId) {
              return { ...m, payload: { ...(m.payload as any), status: novoStatus } }
            }
            return m
          }),
        }
      })
    )
  }

  const handleAceitar = async (propostaId: number) => {
    try {
      await aceitarProposta(propostaId)
      updatePropostaLocal(propostaId, "aceita")
    } catch {
      // erro já tratado no hook
    }
  }

  const handleRecusar = async (propostaId: number) => {
    try {
      await recusarProposta(propostaId)
      updatePropostaLocal(propostaId, "recusada")
    } catch {}
  }

  const handleCancelar = async (propostaId: number) => {
    try {
      await cancelarProposta(propostaId)
      updatePropostaLocal(propostaId, "cancelada")
    } catch {}
  }

  const handleEnviarCounter = async (
    propostaId: number,
    dados: { horas: number; desconto?: number; valor_adicional?: number }
  ) => {
    try {
      const novaProposta = await enviarContraproposta(propostaId, dados)

      // Marca proposta original como substituída
      updatePropostaLocal(propostaId, "substituida")

      // Adiciona a nova proposta como mensagem local (a API também cria no backend via chat)
      const novaMensagem: Mensagem = {
        id: Date.now(),
        chat: chats[selectedIdx].id,
        remetente: CURRENT_USER_ID,
        tipo: "proposta",
        conteudo: "",
        payload: novaProposta as any,
        criado_em: new Date().toISOString(),
      }

      setChats(prev =>
        prev.map((c, i) =>
          i === selectedIdx
            ? { ...c, mensagens: [...c.mensagens, novaMensagem] }
            : c
        )
      )
      setCounterParaId(null)
    } catch {}
  }

  // ── Envio de texto ─────────────────────────────────────────────────────────

  const handleEnviarTexto = async () => {
    if (!texto.trim()) return
    const chatId = chats[selectedIdx]?.id
    if (!chatId) return

    const conteudo = texto.trim()
    setTexto("")

    // Otimismo: adiciona localmente já
    const novaMensagem: Mensagem = {
      id: Date.now(),
      chat: chatId,
      remetente: CURRENT_USER_ID,
      tipo: "texto",
      conteudo,
      payload: null,
      criado_em: new Date().toISOString(),
    }
    setChats(prev =>
      prev.map((c, i) =>
        i === selectedIdx
          ? { ...c, mensagens: [...c.mensagens, novaMensagem] }
          : c
      )
    )

    try {
      await enviarMensagem(chatId, conteudo)
    } catch {
      // Reverter mensagem otimista em caso de erro
      setChats(prev =>
        prev.map((c, i) =>
          i === selectedIdx
            ? { ...c, mensagens: c.mensagens.filter(m => m.id !== novaMensagem.id) }
            : c
        )
      )
      setTexto(conteudo) // devolve o texto para o input
    }
  }

  // ── Extrair proposta de uma mensagem ───────────────────────────────────────

  const extractProposta = (msg: Mensagem): Proposta | null => {
    if (msg.tipo !== "proposta") return null
    if (msg.payload && typeof msg.payload === "object") {
      return msg.payload as unknown as Proposta
    }
    return null
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loadingChats) {
    return (
      <div style={{
        display: "flex",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "sans-serif",
        color: "#888",
        fontSize: "16px",
      }}>
        Carregando conversas...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        display: "flex",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "sans-serif",
        color: "#e53e3e",
        fontSize: "16px",
        flexDirection: "column",
        gap: "12px",
      }}>
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
      <div style={{
        display: "flex",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "sans-serif",
        color: "#888",
        fontSize: "16px",
        flexDirection: "column",
        gap: "16px",
      }}>
        <span>Nenhuma conversa ainda.</span>
        <button
          onClick={() => router.back()}
          style={{
            padding: "10px 20px",
            background: "#F5C518",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Voltar
        </button>
      </div>
    )
  }

  const conversa = chats[selectedIdx]

  return (
    <div style={{
      display: "flex",
      height: "100%",
      width: "100%",
      overflow: "hidden",
      fontFamily: "sans-serif",
    }}>

      {/* ── Sidebar de conversas ─────────────────────────────────────────── */}
      <div style={{
        width: 280,
        minWidth: 280,
        borderRight: "1px solid #eee",
        display: "flex",
        flexDirection: "column",
        background: "#fff",
      }}>

        <div style={{
          padding: "16px 16px 14px",
          borderBottom: "1px solid #eee",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}>
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
          <span style={{ fontWeight: 600, fontSize: "15px" }}>Conversas</span>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {chats.map((c, i) => {
            const ultimaMensagem = c.mensagens.at(-1)
            const preview =
              ultimaMensagem?.tipo === "proposta"
                ? "Proposta enviada"
                : ultimaMensagem?.conteudo ?? ""

            return (
              <div
                key={c.id}
                onClick={() => { setSelectedIdx(i); setCounterParaId(null) }}
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
                <div style={{
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
                }}>
                  {c.bartender_nome[0]?.toUpperCase() ?? "B"}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: "15px", margin: "0 0 2px" }}>
                    {c.bartender_nome}
                  </p>
                  <p style={{
                    fontSize: "13px",
                    color: "#999",
                    margin: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {preview}
                  </p>
                </div>

                {c.nao_lidas > 0 && (
                  <div style={{
                    background: "#F5C518",
                    borderRadius: "50%",
                    width: 20,
                    height: 20,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "11px",
                    fontWeight: 700,
                    flexShrink: 0,
                  }}>
                    {c.nao_lidas}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Área do chat ─────────────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        background: "#fff",
      }}>

        {/* Header do chat */}
        <div style={{
          padding: "14px 24px",
          borderBottom: "1px solid #eee",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          background: "#fff",
        }}>
          <div style={{
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
          }}>
            {conversa.bartender_nome[0]?.toUpperCase() ?? "B"}
          </div>
          <div>
            <p style={{ fontWeight: 600, margin: 0, fontSize: "17px" }}>
              {conversa.bartender_nome}
            </p>
            <p style={{ fontSize: "13px", color: "#999", margin: 0 }}>
              {conversa.bartender_especialidade}
            </p>
          </div>
        </div>

        {/* Mensagens */}
        <div style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px 24px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          background: "#f9f9f9",
        }}>
          {conversa.mensagens.map(msg => {
            const isOwn = msg.remetente === CURRENT_USER_ID

            if (msg.tipo === "texto") {
              return (
                <div
                  key={msg.id}
                  style={{
                    maxWidth: "60%",
                    padding: "10px 16px",
                    borderRadius: "14px",
                    fontSize: "16px",
                    lineHeight: 1.5,
                    alignSelf: isOwn ? "flex-end" : "flex-start",
                    background: isOwn ? "#F5C518" : "#fff",
                    color: "#1a1a1a",
                    border: isOwn ? "none" : "1px solid #eee",
                    borderBottomRightRadius: isOwn ? 4 : 14,
                    borderBottomLeftRadius: isOwn ? 14 : 4,
                  }}
                >
                  {msg.conteudo}
                </div>
              )
            }

            if (msg.tipo === "proposta") {
              const proposta = extractProposta(msg)
              if (!proposta) return null

              return (
                <div key={msg.id} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <PropostaCard
                    proposta={proposta}
                    currentUserId={CURRENT_USER_ID}
                    onAceitar={handleAceitar}
                    onRecusar={handleRecusar}
                    onCancelar={handleCancelar}
                    onCounter={(id) => setCounterParaId(counterParaId === id ? null : id)}
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

            return null
          })}

          {/* Loading indicator enquanto ação de proposta processa */}
          {apiLoading && (
            <div style={{ alignSelf: "center", color: "#aaa", fontSize: "13px" }}>
              Processando...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: "14px 24px",
          borderTop: "1px solid #eee",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          background: "#fff",
        }}>
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
              fontSize: "16px",
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}