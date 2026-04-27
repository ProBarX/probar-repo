"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PropostaCard, Proposta } from "@/components/client/chat/PropostaCard"
import { CounterPropostaForm } from "@/components/client/chat/CounterPropostaForm"

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Bartender = {
  id: number
  nome: string
  especialidade: string
}

type Mensagem = {
  id: number
  tipo: "texto" | "proposta"
  remetente_id: number
  conteudo?: string
  proposta?: Proposta
  criado_em: string
}

type Conversa = {
  bartender: Bartender
  pedido_id: number
  mensagens: Mensagem[]
  nao_lidas: number
}

// ─── Mock ─────────────────────────────────────────────────────────────────────

const CURRENT_USER_ID = 1

const mockConversas: Conversa[] = [
  {
    bartender: { id: 10, nome: "Fulano", especialidade: "Tradicional" },
    pedido_id: 101,
    nao_lidas: 0,
    mensagens: [
      {
        id: 1, tipo: "proposta", remetente_id: CURRENT_USER_ID,
        criado_em: "2026-04-15T14:00:00",
        proposta: {
          id: 1, pedido: 101, remetente: CURRENT_USER_ID,
          tipo: "inicial", horas: 4,
          valor_adicional: "0.00", desconto: "0.00",
          status: "pendente", criado_em: "2026-04-15T14:00:00",
          valor_total: 2400,
        }
      }
    ]
  },
  {
    bartender: { id: 11, nome: "Cicrano", especialidade: "Showman" },
    pedido_id: 102,
    nao_lidas: 0,
    mensagens: [
      { id: 2, tipo: "texto", remetente_id: 11, conteudo: "Boa tarde! Vi seu pedido para o evento.", criado_em: "2026-04-15T10:30:00" },
      { id: 3, tipo: "texto", remetente_id: CURRENT_USER_ID, conteudo: "Boa tarde!", criado_em: "2026-04-15T10:31:00" },
    ]
  },
  {
    bartender: { id: 12, nome: "Beltrano", especialidade: "Mixologista" },
    pedido_id: 103,
    nao_lidas: 1,
    mensagens: [
      {
        id: 4, tipo: "proposta", remetente_id: 12,
        criado_em: "2026-04-15T09:00:00",
        proposta: {
          id: 2, pedido: 103, remetente: 12,
          tipo: "counter", horas: 3,
          valor_adicional: "0.00", desconto: "100.00",
          status: "pendente", criado_em: "2026-04-15T09:00:00",
          valor_total: 900,
        }
      }
    ]
  }
]

const avatarColors = ["#3C3489", "#0F6E56", "#993C1D", "#185FA5", "#854F0B"]

// ─── Componente ───────────────────────────────────────────────────────────────

export default function ChatPage() {
  const router = useRouter()
  const [conversas, setConversas] = useState<Conversa[]>(mockConversas)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [texto, setTexto] = useState("")
  const [counterParaId, setCounterParaId] = useState<number | null>(null)

  const conversa = conversas[selectedIdx]

  // ── Helpers ────────────────────────────────────────────────────────────────

  const updateProposta = (propostaId: number, novoStatus: Proposta["status"]) => {
    setConversas(prev => prev.map((c, i) => {
      if (i !== selectedIdx) return c
      return {
        ...c,
        mensagens: c.mensagens.map(m =>
          m.proposta?.id === propostaId
            ? { ...m, proposta: { ...m.proposta, status: novoStatus } }
            : m
        )
      }
    }))
  }

  // ── Ações da proposta ──────────────────────────────────────────────────────

  const handleAceitar = async (propostaId: number) => {
    // TODO: await apiFetch(`/propostas/${propostaId}/accept/`, { method: "POST" })
    updateProposta(propostaId, "aceita")
  }

  const handleRecusar = async (propostaId: number) => {
    // TODO: await apiFetch(`/propostas/${propostaId}/reject/`, { method: "POST" })
    updateProposta(propostaId, "recusada")
  }

  const handleCancelar = async (propostaId: number) => {
    // TODO: await apiFetch(`/propostas/${propostaId}/cancel/`, { method: "POST" })
    updateProposta(propostaId, "cancelada")
  }

  const handleEnviarCounter = async (
    propostaId: number,
    dados: { horas: number; desconto?: number; valor_adicional?: number }
  ) => {
    // TODO: await apiFetch(`/propostas/${propostaId}/counter/`, { method: "POST", body: JSON.stringify(dados) })
    const valorBase = 600
    const novaProposta: Proposta = {
      id: Date.now(),
      pedido: conversa.pedido_id,
      remetente: CURRENT_USER_ID,
      tipo: "counter",
      horas: dados.horas,
      valor_adicional: String(dados.valor_adicional ?? 0),
      desconto: String(dados.desconto ?? 0),
      status: "pendente",
      criado_em: new Date().toISOString(),
      valor_total: valorBase * dados.horas - (dados.desconto ?? 0) + (dados.valor_adicional ?? 0),
    }

    updateProposta(propostaId, "substituida")

    setConversas(prev => prev.map((c, i) => {
      if (i !== selectedIdx) return c
      return {
        ...c,
        mensagens: [...c.mensagens, {
          id: Date.now(),
          tipo: "proposta",
          remetente_id: CURRENT_USER_ID,
          criado_em: new Date().toISOString(),
          proposta: novaProposta,
        }]
      }
    }))
    setCounterParaId(null)
  }

  // ── Envio de texto ─────────────────────────────────────────────────────────

  const handleEnviarTexto = () => {
    if (!texto.trim()) return
    // TODO: await apiFetch("/mensagens/", { method: "POST", body: JSON.stringify({ chat: chatId, conteudo: texto }) })
    setConversas(prev => prev.map((c, i) => {
      if (i !== selectedIdx) return c
      return {
        ...c,
        mensagens: [...c.mensagens, {
          id: Date.now(),
          tipo: "texto",
          remetente_id: CURRENT_USER_ID,
          conteudo: texto.trim(),
          criado_em: new Date().toISOString(),
        }]
      }
    }))
    setTexto("")
  }

  // ── Render ─────────────────────────────────────────────────────────────────

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

        {/* Cabeçalho com botão voltar */}
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

        {/* Lista de conversas */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {conversas.map((c, i) => (
            <div
              key={c.pedido_id}
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
                {c.bartender.nome[0]}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 600, fontSize: "15px", margin: "0 0 2px" }}>
                  {c.bartender.nome}
                </p>
                <p style={{
                  fontSize: "13px",
                  color: "#999",
                  margin: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {c.mensagens.at(-1)?.tipo === "proposta"
                    ? "Proposta enviada"
                    : c.mensagens.at(-1)?.conteudo ?? ""}
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
          ))}
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
            {conversa.bartender.nome[0]}
          </div>
          <div>
            <p style={{ fontWeight: 600, margin: 0, fontSize: "17px" }}>
              {conversa.bartender.nome}
            </p>
            <p style={{ fontSize: "13px", color: "#999", margin: 0 }}>
              {conversa.bartender.especialidade}
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
            const isOwn = msg.remetente_id === CURRENT_USER_ID

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

            if (msg.tipo === "proposta" && msg.proposta) {
              return (
                <div key={msg.id} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <PropostaCard
                    proposta={msg.proposta}
                    currentUserId={CURRENT_USER_ID}
                    onAceitar={handleAceitar}
                    onRecusar={handleRecusar}
                    onCancelar={handleCancelar}
                    onCounter={(id) => setCounterParaId(counterParaId === id ? null : id)}
                  />
                  {counterParaId === msg.proposta.id && (
                    <CounterPropostaForm
                      propostaId={msg.proposta.id}
                      horasAtual={msg.proposta.horas}
                      valorAtual={msg.proposta.valor_total}
                      onEnviar={handleEnviarCounter}
                      onCancelar={() => setCounterParaId(null)}
                    />
                  )}
                </div>
              )
            }

            return null
          })}
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
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "#F5C518",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
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