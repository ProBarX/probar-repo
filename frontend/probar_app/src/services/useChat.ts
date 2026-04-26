/**
 * useChat — hook para integrar o chat com a API Django.
 *
 * Uso futuro com WebSocket (Django Channels) também documentado abaixo.
 */

import { useState, useCallback } from "react"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api"

// ─── Tipos ────────────────────────────────────────────────────────────────────

type PropostaStatus = "pendente" | "aceita" | "recusada" | "cancelada" | "substituida"

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
  remetente: number
  tipo: string
  conteudo: string
  payload: Record<string, unknown> | null
  criado_em: string
}

export type Chat = {
  id: number
  pedido: number
  mensagens: Mensagem[]
  criado_em: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("access_token") // ou seu método de auth
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
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

  // Buscar chats do pedido
  const getChats = useCallback(async (): Promise<Chat[]> => {
    return apiFetch("/chats/")
  }, [])

  // Buscar mensagens de um chat
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

/*
 ┌──────────────────────────────────────────────────────────────────┐
 │  PRÓXIMO PASSO: Chat ao vivo com Django Channels + WebSocket     │
 └──────────────────────────────────────────────────────────────────┘

  1. Backend: instalar channels + daphne
     pip install channels daphne channels-redis

  2. settings.py:
     INSTALLED_APPS = [..., "channels"]
     ASGI_APPLICATION = "core.asgi.application"
     CHANNEL_LAYERS = {
       "default": {
         "BACKEND": "channels_redis.core.RedisChannelLayer",
         "CONFIG": {"hosts": [("127.0.0.1", 6379)]},
       }
     }

  3. Criar consumers/chat_consumer.py:
     class ChatConsumer(AsyncWebsocketConsumer):
       async def connect(self):
         self.chat_id = self.scope["url_route"]["kwargs"]["chat_id"]
         self.group = f"chat_{self.chat_id}"
         await self.channel_layer.group_add(self.group, self.channel_name)
         await self.accept()

       async def receive(self, text_data):
         data = json.loads(text_data)
         # salvar mensagem no banco...
         await self.channel_layer.group_send(self.group, {
           "type": "chat.message",
           "mensagem": data,
         })

       async def chat_message(self, event):
         await self.send(json.dumps(event["mensagem"]))

  4. No frontend (substituir polling por WebSocket):

     const ws = new WebSocket(`ws://localhost:8000/ws/chat/${chatId}/`)
     ws.onmessage = (e) => {
       const nova = JSON.parse(e.data)
       setMensagens(prev => [...prev, nova])
     }

  Enquanto não tiver WebSocket:
  - Usar polling simples: setInterval(() => getMensagens(chatId), 3000)
  - Ou react-query com refetchInterval: useQuery({ refetchInterval: 3000 })
*/