import axios from "axios"

let cachedToken: string | null = null
let handlingUnauthorized = false

export function setToken(token: string) {
    cachedToken = token
}

export function clearTokenCache() {
    cachedToken = null
}

async function getToken(): Promise<string | null> {
    try {
        const res = await fetch("/api/auth/get-token", { cache: "no-store" })
        const data = await res.json()
        cachedToken = data.token ?? null
        return cachedToken
    } catch {
        return cachedToken
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

export const apiAuth = axios.create({
    baseURL:
        process.env.NEXT_PUBLIC_API_URL ||
        "http://127.0.0.1:8000",
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
        if (error.response?.status === 401) {
            clearTokenCache()

            if (typeof window !== "undefined" && !handlingUnauthorized) {
                handlingUnauthorized = true
                fetch("/api/auth/logout", { method: "POST" })
                    .catch(() => null)
                    .finally(() => {
                        if (window.location.pathname !== "/login") {
                            window.location.assign("/login")
                        }
                        handlingUnauthorized = false
                    })
            }
        }

        console.error("Erro da API:", error.response?.data)
        return Promise.reject(error)
    }
)
