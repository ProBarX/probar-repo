import { api } from "@/services/api" 
// ─── Tipos ────────────────────────────────────────────────────────────────────

/** Shape que o backend retorna / espera */
export type EventoAPI = {
  id: number
  cliente: number
  cliente_nome?: string
  nome: string
  data: string            // "YYYY-MM-DD"
  hora_inicio: string     // "HH:MM:SS"
  hora_fim: string        // "HH:MM:SS"
  cep: string
  rua: string
  numero: string
  complemento?: string
  quantidade_convidados: number
  descricao_evento?: string
  status?: string
}

/** Shape que o frontend usa nos formulários */
export type EventoForm = {
  nome: string
  data: string            // "DD/MM/YYYY"
  horarioInicio: string   // "HH:MM"
  horarioFim: string      // "HH:MM"
  cep: string
  rua: string
  numero: string
  semNumero: boolean
  complemento: string
  quantidade: string      // string para input controlado
  descricao: string
}

// ─── Conversores ──────────────────────────────────────────────────────────────

/** "DD/MM/YYYY" → "YYYY-MM-DD" */
function toISODate(brDate: string): string {
  const [day, month, year] = brDate.split("/")
  return `${year}-${month}-${day}`
}

/** "YYYY-MM-DD" → "DD/MM/YYYY" */
function toBRDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-")
  return `${day}/${month}/${year}`
}

/** "HH:MM:SS" → "HH:MM" */
function toShortTime(time: string): string {
  return time.slice(0, 5)
}

/** "HH:MM" → "HH:MM:SS" */
function toFullTime(time: string): string {
  return time.length === 5 ? `${time}:00` : time
}

/** EventoAPI → EventoForm  (para preencher o formulário de edição) */
export function apiToForm(evento: EventoAPI): EventoForm {
  return {
    nome: evento.nome,
    data: toBRDate(evento.data),
    horarioInicio: toShortTime(evento.hora_inicio),
    horarioFim: toShortTime(evento.hora_fim),
    cep: evento.cep,
    rua: evento.rua,
    numero: evento.numero ?? "",
    semNumero: !evento.numero,
    complemento: evento.complemento ?? "",
    quantidade: String(evento.quantidade_convidados),
    descricao: evento.descricao_evento ?? "",
  }
}

/** EventoForm → payload para POST / PATCH */
function formToPayload(form: EventoForm): Partial<EventoAPI> {
  return {
    nome: form.nome,
    data: toISODate(form.data),
    hora_inicio: toFullTime(form.horarioInicio),
    hora_fim: toFullTime(form.horarioFim),
    cep: form.cep,
    rua: form.rua,
    numero: form.semNumero ? "" : form.numero,
    complemento: form.complemento,
    quantidade_convidados: Number(form.quantidade),
    descricao_evento: form.descricao,
  }
}

// ─── Chamadas de API ──────────────────────────────────────────────────────────

/** Lista todos os eventos do cliente autenticado */
export async function fetchEventos(): Promise<EventoAPI[]> {
  const { data } = await api.get("/eventos/")
  // Suporta resposta paginada { count, results: [...] } e array direto
  return Array.isArray(data) ? data : (data.results ?? [])
}

/** Busca um evento específico por ID */
export async function fetchEvento(id: number): Promise<EventoAPI> {
  const { data } = await api.get<EventoAPI>(`/eventos/${id}/`)
  return data
}

/** Cria um novo evento — backend preenche `cliente` automaticamente via perform_create */
export async function createEvento(form: EventoForm): Promise<EventoAPI> {
  const payload = formToPayload(form)
  console.log("[createEvento] payload enviado:", payload)
  const { data } = await api.post<EventoAPI>("/eventos/", payload)
  return data
}

/** Atualiza parcialmente um evento */
export async function updateEvento(id: number, form: EventoForm): Promise<EventoAPI> {
  const payload = formToPayload(form)
  const { data } = await api.patch<EventoAPI>(`/eventos/${id}/`, payload)
  return data
}

/** Remove um evento */
export async function deleteEvento(id: number): Promise<void> {
  await api.delete(`/eventos/${id}/`)
}