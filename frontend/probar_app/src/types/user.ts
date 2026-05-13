export interface User {
    id?: number
    name: string
    email: string
    password?: string
    tipo: string
    criado_em?: string
}

// Status dos eventos
export type EventStatus = "Concluído" | "Em andamento" | "Cancelado"

// Tipo para eventos retornados pela API
export interface Event {
    id?: number
    nome: string
    data: string
    status: EventStatus
    [key: string]: unknown // para aceitar outros campos da API
}

// Tipo do erro retornado pelo axios com a resposta do Django
export interface ApiErrorResponse {
    detail?: string
    [key: string]: string | string[] | undefined
}

export interface ApiError {
    response?: {
        data?: ApiErrorResponse
        status?: number
    }
    message?: string
}