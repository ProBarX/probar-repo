"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { CompleteBartenderRegistrationForm } from "@/components/bartender/CompleteBartenderRegistrationForm"
import { kaushan } from "@/fonts"
import { api } from "@/services/api"

type BartenderProfile = {
  data_nascimento?: string | null
  anos_experiencia?: number | null
  descricao_profissional?: string | null
  valor_hora?: string | number | null
  drinks?: Array<{
    id?: number
    nome?: string | null
    foto?: string | null
  }> | null
  cep?: string | null
  rua?: string | null
  bairro?: string | null
  numero?: string | null
}

function isProfileComplete(profile: BartenderProfile) {
  const valorHora = Number(String(profile.valor_hora ?? "").replace(",", "."))

  return Boolean(
    profile.data_nascimento &&
      profile.anos_experiencia &&
      profile.descricao_profissional &&
      valorHora > 0 &&
      profile.cep &&
      profile.rua &&
      profile.bairro &&
      profile.numero
  )
}

export default function BartenderCompletePage() {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<BartenderProfile | null>(null)

  useEffect(() => {
    async function checkBartenderData() {
      try {
        const res = await api.get<BartenderProfile>("/bartenders/me/")
        const bartender = res.data
        setProfile(bartender)

        if (isProfileComplete(bartender)) {
          router.push("/bartender/home")
        } else {
          setShowForm(true)
        }
      } catch (error: unknown) {
        const response = error && typeof error === "object" && "response" in error
          ? (error as { response?: { data?: unknown } }).response
          : undefined

        console.error("Erro ao buscar bartender:", response?.data)
        setShowForm(true)
      } finally {
        setLoading(false)
      }
    }

    checkBartenderData()
  }, [router])

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#f5f5f5",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p>Carregando...</p>
      </div>
    )
  }

  if (!showForm) {
    return null
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f5f5f5",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <h1
          className={kaushan.className}
          style={{ fontSize: "32px", color: "#F5C518", margin: 0 }}
        >
          ProBar
        </h1>
        <p style={{ color: "#666", margin: "4px 0 0" }}>
          Complete seu cadastro para continuar
        </p>
      </div>

      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "12px",
          padding: "40px 32px",
          width: "100%",
          maxWidth: "460px",
          boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
        }}
      >
        <CompleteBartenderRegistrationForm initialProfile={profile} />
      </div>
    </div>
  )
}
