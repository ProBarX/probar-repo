"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { PropostaCard, type Proposta } from "@/components/client/chat/PropostaCard"
import { CounterPropostaForm } from "@/components/client/chat/CounterPropostaForm"
import { useChat, type Chat, type Mensagem } from "@/services/useChat"
import { api } from "@/services/api"

type ChatEnriquecido = Chat & {
  bartender_nome: string
  bartender_especialidade: string
}

const avatarColors = ["#3C3489", "#0F6E56", "#993C1D", "#185FA5", "#854F0B"]

// Lê user_id do JWT que já está no cookie — via rota interna Next.js
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

export default function ChatPage() {
  const router = useRouter()
  const { getChats, getMensagens, enviarMensagem, aceitarProposta, recusarProposta, cancelarProposta, enviarContraproposta, loading: apiLoading } = useChat()

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
  useEffect(() => { getCurrentUserId().then(setCurrentUserId) }, [])

  // Carrega chats e enriquece com nome do bartender via pedido
  const carregarChats = useCallback(async () => {
    try {
      const data = await getChats()

      // Busca pedidos para obter nome do bartender de cada chat
      const { data: pedidosRaw } = await api.get("/pedidos/")
      const pedidos: any[] = Array.isArray(pedidosRaw) ? pedidosRaw : pedidosRaw.results ?? []

      // Busca bartenders para cruzar nome
      const { data: bartendersRaw } = await api.get("/bartenders/")
      const bartenders: any[] = Array.isArray(bartendersRaw) ? bartendersRaw : bartendersRaw.results ?? []

      const enriquecidos: ChatEnriquecido[] = data.map((c) => {
        const pedido = pedidos.find((p) => p.id === c.pedido)
        const bartenderId = pedido?.bartender
        const bartender = bartenders.find((b) => b.user_id === bartenderId)
        return {
          ...c,
          bartender_nome: bartender?.nome ?? `Pedido #${c.pedido}`,
          bartender_especialidade: bartender?.especialidades ?? "",
        }
      })

      setChats(enriquecidos)
    } catch (e: any) {
      setError("Não foi possível carregar as conversas.")
    } finally {
      setLoadingChats(false)
    }
  }, [getChats])

  useEffect(() => { carregarChats() }, [carregarChats])

  // Scroll automático
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chats, selectedIdx])

  // Polling de mensagens
  useEffect(() => {
    if (chats.length === 0) return
    const chatAtual = chats[selectedIdx]
    if (!chatAtual) return

    const poll = async () => {
      try {
        const mensagens = await getMensagens(chatAtual.id)
        setChats(prev => prev.map((c, i) => i === selectedIdx ? { ...c, mensagens } : c))
      } catch {}
    }

    poll()
    pollingRef.current = setInterval(poll, 3000)
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [selectedIdx, chats.length, getMensagens])

  // Atualiza status de proposta localmente
  const updatePropostaLocal = (propostaId: number, novoStatus: string) => {
    setChats(prev => prev.map((c, i) => {
      if (i !== selectedIdx) return c
      return {
        ...c,
        mensagens: c.mensagens.map(m => {
          if (m.tipo === "card_proposta" && m.payload && (m.payload as any).proposta_id === propostaId) {
            return { ...m, payload: { ...(m.payload as any), status: novoStatus } }
          }
          return m
        }),
      }
    }))
  }

  const handleAceitar = async (id: number) => {
    try { await aceitarProposta(id); updatePropostaLocal(id, "ACEITA") } catch {}
  }
  const handleRecusar = async (id: number) => {
    try { await recusarProposta(id); updatePropostaLocal(id, "RECUSADA") } catch {}
  }
  const handleCancelar = async (id: number) => {
    try { await cancelarProposta(id); updatePropostaLocal(id, "CANCELADA") } catch {}
  }

  const handleEnviarCounter = async (propostaId: number, dados: { horas: number; desconto?: number; valor_adicional?: number }) => {
    try {
      await enviarContraproposta(propostaId, dados)
      updatePropostaLocal(propostaId, "SUBSTITUIDA")
      setCounterParaId(null)
      const mensagens = await getMensagens(chats[selectedIdx].id)
      setChats(prev => prev.map((c, i) => i === selectedIdx ? { ...c, mensagens } : c))
    } catch {}
  }

  const handleEnviarTexto = async () => {
    if (!texto.trim()) return
    const chatId = chats[selectedIdx]?.id
    if (!chatId) return
    const conteudo = texto.trim()
    setTexto("")

    const temp: Mensagem = { id: Date.now(), chat: chatId, remetente: currentUserId, tipo: "texto", conteudo, payload: null, criado_em: new Date().toISOString() }
    setChats(prev => prev.map((c, i) => i === selectedIdx ? { ...c, mensagens: [...c.mensagens, temp] } : c))

    try {
      await enviarMensagem(chatId, conteudo)
    } catch {
      setChats(prev => prev.map((c, i) => i === selectedIdx ? { ...c, mensagens: c.mensagens.filter(m => m.id !== temp.id) } : c))
      setTexto(conteudo)
    }
  }

  const extractProposta = (msg: Mensagem): Proposta | null => {
    if (msg.tipo !== "card_proposta" || !msg.payload) return null
    const p = msg.payload as any
    return {
      id: p.proposta_id,
      pedido: p.pedido_id,
      remetente: p.remetente ?? 0,
      tipo: p.tipo ?? "inicial",
      horas: p.horas ?? 0,
      valor_adicional: String(p.valor_adicional ?? "0.00"),
      desconto: String(p.desconto ?? "0.00"),
      status: p.status ?? "PENDENTE",
      criado_em: msg.criado_em,
      valor_total: parseFloat(String(p.valor_total ?? "0")),
    }
  }

  const renderMensagem = (msg: Mensagem) => {
    const isOwn = msg.remetente !== null && msg.remetente === currentUserId

    if (msg.tipo === "texto") {
      return (
        <div key={msg.id} style={{
          maxWidth: "60%", padding: "10px 16px", borderRadius: "14px",
          fontSize: "15px", lineHeight: 1.5,
          alignSelf: isOwn ? "flex-end" : "flex-start",
          background: isOwn ? "#F5C518" : "#fff", color: "#1a1a1a",
          border: isOwn ? "none" : "1px solid #eee",
          borderBottomRightRadius: isOwn ? 4 : 14,
          borderBottomLeftRadius: isOwn ? 14 : 4,
        }}>
          {msg.conteudo}
        </div>
      )
    }

    if (msg.tipo === "card_proposta") {
      const proposta = extractProposta(msg)
      if (!proposta) return null
      return (
        <div key={msg.id} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <PropostaCard
            proposta={proposta}
            currentUserId={currentUserId}
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

    if (msg.tipo === "card_evento") {
      const p = msg.payload as any
      if (!p) return null
      return (
        <div key={msg.id} style={{
          alignSelf: "center", background: "#fff", border: "1px solid #eee",
          borderRadius: "12px", padding: "12px 16px", fontSize: "13px", color: "#555", maxWidth: "340px", width: "100%",
        }}>
          <p style={{ margin: "0 0 6px", fontWeight: 600, fontSize: "14px", color: "#1a1a1a" }}>📅 {p.nome}</p>
          <p style={{ margin: 0, color: "#888" }}>{p.data} · {p.hora_inicio?.slice(0, 5)} – {p.hora_fim?.slice(0, 5)}</p>
          <p style={{ margin: "4px 0 0", color: "#888" }}>{p.quantidade_convidados} convidados</p>
          {p.descricao_evento && <p style={{ margin: "4px 0 0", color: "#aaa", fontSize: "12px" }}>{p.descricao_evento}</p>}
        </div>
      )
    }

    if (msg.tipo === "status_update") {
      return (
        <div key={msg.id} style={{
          alignSelf: "center", background: "#f5f5f5", borderRadius: "20px",
          padding: "6px 16px", fontSize: "12px", color: "#888",
        }}>
          {msg.conteudo}
        </div>
      )
    }

    return null
  }

  // ── Estados de loading/erro ────────────────────────────────────────────────

  if (loadingChats) {
    return <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "#888" }}>Carregando conversas...</div>
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
        <span>Nenhuma conversa ainda.</span>
        <button onClick={() => router.back()} style={{ padding: "10px 20px", background: "#F5C518", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }}>Voltar</button>
      </div>
    )
  }

  const conversa = chats[selectedIdx]

  return (
    <div style={{ display: "flex", height: "100%", width: "100%", overflow: "hidden", fontFamily: "sans-serif" }}>

      {/* Sidebar de conversas */}
      <div style={{ width: 280, minWidth: 280, borderRight: "1px solid #eee", display: "flex", flexDirection: "column", background: "#fff" }}>
        <div style={{ padding: "16px 16px 14px", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", gap: "10px" }}>
          <button onClick={() => router.back()} style={{ background: "none", border: "1px solid #eee", borderRadius: "8px", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, color: "#444" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
          </button>
          <span style={{ fontWeight: 600, fontSize: "15px" }}>Conversas</span>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {chats.map((c, i) => {
            const ultima = c.mensagens.at(-1)
            const preview = ultima?.tipo === "card_proposta" ? "Proposta enviada" : ultima?.tipo === "status_update" ? ultima.conteudo : ultima?.conteudo ?? ""
            return (
              <div key={c.id} onClick={() => { setSelectedIdx(i); setCounterParaId(null) }} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", cursor: "pointer", borderBottom: "1px solid #f5f5f5", background: i === selectedIdx ? "#fafafa" : "#fff" }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: avatarColors[i % avatarColors.length], display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 600, fontSize: "15px", flexShrink: 0 }}>
                  {c.bartender_nome[0]?.toUpperCase() ?? "B"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: "15px", margin: "0 0 2px" }}>{c.bartender_nome}</p>
                  <p style={{ fontSize: "13px", color: "#999", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Área do chat */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "#fff" }}>

        {/* Header */}
        <div style={{ padding: "14px 24px", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: avatarColors[selectedIdx % avatarColors.length], display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 600, fontSize: "15px" }}>
            {conversa.bartender_nome[0]?.toUpperCase() ?? "B"}
          </div>
          <div>
            <p style={{ fontWeight: 600, margin: 0, fontSize: "17px" }}>{conversa.bartender_nome}</p>
            <p style={{ fontSize: "13px", color: "#999", margin: 0 }}>{conversa.bartender_especialidade}</p>
          </div>
        </div>

        {/* Mensagens */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: "14px", background: "#f9f9f9" }}>
          {conversa.mensagens.map(msg => renderMensagem(msg))}
          {apiLoading && <div style={{ alignSelf: "center", color: "#aaa", fontSize: "13px" }}>Processando...</div>}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={{ padding: "14px 24px", borderTop: "1px solid #eee", display: "flex", alignItems: "center", gap: "10px", background: "#fff" }}>
          <input
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleEnviarTexto()}
            placeholder="Digite uma mensagem..."
            style={{ flex: 1, padding: "10px 16px", border: "1px solid #e5e5e5", borderRadius: "24px", fontSize: "15px", outline: "none", background: "#f5f5f5", color: "#1a1a1a" }}
          />
          <button
            onClick={handleEnviarTexto}
            disabled={!texto.trim()}
            style={{ width: 40, height: 40, borderRadius: "50%", background: texto.trim() ? "#F5C518" : "#e5e5e5", border: "none", cursor: texto.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}