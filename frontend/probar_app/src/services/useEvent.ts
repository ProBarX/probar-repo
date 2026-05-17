import { api } from "@/services/api"

export type EventoAPI = {
  id: number
  cliente: number
  cliente_nome?: string
  nome: string
  data: string
  hora_inicio: string
  hora_fim: string
  cep: string
  rua: string
  numero: string
  complemento?: string
  quantidade_convidados: number
  descricao_evento?: string
  status?: string
}

export type EventoForm = {
  nome: string
  data: string
  horarioInicio: string
  horarioFim: string
  cep: string
  rua: string
  numero: string
  semNumero: boolean
  complemento: string
  quantidade: string
  descricao: string
}

export type EventoFormErrors = Partial<Record<keyof EventoForm, string>>

export type EventoStatusLabel = "Em andamento" | "Confirmado" | "Finalizado" | "Cancelado"

export const emptyEventoForm: EventoForm = {
  cep: "",
  rua: "",
  numero: "",
  semNumero: false,
  complemento: "",
  nome: "",
  quantidade: "",
  descricao: "",
  data: "",
  horarioInicio: "",
  horarioFim: "",
}

const eventoStatusLabels: Record<string, EventoStatusLabel> = {
  em_andamento: "Em andamento",
  "em andamento": "Em andamento",
  confirmado: "Confirmado",
  finalizado: "Finalizado",
  concluido: "Finalizado",
  cancelado: "Cancelado",
}

export function formatEventoStatus(status?: string | null): EventoStatusLabel {
  if (!status) return "Em andamento"

  const normalized = status
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .trim()

  return eventoStatusLabels[normalized] ?? "Em andamento"
}

export function hasEventoFormErrors(errors: EventoFormErrors) {
  return Object.keys(errors).length > 0
}

export function toISODate(value: string): string {
  const date = value.trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date

  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date)
  if (!match) return ""

  const [, day, month, year] = match
  return `${year}-${month}-${day}`
}

export function toBRDate(value: string): string {
  const date = value.trim()

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) return date

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return ""

  const [, year, month, day] = match
  return `${day}/${month}/${year}`
}

export function formDateToInput(brDate: string): string {
  return toISODate(brDate)
}

export function inputDateToForm(isoDate: string): string {
  return toBRDate(isoDate)
}

function toShortTime(time: string): string {
  return time.slice(0, 5)
}

function toFullTime(time: string): string {
  return time.length === 5 ? `${time}:00` : time
}

function isValidISODate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function isValidTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number)
  return hours * 60 + minutes
}

export function validateEventoForm(form: EventoForm): EventoFormErrors {
  const errors: EventoFormErrors = {}
  const isoDate = toISODate(form.data)
  const cepDigits = form.cep.replace(/\D/g, "")
  const convidados = Number(form.quantidade)

  if (!form.nome.trim()) {
    errors.nome = "Informe o nome do evento."
  }

  if (!isoDate || !isValidISODate(isoDate)) {
    errors.data = "Informe uma data valida."
  }

  if (!isValidTime(form.horarioInicio)) {
    errors.horarioInicio = "Informe o horario de inicio."
  }

  if (!isValidTime(form.horarioFim)) {
    errors.horarioFim = "Informe o horario de fim."
  }

  if (
    isValidTime(form.horarioInicio) &&
    isValidTime(form.horarioFim) &&
    timeToMinutes(form.horarioFim) <= timeToMinutes(form.horarioInicio)
  ) {
    errors.horarioFim = "O fim deve ser depois do inicio."
  }

  if (cepDigits.length !== 8) {
    errors.cep = "Informe um CEP com 8 digitos."
  }

  if (!form.rua.trim()) {
    errors.rua = "Informe a rua ou avenida."
  }

  if (!form.semNumero && !form.numero.trim()) {
    errors.numero = "Informe o numero ou marque sem numero."
  }

  if (!Number.isInteger(convidados) || convidados < 1) {
    errors.quantidade = "Informe a quantidade de pessoas."
  }

  return errors
}

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

function formToPayload(form: EventoForm): Partial<EventoAPI> {
  return {
    nome: form.nome.trim(),
    data: toISODate(form.data),
    hora_inicio: toFullTime(form.horarioInicio),
    hora_fim: toFullTime(form.horarioFim),
    cep: form.cep.replace(/\D/g, ""),
    rua: form.rua.trim(),
    numero: form.semNumero ? "" : form.numero.trim(),
    complemento: form.complemento.trim(),
    quantidade_convidados: Number(form.quantidade),
    descricao_evento: form.descricao.trim(),
  }
}

export async function fetchEventos(): Promise<EventoAPI[]> {
  const { data } = await api.get<EventoAPI[] | { results?: EventoAPI[] }>("/eventos/")
  return Array.isArray(data) ? data : data.results ?? []
}

export async function fetchEvento(id: number): Promise<EventoAPI> {
  const { data } = await api.get<EventoAPI>(`/eventos/${id}/`)
  return data
}

export async function createEvento(form: EventoForm): Promise<EventoAPI> {
  const { data } = await api.post<EventoAPI>("/eventos/", formToPayload(form))
  return data
}

export async function updateEvento(id: number, form: EventoForm): Promise<EventoAPI> {
  const { data } = await api.patch<EventoAPI>(`/eventos/${id}/`, formToPayload(form))
  return data
}

export async function deleteEvento(id: number): Promise<void> {
  await api.delete(`/eventos/${id}/`)
}
