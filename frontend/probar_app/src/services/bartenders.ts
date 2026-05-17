import { api } from "./api"
import { resolveMediaUrl } from "@/lib/media-url"

export type Drink = {
  id: number
  nome: string
  foto: string | null
}

export type Bartender = {
  user_id: number
  email: string
  nome: string
  valor_hora: number | string
  especialidades: string
  foto_perfil: string | null
  anos_experiencia: number | null
  media_avaliacoes: number
  total_avaliacoes: number
  descricao_profissional?: string | null
  drinks?: Drink[]
}

export type BartenderDetail = Bartender & {
  descricao_profissional: string | null
  drinks: Drink[]
}

type PaginatedResponse<T> = {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export type BartenderPage = {
  count: number
  next: string | null
  results: Bartender[]
}

function normalizePage(data: Bartender[] | PaginatedResponse<Bartender>): BartenderPage {
  if (Array.isArray(data)) {
    return {
      count: data.length,
      next: null,
      results: data.map(normalizeBartenderMedia),
    }
  }

  return {
    count: data.count,
    next: data.next,
    results: (data.results ?? []).map(normalizeBartenderMedia),
  }
}

function normalizeDrinkMedia(drink: Drink): Drink {
  return {
    ...drink,
    foto: resolveMediaUrl(drink.foto),
  }
}

function normalizeBartenderMedia<T extends Bartender>(bartender: T): T {
  return {
    ...bartender,
    foto_perfil: resolveMediaUrl(bartender.foto_perfil),
    drinks: bartender.drinks?.map(normalizeDrinkMedia),
  }
}

export async function fetchBartendersPage(url = "/bartenders/") {
  const { data } = await api.get<Bartender[] | PaginatedResponse<Bartender>>(url)
  return normalizePage(data)
}

export async function fetchBartenderById(id: string | number) {
  const { data } = await api.get<BartenderDetail>(`/bartenders/${id}/`)
  return normalizeBartenderMedia(data)
}

export async function findBartenderByEmail(email: string) {
  let nextUrl: string | null = "/bartenders/"

  while (nextUrl) {
    const page = await fetchBartendersPage(nextUrl)
    const found = page.results.find((bartender) => bartender.email === email)

    if (found) {
      return found as BartenderDetail
    }

    nextUrl = page.next
  }

  return null
}

export async function fetchBartenderByIdentifier(identifier: string) {
  if (/^\d+$/.test(identifier)) {
    return fetchBartenderById(identifier)
  }

  return findBartenderByEmail(identifier)
}
