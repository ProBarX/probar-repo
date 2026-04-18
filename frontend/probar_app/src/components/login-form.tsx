"use client"

import Link from "next/link"
import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { useRouter } from "next/navigation"
import { GoogleLogin } from "@react-oauth/google"
import RoleSelector from "@/components/RoleSelector"

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const [googleIdToken, setGoogleIdToken] = useState<string | null>(null)
  const [showTipoModal, setShowTipoModal] = useState(false)
  const [showGoogleModal, setShowGoogleModal] = useState(false)
  const [selectedTipo, setSelectedTipo] = useState<"cliente" | "bartender" | null>(null)
  const [googleError, setGoogleError] = useState<string | null>(null)

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

  const inputClass =
    "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FFC105] focus:border-transparent"

  const redirectByRole: Record<'cliente' | 'bartender', string> = {
    cliente: '/client/complete',
    bartender: '/bartender/complete',
  }

  // GoogleLogin é renderizado em um modal; onSuccess captura o id_token
  function handleGoogleSuccess(res: any) {
    const idToken = (res as any)?.credential
    if (!idToken) {
      setGoogleError("Não foi possível obter credencial do Google.")
      return
    }
    setGoogleError(null)
    setGoogleIdToken(idToken)
    setShowGoogleModal(false)
    setShowTipoModal(true)
  }

  function handleGoogleFailure() {
    setGoogleError("Erro ao autenticar com Google.")
    setShowGoogleModal(false)
  }

  async function handleConfirmTipo() {
    if (!googleIdToken || !selectedTipo) {
      setError("Credencial do Google ou tipo ausente.")
      return
    }

    setLoading(true)
    setError("")

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/google/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_token: googleIdToken, tipo_usuario: selectedTipo }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || "Erro ao autenticar no backend")
      }

      // salva tokens via rota interna que já existe
      await fetch("/api/auth/set-cookies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: data.access, refresh: data.refresh, tipo: data.tipo }),
      })

      // redireciona conforme tipo retornado pelo backend (mapeamento centralizado)
      const dest = redirectByRole[data.tipo as 'cliente' | 'bartender'] || '/'
      router.push(dest)
    } catch (err: any) {
      setError(err.message || "Erro ao autenticar")
    } finally {
      setLoading(false)
      setShowTipoModal(false)
      setGoogleIdToken(null)
      setSelectedTipo(null)
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
            className={inputClass}
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
              className={`${inputClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
        <button
          type="button"
          onClick={() => { setError(""); setGoogleError(null); setShowGoogleModal(true); }}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted"
          aria-label="Entrar com Google"
          disabled={loading}
        >
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

      {/* Modal: escolher tipo após receber id_token do Google */}
      {/* Modal para autenticar com Google */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4 text-center">Entrar com Google</h3>
            <div className="flex justify-center">
              <GoogleLogin onSuccess={handleGoogleSuccess} onError={handleGoogleFailure} />
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setShowGoogleModal(false)} className="px-3 py-2 rounded border">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {showTipoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4 text-center">Tipo de conta</h3>

            <div className="flex flex-col md:flex-row gap-2 mb-4">
              <RoleSelector
                role="cliente"
                title="Cliente"
                subtitle="Contratar bartenders"
                selected={selectedTipo === "cliente"}
                disabled={loading}
                onSelect={(r) => setSelectedTipo(r)}
              />

              <RoleSelector
                role="bartender"
                title="Bartender"
                subtitle="Oferecer serviços"
                selected={selectedTipo === "bartender"}
                disabled={loading}
                onSelect={(r) => setSelectedTipo(r)}
              />
            </div>

            {googleError && <p className="text-sm text-red-600">{googleError}</p>}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowTipoModal(false); setGoogleIdToken(null); setSelectedTipo(null); }}
                className="px-4 py-2 rounded border hover:shadow hover:-translate-y-0.5 transition"
                disabled={loading}
              >
                Cancelar
              </button>

              <button
                onClick={handleConfirmTipo}
                className="px-4 py-2 rounded bg-[#FFC105] font-semibold hover:shadow-md hover:-translate-y-0.5 transition disabled:opacity-60"
                disabled={loading || !selectedTipo}
              >
                {loading ? "Conectando..." : "Continuar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-center text-sm text-muted-foreground">
        {"Não tem login? "}
        <Link href="/register" className="font-semibold text-foreground hover:underline">
          Cadastre-se
        </Link>
      </p>
    </div>
  )
}
