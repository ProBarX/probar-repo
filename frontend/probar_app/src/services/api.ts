import axios from "axios"

export const api = axios.create({
baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api/v1",
headers: {
    "Content-Type": "application/json"
}
})

api.interceptors.response.use(
(response) => response,
(error) => {
    console.error("Erro da API:", error.response?.data)
    return Promise.reject(error)
}
)