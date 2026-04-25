"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

function FullScreenLoading({ message = "Entrando..." }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full flex items-center justify-center bg-[#FFC105] animate-pulse">
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

          // salva no servidor via rota interna
          await fetch("/api/auth/set-cookies", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: authData.access, refresh: authData.refresh, tipo: authData.tipo }),
          })

          // redirect direto para destino final
          const dest = authData.tipo === "cliente" ? "/client/complete" : "/bartender/complete"
          router.replace(dest)
          return
        }

        // usuário não existe: redireciona para página full-screen de escolha de tipo
        try {
          sessionStorage.setItem("google_id_token", token)
        } catch (e) {
          // ignore
        }
        router.replace("/auth/google/choose-type")
      } catch (e: any) {
        setError(e?.message || "Erro ao processar callback do Google")
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
