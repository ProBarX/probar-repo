"use client"

import { useEffect, useState } from "react"
import RoleSelector from "@/components/RoleSelector"
import { useRouter } from "next/navigation"
import { X } from "lucide-react"
import { setToken } from "@/services/api"
import { getActiveLegalDocuments, type LegalDocument } from "@/services/legal-documents"

type BartenderProfileCompletion = {
  data_nascimento?: string | null
  anos_experiencia?: number | null
  descricao_profissional?: string | null
  valor_hora?: string | number | null
  cep?: string | null
  rua?: string | null
  bairro?: string | null
  numero?: string | null
}

function isBartenderProfileComplete(bartender: BartenderProfileCompletion) {
  const valorHora = Number(String(bartender.valor_hora ?? "").replace(",", "."))

  return Boolean(
    bartender.data_nascimento &&
      bartender.anos_experiencia &&
      bartender.descricao_profissional &&
      valorHora > 0 &&
      bartender.cep &&
      bartender.rua &&
      bartender.bairro &&
      bartender.numero
  )
}

export default function ChooseTypePage() {
  const router = useRouter()
  const [idToken, setIdToken] = useState<string | null>(null)
  const [selectedTipo, setSelectedTipo] = useState<"cliente" | "bartender" | null>(null)
  const [legalDocuments, setLegalDocuments] = useState<LegalDocument[]>([])
  const [legalDocumentsLoading, setLegalDocumentsLoading] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<LegalDocument | null>(null)
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const token = sessionStorage.getItem("google_id_token")
      if (token) {
        setIdToken(token)
      } else {
        router.replace("/login")
      }
    } catch {
      router.replace("/login")
    }
  }, [router])

  useEffect(() => {
    let cancelled = false

    async function loadLegalDocuments() {
      if (!selectedTipo) {
        setLegalDocuments([])
        setAgreed(false)
        return
      }

      setLegalDocumentsLoading(true)
      setError(null)

      try {
        const documents = await getActiveLegalDocuments(selectedTipo)
        if (!cancelled) {
          setLegalDocuments(documents)
          setAgreed(false)
        }
      } catch {
        if (!cancelled) {
          setLegalDocuments([])
          setError("Não foi possível carregar os termos e a política de privacidade.")
        }
      } finally {
        if (!cancelled) setLegalDocumentsLoading(false)
      }
    }

    loadLegalDocuments()

    return () => {
      cancelled = true
    }
  }, [selectedTipo])

  async function handleSubmit() {
    if (!idToken || !selectedTipo) {
      setError("Selecione um tipo de conta.")
      return
    }

    if (!agreed || legalDocuments.length < 2) {
      setError("Aceite os termos e a política de privacidade para continuar.")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/google/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_token: idToken,
          tipo_usuario: selectedTipo,
          documentos_legais_ids: legalDocuments.map((document) => document.id),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || "Erro ao autenticar")
      }

      setToken(data.access)

      await fetch("/api/auth/set-cookies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: data.access, refresh: data.refresh, tipo: data.tipo }),
      })

      try { sessionStorage.removeItem("google_id_token") } catch {}

      try {
        const access = data.access
        if (data.tipo === "cliente") {
          const clienteRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/clientes/me/`, {
            headers: { Authorization: `Bearer ${access}` },
          })

          if (!clienteRes.ok) {
            router.replace("/client/complete")
            return
          }

          const cliente = await clienteRes.json()
          router.replace(cliente.data_nascimento ? "/client/home" : "/client/complete")
          return
        }

        if (data.tipo === "bartender") {
          const bartenderRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/bartenders/me/`, {
            headers: { Authorization: `Bearer ${access}` },
          })

          if (!bartenderRes.ok) {
            router.replace("/bartender/complete")
            return
          }

          const bartender = await bartenderRes.json()
          router.replace(isBartenderProfileComplete(bartender) ? "/bartender/home" : "/bartender/complete")
          return
        }

        router.replace("/")
      } catch {
        router.replace("/")
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao criar conta")
    } finally {
      setLoading(false)
    }
  }

  const termsDocument = legalDocuments.find((document) => document.tipo === "termos_cliente" || document.tipo === "termos_bartender")
  const privacyDocument = legalDocuments.find((document) => document.tipo === "politica_privacidade")

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
        <h2 className="text-xl font-semibold mb-4 text-center">Escolha o tipo de conta</h2>

        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <RoleSelector role="cliente" title="Cliente" subtitle="Contratar bartenders" selected={selectedTipo === "cliente"} onSelect={(r) => setSelectedTipo(r)} />
          <RoleSelector role="bartender" title="Bartender" subtitle="Oferecer serviços" selected={selectedTipo === "bartender"} onSelect={(r) => setSelectedTipo(r)} />
        </div>

        <div className="mb-4 flex items-start gap-2 text-xs text-gray-500">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            disabled={!selectedTipo || legalDocumentsLoading || legalDocuments.length < 2}
            className="mt-0.5 accent-[#F5C518]"
          />
          <div>
            Li e concordo com os{" "}
            <button
              type="button"
              disabled={!termsDocument}
              onClick={() => termsDocument && setSelectedDocument(termsDocument)}
              className="font-semibold underline text-gray-700 disabled:cursor-not-allowed disabled:text-gray-400"
            >
              Termos e Condições
            </button>
            {" "}e a{" "}
            <button
              type="button"
              disabled={!privacyDocument}
              onClick={() => privacyDocument && setSelectedDocument(privacyDocument)}
              className="font-semibold underline text-gray-700 disabled:cursor-not-allowed disabled:text-gray-400"
            >
              Política de Privacidade
            </button>
            {legalDocumentsLoading && <span className="block mt-1">Carregando documentos legais...</span>}
          </div>
        </div>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        <div className="flex justify-end gap-2">
          <button onClick={() => router.replace("/login")} className="px-4 py-2 rounded border">Cancelar</button>
          <button
            onClick={handleSubmit}
            disabled={loading || !selectedTipo || !agreed}
            className="px-4 py-2 rounded bg-[#F5C518] font-semibold disabled:opacity-60"
          >
            {loading ? "Conectando..." : "Continuar"}
          </button>
        </div>
      </div>

      {selectedDocument && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900">{selectedDocument.titulo}</h3>
                <p className="text-xs text-gray-500">Versão {selectedDocument.versao}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDocument(null)}
                className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap px-5 py-4 text-sm leading-6 text-gray-700">
              {selectedDocument.conteudo}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
