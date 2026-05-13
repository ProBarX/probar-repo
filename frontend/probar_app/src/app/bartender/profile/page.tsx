"use client"

import { useEffect, useState } from "react"
import { api } from "@/services/api"
import { BartenderProfileView, type BartenderProfile } from "@/components/bartender/BartenderProfileView"
import { resolveMediaUrl } from "@/lib/media-url"

function formatDate(iso: string) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

export default function BartenderProfilePage() {
  const [profile, setProfile] = useState<BartenderProfile | null>(null)

  useEffect(() => {
    api.get("/bartenders/me/").then(({ data }) => {
      setProfile({
        id: data.id,
        nome: data.nome ?? "",
        email: data.email ?? "",
        data_nascimento: data.data_nascimento ?? "",
        foto_perfil: resolveMediaUrl(data.foto_perfil),
        membro_desde: formatDate(data.criado_em),
        especialidades: data.especialidades ?? "",
        anos_experiencia: data.anos_experiencia ?? null,
        descricao_profissional: data.descricao_profissional ?? "",
        valor_hora: data.valor_hora ?? null,
        media_avaliacoes: data.media_avaliacoes ?? 0,
        total_avaliacoes: data.total_avaliacoes ?? 0,
        cep: data.cep ?? "",
        rua: data.rua ?? "",
        bairro: data.bairro ?? "",
        numero: data.numero ?? "",
        drinks: (data.drinks ?? []).map((d: { id: number; nome: string; foto: string | null }) => ({
          id: d.id,
          nome: d.nome,
          preview: resolveMediaUrl(d.foto),
        })),
      })
    })
  }, [])

  if (!profile) {
    return (
      <p style={{ color: "#888", textAlign: "center", padding: "40px 0" }}>
        Carregando perfil...
      </p>
    )
  }

  return (
    <BartenderProfileView
      profile={profile}
      onUpdate={(updated) => setProfile((prev) => (prev ? { ...prev, ...updated } : prev))}
    />
  )
}
