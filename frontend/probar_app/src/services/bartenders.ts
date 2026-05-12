import { api } from "./api"

export type Drink = {
  id: number
  nome: string
  foto: string | null
}

export type Bartender = {
  user_id: number
  email: string
  nome: string
  valor_hora: number
  especialidades: string
  foto_perfil: string | null
  anos_experiencia: number
  media_avaliacoes: number
  total_avaliacoes: number
  descricao_profissional?: string
  drinks?: Drink[]
}

export type BartenderDetail = Bartender & {
  descricao_profissional: string
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
      results: data,
    }
  }

  return {
    count: data.count,
    next: data.next,
    results: data.results ?? [],
  }
}

export async function fetchBartendersPage(url = "/bartenders/") {
  const { data } = await api.get<Bartender[] | PaginatedResponse<Bartender>>(url)
  return normalizePage(data)
}

export async function fetchBartenderById(id: string | number) {
  const { data } = await api.get<BartenderDetail>(`/bartenders/${id}/`)
  return data
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
