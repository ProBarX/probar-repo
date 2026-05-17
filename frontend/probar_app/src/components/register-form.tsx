"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Eye, EyeOff, X } from "lucide-react"
import RoleSelector from "@/components/RoleSelector"
import { useRouter } from "next/navigation"
import { createUser } from "@/services/user"
import { apiAuth, setToken } from "@/services/api"
import { getActiveLegalDocuments, type LegalDocument } from "@/services/legal-documents"

type ApiErrorResponse = {
  response?: {
    data?: Record<string, unknown>
  }
}

function getFirstMessage(value: unknown) {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : null
  }

  return typeof value === "string" ? value : null
}

function getRegisterErrorMessage(error: unknown) {
  const data =
    error && typeof error === "object" && "response" in error
      ? (error as ApiErrorResponse).response?.data
      : undefined

  const emailMessage = getFirstMessage(data?.email)
  if (emailMessage) {
    if (emailMessage.toLowerCase().includes("already exists") || emailMessage.toLowerCase().includes("já existe")) {
      return "Este e-mail já está cadastrado. Faça login para continuar."
    }

    return emailMessage
  }

  const passwordMessage = getFirstMessage(data?.password)
  if (passwordMessage) return passwordMessage

  const detailMessage = getFirstMessage(data?.detail)
  if (detailMessage) return detailMessage

  const nonFieldMessage = getFirstMessage(data?.non_field_errors)
  if (nonFieldMessage) return nonFieldMessage

  return "Erro ao cadastrar. Confira os dados e tente novamente."
}

export function RegisterForm() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [tipo, setTipo] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [agreed, setAgreed] = useState(false)
  const [legalDocuments, setLegalDocuments] = useState<LegalDocument[]>([])
  const [legalDocumentsLoading, setLegalDocumentsLoading] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<LegalDocument | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadLegalDocuments() {
      if (!tipo) {
        setLegalDocuments([])
        setAgreed(false)
        return
      }

      setLegalDocumentsLoading(true)
      setError("")

      try {
        const documents = await getActiveLegalDocuments(tipo)
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
  }, [tipo])

  async function handleRegister() {
    if (loading) return
    setError("")

    try {
      if (!tipo) {
        setError("Selecione o tipo de conta.")
        return
      }
      if (!agreed) {
        setError("Aceite os termos para continuar.")
        return
      }
      if (legalDocuments.length < 2) {
        setError("Os termos e a política de privacidade ainda não estão disponíveis.")
        return
      }
      if (!name.trim()) {
        setError("Informe seu nome.")
        return
      }
      if (!email.trim()) {
        setError("Informe seu e-mail.")
        return
      }
      if (password !== confirmPassword) {
        setError("As senhas não coincidem.")
        return
      }

      setLoading(true)

      await createUser({
        name: name.trim(),
        email: email.trim(),
        password,
        tipo,
        documentos_legais_ids: legalDocuments.map((document) => document.id),
      })

      const { data: authData } = await apiAuth.post("/api/token/", { email: email.trim(), password })
      setToken(authData.access)

      await fetch("/api/auth/set-cookies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: authData.access,
          refresh: authData.refresh,
          tipo: authData.tipo,
        }),
      })

      setName("")
      setEmail("")
      setPassword("")
      setConfirmPassword("")
      setTipo("")
      setAgreed(false)
      setLegalDocuments([])

      if (authData.tipo === "cliente") {
        router.push("/client/complete")
        return
      }

      if (authData.tipo === "bartender") {
        router.push("/bartender/complete")
        return
      }

      router.push("/login")
    } catch (error) {
      setError(getRegisterErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F5C518] focus:border-transparent"
  const termsDocument = legalDocuments.find((document) => document.tipo === "termos_cliente" || document.tipo === "termos_bartender")
  const privacyDocument = legalDocuments.find((document) => document.tipo === "politica_privacidade")

  return (
    <div className="w-full space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Cadastro</h2>
        <p className="text-gray-500 text-sm mt-1">Crie uma conta</p>
      </div>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          handleRegister()
        }}
      >
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Tipo de conta</label>
          <div className="flex flex-col md:flex-row gap-2">
            <RoleSelector
              role="cliente"
              title="Cliente"
              subtitle="Contratar bartenders"
              selected={tipo === "cliente"}
              onSelect={(r) => setTipo(r)}
            />
            <RoleSelector
              role="bartender"
              title="Bartender"
              subtitle="Oferecer serviços"
              selected={tipo === "bartender"}
              onSelect={(r) => setTipo(r)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="name" className="text-sm font-medium text-gray-700">Nome</label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="José Alencar"
            className={inputClass}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium text-gray-700">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jose@email.com"
            className={inputClass}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium text-gray-700">Senha</label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Crie uma senha"
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
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">Confirmar Senha</label>
          <div className="relative">
            <input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirme sua senha"
              className={`${inputClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-start gap-2 text-xs text-gray-500">
          <input
            type="checkbox"
            id="terms"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            disabled={!tipo || legalDocumentsLoading || legalDocuments.length < 2}
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

        {error && (
          <p className="text-sm text-red-500 text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full h-10 rounded-lg bg-[#F5C518] hover:bg-yellow-400 text-black text-sm font-semibold transition-colors disabled:opacity-60"
        >
          {loading ? "Cadastrando..." : "Cadastrar"}
        </button>
      </form>

      <p className="text-center text-xs text-gray-500">
        Já tem uma conta?{" "}
        <Link href="/login" className="font-semibold text-gray-900 hover:underline">
          Faça login
        </Link>
      </p>

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
