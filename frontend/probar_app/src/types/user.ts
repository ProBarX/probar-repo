export interface User {
    id?: number
    name: string
    email: string
    password?: string
    tipo: string
    criado_em?: string
}

// Tipo do erro retornado pelo axios com a resposta do Django
export interface ApiError {
    response?: {
        data?: Record<string, string | string[]>
        status?: number
    }
    message?: string
}