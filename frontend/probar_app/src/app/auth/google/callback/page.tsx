"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { setToken } from "@/services/api"

function isClientComplete(cliente: { data_nascimento?: string | null } | null) {
  return !!cliente?.data_nascimento
}

function isBartenderComplete(bartender: {
  data_nascimento?: string | null
  anos_experiencia?: number | null
  descricao_profissional?: string | null
  cep?: string | null
  rua?: string | null
  bairro?: string | null
  numero?: string | null
} | null) {
  return !!(
    bartender?.data_nascimento &&
    bartender?.anos_experiencia &&
    bartender?.descricao_profissional &&
    bartender?.cep &&
    bartender?.rua &&
    bartender?.bairro &&
    bartender?.numero
  )
}

function FullScreenLoading({ message = "Entrando..." }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full flex items-center justify-center bg-[#F5C518] animate-pulse">
            <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold">{message}</h2>
          <p className="text-sm text-muted-foreground">Aguarde enquanto finalizamos sua autenticação.</p>
        </div>
      </div>
    </div>
  )
}

export default function GoogleCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(true)

  useEffect(() => {
    async function handleCallback() {
      try {
        const hash = window.location.hash || window.location.search || ""
        const params = new URLSearchParams(hash.replace(/^#/, ""))
        const idToken = params.get("id_token")
        const code = params.get("code")
        const err = params.get("error")

        if (err) {
          setError(err)
          setProcessing(false)
          return
        }

        const token = idToken || code
        if (!token) {
          setError("Nenhum token retornado pelo provedor Google.")
          setProcessing(false)
          return
        }

        // Tentativa de verificação e autenticação imediata no callback:
        // 1) Verifica se usuário existe
        // 2) Se existe, chama /api/auth/google/ e grava cookies via rota interna
        // 3) Se não existe, redireciona para a tela de escolha de tipo (modo full-page)

        const verifyRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/google/verify/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id_token: token }),
        })

        if (!verifyRes.ok) {
          const text = await verifyRes.text()
          setError("Erro ao verificar credencial: " + text)
          setProcessing(false)
          return
        }

        const verifyData = await verifyRes.json()
        if (verifyData.exists) {
          // autenticar direto
          const authRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/google/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id_token: token }),
          })

          const authData = await authRes.json()
          if (!authRes.ok) {
            setError(authData.detail || "Erro ao autenticar")
            setProcessing(false)
            return
          }

          setToken(authData.access)

          // salva no servidor via rota interna
          await fetch("/api/auth/set-cookies", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: authData.access, refresh: authData.refresh, tipo: authData.tipo }),
          })

          // redireciona conforme o onboarding realmente necessário
          if (authData.tipo === "cliente") {
            const clienteRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/clientes/me/`, {
              headers: { Authorization: `Bearer ${authData.access}` },
            })

            if (!clienteRes.ok) {
              router.replace("/client/complete")
              return
            }

            const cliente = await clienteRes.json()
            router.replace(isClientComplete(cliente) ? "/client/home" : "/client/complete")
            return
          }

          if (authData.tipo === "bartender") {
            const bartenderRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/bartenders/me/`, {
              headers: { Authorization: `Bearer ${authData.access}` },
            })

            if (!bartenderRes.ok) {
              router.replace("/bartender/complete")
              return
            }

            const bartender = await bartenderRes.json()
            router.replace(isBartenderComplete(bartender) ? "/bartender/home" : "/bartender/complete")
            return
          }

          router.replace("/")
          return
        }

        // usuário não existe: redireciona para página full-screen de escolha de tipo
        try {
          sessionStorage.setItem("google_id_token", token)
        } catch {
          // ignore
        }
        router.replace("/auth/google/choose-type")
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Erro ao processar callback do Google")
      } finally {
        setProcessing(false)
      }
    }

    handleCallback()
  }, [router])

  if (processing) return <FullScreenLoading message="Entrando..." />

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="p-8 text-center">
        {error ? (
          <>
            <h1 className="text-lg font-semibold">Erro no login com Google</h1>
            <p className="mt-2 text-sm text-red-600">{error}</p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold">Redirecionando...</h1>
            <p className="mt-2 text-sm text-muted-foreground">Você será redirecionado em instantes.</p>
          </>
        )}
      </div>
    </main>
  )
}
