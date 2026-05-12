"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { BartenderDetailView, type BartenderDetail } from "@/components/client/bartender/BartenderDetailView"
import { fetchBartenderByIdentifier } from "@/services/bartenders"

type Props = {
  params: Promise<{ email: string }>
}

export default function BartenderDetailPage({ params }: Props) {
  const { email } = use(params)
  const router = useRouter()
  const [bartender, setBartender] = useState<BartenderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const identifier = decodeURIComponent(email)

    fetchBartenderByIdentifier(identifier)
      .then((found) => {
        setBartender(found)
        if (!found) setError("Bartender não encontrado.")
      })
      .catch(() => setError("Não foi possível carregar o bartender."))
      .finally(() => setLoading(false))
  }, [email])

  if (loading) {
    return (
      <p style={{ color: "#888", textAlign: "center", padding: "60px 0" }}>
        Carregando...
      </p>
    )
  }

  if (error || !bartender) {
    return (
      <p style={{ color: "#e53e3e", textAlign: "center", padding: "60px 0" }}>
        {error ?? "Bartender não encontrado."}
      </p>
    )
  }

  return (
    <BartenderDetailView
      bartender={bartender}
      onBack={() => router.back()}
    />
  )
}
