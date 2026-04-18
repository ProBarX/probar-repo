"use client"

import Link from "next/link"
import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { useRouter } from "next/navigation"

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin() {
    setLoading(true)
    setError("")

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/token/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      if (!res.ok) {
        setError("Email ou senha inválidos.")
        return
      }

      const data = await res.json()

      await fetch("/api/auth/set-cookies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: data.access,
          refresh: data.refresh,
          tipo: data.tipo,
        }),
      })

      if (data.tipo === "cliente") {
        const clienteRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/clientes/me/`, {
          headers: { Authorization: `Bearer ${data.access}` },
        })

        if (!clienteRes.ok) {
          router.push("/client/home")
          return
        }

        const cliente = await clienteRes.json()

        if (!cliente.data_nascimento) {
          router.push("/client/complete")
        } else {
          router.push("/client/home")
        }
        return
      }

      if (data.tipo === "bartender") {
        const bartenderRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/bartenders/me/`, {
          headers: { Authorization: `Bearer ${data.access}` },
        })

        if (!bartenderRes.ok) {
          router.push("/bartender/complete")
          return
        }

        const bartender = await bartenderRes.json()
        const needsComplete = !bartender.data_nascimento || !bartender.anos_experiencia || !bartender.descricao_profissional || !bartender.cep || !bartender.rua || !bartender.bairro || !bartender.numero

        if (needsComplete) {
          router.push("/bartender/complete")
        } else {
          router.push("/bartender/home")
        }
        return
      }

      router.push("/login")
    } catch {
      setError("Erro ao conectar com o servidor.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md space-y-8">
      <div className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            className="border p-2 rounded mb-2 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FFC105] w-full"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-foreground">
            Senha
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sua senha"
              className="border p-2 rounded mb-2 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FFC105] w-full pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          <div className="text-right">
            <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
              Esqueceu a senha?
            </Link>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-500 text-center">{error}</p>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="flex h-12 w-full items-center justify-center rounded-lg bg-[#FFC105] hover:bg-yellow-500 text-black font-semibold transition-colors disabled:opacity-60"
        >
          {loading ? "Entrando..." : "Login"}
        </button>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-[#ffffff] px-4 text-muted-foreground">Ou entre com</span>
        </div>
      </div>

      <div className="flex justify-center gap-4">
        <button type="button" className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted" aria-label="Entrar com Google">
          <span className="text-lg font-bold">G</span>
        </button>
        <button type="button" className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted" aria-label="Entrar com Apple">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
          </svg>
        </button>
        <button type="button" className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted" aria-label="Entrar com Facebook">
          <span className="text-lg font-bold">f</span>
        </button>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        {"Não tem login? "}
        <Link href="/register" className="font-semibold text-foreground hover:underline">
          Cadastre-se
        </Link>
      </p>
    </div>
  )
}
