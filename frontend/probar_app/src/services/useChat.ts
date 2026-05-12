/**
 * useChat — hook para integrar o chat com a API Django.
 */

import { useState, useCallback } from "react"

// Usa o mesmo base que api.ts
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1"

// ─── Tipos ────────────────────────────────────────────────────────────────────

type PropostaStatus = "PENDENTE" | "ACEITA" | "RECUSADA" | "CANCELADA" | "SUBSTITUIDA"

export type Proposta = {
  id: number
  pedido: number
  remetente: number
  tipo: string
  horas: number
  valor_adicional: string
  desconto: string
  status: PropostaStatus
  criado_em: string
  valor_total: number
}

export type Mensagem = {
  id: number
  chat: number
  remetente: number | null
  tipo: string
  conteudo: string
  payload: Record<string, unknown> | null
  criado_em: string
}

export type Chat = {
  id: number
  pedido: number
  cliente_nome?: string
  bartender_nome?: string
  bartender_especialidade?: string
  evento_nome?: string
  mensagens: Mensagem[]
  criado_em: string
}

// ─── Helper: busca token via rota interna (mesma lógica do api.ts) ────────────

async function getToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/get-token", { cache: "no-store" })
    const data = await res.json()
    return data.token ?? null
  } catch {
    return null
  }
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
    ...options,
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useChat() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Buscar chats — suporta resposta paginada { count, results } e array direto
  const getChats = useCallback(async (): Promise<Chat[]> => {
    const data = await apiFetch<Chat[] | { count: number; results: Chat[] }>("/chats/")
    return Array.isArray(data) ? data : (data.results ?? [])
  }, [])

  // Buscar mensagens de um chat específico
  const getMensagens = useCallback(async (chatId: number): Promise<Mensagem[]> => {
    const chat = await apiFetch<Chat>(`/chats/${chatId}/`)
    return chat.mensagens
  }, [])

  // Enviar mensagem de texto
  const enviarMensagem = useCallback(async (chatId: number, conteudo: string): Promise<Mensagem> => {
    return apiFetch("/mensagens/", {
      method: "POST",
      body: JSON.stringify({ chat: chatId, conteudo, tipo: "texto" }),
    })
  }, [])

  // ── Ações de proposta ──────────────────────────────────────────────────────

  const aceitarProposta = useCallback(async (propostaId: number): Promise<Proposta> => {
    setLoading(true)
    try {
      return await apiFetch(`/propostas/${propostaId}/accept/`, { method: "POST", body: "{}" })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao aceitar proposta")
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  const recusarProposta = useCallback(async (propostaId: number): Promise<Proposta> => {
    setLoading(true)
    try {
      return await apiFetch(`/propostas/${propostaId}/reject/`, { method: "POST", body: "{}" })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao recusar proposta")
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  const cancelarProposta = useCallback(async (propostaId: number): Promise<Proposta> => {
    setLoading(true)
    try {
      return await apiFetch(`/propostas/${propostaId}/cancel/`, { method: "POST", body: "{}" })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao cancelar proposta")
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  const enviarContraproposta = useCallback(async (
    propostaId: number,
    dados: { horas: number; desconto?: number; valor_adicional?: number }
  ): Promise<Proposta> => {
    setLoading(true)
    try {
      return await apiFetch(`/propostas/${propostaId}/counter/`, {
        method: "POST",
        body: JSON.stringify(dados),
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao enviar contraproposta")
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    loading,
    error,
    getChats,
    getMensagens,
    enviarMensagem,
    aceitarProposta,
    recusarProposta,
    cancelarProposta,
    enviarContraproposta,
  }
}
