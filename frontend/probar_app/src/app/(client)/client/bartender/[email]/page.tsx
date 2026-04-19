"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/services/api"
import { BartenderDetailView, type BartenderDetail } from "@/components/client/bartender/BartenderDetailView"

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
    const emailDecoded = decodeURIComponent(email)

    api.get<BartenderDetail[] | { results: BartenderDetail[] }>("/bartenders/")
      .then(({ data }) => {
        const list = "results" in data ? data.results : data
        const found = list.find((b) => b.email === emailDecoded)

        if (found) {
          setBartender(found)
        } else {
          setError("Bartender não encontrado.")
        }
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