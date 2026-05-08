"use client"

import { useEffect, useState } from "react"
import RoleSelector from "@/components/RoleSelector"
import { useRouter } from "next/navigation"

export default function ChooseTypePage() {
  const router = useRouter()
  const [idToken, setIdToken] = useState<string | null>(null)
  const [selectedTipo, setSelectedTipo] = useState<"cliente" | "bartender" | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const token = sessionStorage.getItem("google_id_token")
      if (token) {
        setIdToken(token)
        // Não remover ainda, remover após o envio bem-sucedido.
      } else {
        // Se não houver token, voltar para login (não deve acontecer)
        router.replace("/login")
      }
    } catch (e) {
      router.replace("/login")
    }
  }, [router])

  async function handleSubmit() {
    if (!idToken || !selectedTipo) {
      setError("Selecione um tipo de conta.")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/google/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_token: idToken, tipo_usuario: selectedTipo }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || "Erro ao autenticar")
      }

      await fetch("/api/auth/set-cookies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: data.access, refresh: data.refresh, tipo: data.tipo }),
      })

      try { sessionStorage.removeItem("google_id_token") } catch(e) {}

      // checar completude do perfil antes de redirecionar
      try {
        const access = data.access
        if (data.tipo === 'cliente') {
          const clienteRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/clientes/me/`, {
            headers: { Authorization: `Bearer ${access}` },
          })

          if (!clienteRes.ok) {
            router.replace('/client/complete')
            return
          }

          const cliente = await clienteRes.json()
          if (!cliente.data_nascimento) {
            router.replace('/client/complete')
          } else {
            router.replace('/client/home')
          }
          return
        }

        if (data.tipo === 'bartender') {
          const bartenderRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/bartenders/me/`, {
            headers: { Authorization: `Bearer ${access}` },
          })

          if (!bartenderRes.ok) {
            router.replace('/bartender/complete')
            return
          }

          const bartender = await bartenderRes.json()
          const needsComplete = !bartender.data_nascimento || !bartender.anos_experiencia || !bartender.descricao_profissional || !bartender.cep || !bartender.rua || !bartender.bairro || !bartender.numero
          if (needsComplete) {
            router.replace('/bartender/complete')
          } else {
            router.replace('/bartender/home')
          }
          return
        }

        router.replace('/')
      } catch (e) {
        router.replace('/')
      }
    } catch (e: any) {
      setError(e.message || "Erro ao criar conta")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
        <h2 className="text-xl font-semibold mb-4 text-center">Escolha o tipo de conta</h2>

        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <RoleSelector role="cliente" title="Cliente" subtitle="Contratar bartenders" selected={selectedTipo === "cliente"} onSelect={(r) => setSelectedTipo(r)} />
          <RoleSelector role="bartender" title="Bartender" subtitle="Oferecer serviços" selected={selectedTipo === "bartender"} onSelect={(r) => setSelectedTipo(r)} />
        </div>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        <div className="flex justify-end gap-2">
          <button onClick={() => router.replace("/login")} className="px-4 py-2 rounded border">Cancelar</button>
          <button onClick={handleSubmit} disabled={loading || !selectedTipo} className="px-4 py-2 rounded bg-[#FFC105] font-semibold disabled:opacity-60">{loading ? "Conectando..." : "Continuar"}</button>
        </div>
      </div>
    </div>
  )
}
