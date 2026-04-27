import axios from "axios"

let cachedToken: string | null = null

export function setToken(token: string) {
    cachedToken = token
}

export function clearTokenCache() {
    cachedToken = null
}

async function getToken(): Promise<string | null> {
    if (cachedToken) return cachedToken

    try {
        const res = await fetch("/api/auth/get-token")
        const data = await res.json()
        cachedToken = data.token ?? null
        return cachedToken
    } catch {
        return null
    }
}

export const api = axios.create({
    baseURL:
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        "http://127.0.0.1:8000/api/v1",
    headers: {
        "Content-Type": "application/json",
    },
})

api.interceptors.request.use(async (config) => {
    const token = await getToken()

    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }

    return config
})

api.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error("Erro da API:", error.response?.data)
        return Promise.reject(error)
    }
)
