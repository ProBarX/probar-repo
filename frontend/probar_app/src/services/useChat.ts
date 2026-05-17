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
  valor_hora?: number | string
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

export type PedidoResumoChat = {
  pedido_id: number
  numero_bartender: number | null
  pedido_status: string | null
  pagamento_status: string | null
  pagamento_finalizado_pelo_cliente: boolean
  presenca_status: string | null
  presenca_origem: string | null
  servico_fim_previsto: string | null
  liberacao_automatica_em: string | null
  solicitacao_reembolso_status: string | null
  solicitacao_reembolso_tipo: string | null
}

export type Chat = {
  id: number
  pedido: number
  cliente_nome?: string
  cliente_foto_perfil?: string | null
  bartender_nome?: string
  bartender_foto_perfil?: string | null
  bartender_especialidade?: string
  evento_nome?: string
  evento_data?: string | null
  evento_hora_inicio?: string | null
  evento_hora_fim?: string | null
  evento_cep?: string | null
  evento_rua?: string | null
  evento_numero?: string | null
  evento_complemento?: string | null
  evento_quantidade_convidados?: number | null
  evento_descricao?: string | null
  pedido_resumo?: PedidoResumoChat | null
  mensagens: Mensagem[]
  criado_em: string
}

export type ChatPage = {
  results: Chat[]
  next: string | null
  count: number | null
}

type PaginatedResponse<T> = {
  count?: number
  next?: string | null
  previous?: string | null
  results?: T[]
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

function extractApiError(data: unknown): string | null {
  if (typeof data === "string") return data
  if (!data || typeof data !== "object") return null

  const record = data as Record<string, unknown>
  const detail = record.detail
  if (typeof detail === "string") return detail
  if (Array.isArray(detail) && detail.length > 0) return String(detail[0])

  const firstValue = Object.values(record)[0]
  if (typeof firstValue === "string") return firstValue
  if (Array.isArray(firstValue) && firstValue.length > 0) return String(firstValue[0])

  return null
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
  if (!res.ok) {
    let message = `Erro na API (${res.status})`
    try {
      const data = await res.json()
      message = extractApiError(data) ?? message
    } catch {
      // Mantem a mensagem generica quando a API nao retorna JSON.
    }
    throw new Error(message)
  }
  return res.json()
}

function buildChatPath({ pedidoId, page }: { pedidoId?: number; page?: number } = {}) {
  const params = new URLSearchParams()
  if (pedidoId) params.set("pedido", String(pedidoId))
  if (page && page > 1) params.set("page", String(page))

  const query = params.toString()
  return `/chats/${query ? `?${query}` : ""}`
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useChat() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getChatsPage = useCallback(async ({
    pedidoId,
    page = 1,
  }: {
    pedidoId?: number
    page?: number
  } = {}): Promise<ChatPage> => {
    const data = await apiFetch<Chat[] | PaginatedResponse<Chat>>(buildChatPath({ pedidoId, page }))
    if (Array.isArray(data)) {
      return { results: data, next: null, count: data.length }
    }

    return {
      results: data.results ?? [],
      next: data.next ?? null,
      count: typeof data.count === "number" ? data.count : null,
    }
  }, [])

  // Buscar chats — mantem compatibilidade e percorre todas as paginas quando usado diretamente.
  const getChats = useCallback(async (pedidoId?: number): Promise<Chat[]> => {
    const all: Chat[] = []
    let page = 1

    for (let guard = 0; guard < 50; guard += 1) {
      const data = await getChatsPage({ pedidoId, page })
      all.push(...data.results)
      if (!data.next) break
      page += 1
    }

    return all
  }, [getChatsPage])

  // Buscar mensagens de um chat específico
  const getChat = useCallback(async (chatId: number): Promise<Chat> => {
    return apiFetch<Chat>(`/chats/${chatId}/`)
  }, [])

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
    getChatsPage,
    getChat,
    getMensagens,
    enviarMensagem,
    aceitarProposta,
    recusarProposta,
    cancelarProposta,
    enviarContraproposta,
  }
}
