export interface User {
    id?: number
    name: string
    email: string
    password?: string
    tipo: string
    criado_em?: string
}

export type EventStatus = "Em andamento" | "Confirmado" | "Finalizado" | "Cancelado"

export interface Event {
    id?: number
    nome: string
    data: string
    status?: string
    [key: string]: unknown
}

export interface ApiErrorResponse {
    detail?: string
    erro?: string
    [key: string]: unknown
}

export interface ApiError {
    response?: {
        data?: ApiErrorResponse
        status?: number
    }
    message?: string
}
