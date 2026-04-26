"use client"

import { useEffect, useState } from "react"
import { api } from "@/services/api"
import { ProfileView, type ClientProfile } from "@/components/client/profile/ProfileView"

export default function ProfilePage() {
  const [profile, setProfile] = useState<ClientProfile | null>(null)

  useEffect(() => {
    Promise.all([
      api.get("/clientes/me/"),
      api.get("/eventos/"),
    ]).then(([{ data: cliente }, { data: eventosRaw }]) => {
      const rawData = cliente.data_nascimento // "20/02/2002"
      let dataISO = rawData
      if (rawData?.includes("/")) {
        const [dia, mes, ano] = rawData.split("/")
        dataISO = `${ano}-${mes}-${dia}`
      }
      const eventos = "results" in eventosRaw ? eventosRaw.results : eventosRaw

      setProfile({
        nome:            cliente.name,
        email:           cliente.email,
        data_nascimento: dataISO,
        membro_desde:    formatDate(cliente.criado_em),
        foto_perfil:     cliente.foto_perfil ?? null,
        total_eventos:   eventos.length,
        eventos: eventos.map((e: any) => ({
          nome:   e.nome,
          data:   formatDate(e.data),
          status: e.status,
        })),
      })
    })
  }, [])

  if (!profile) return <p style={{ color: "#888", textAlign: "center", padding: "40px 0" }}>Carregando perfil...</p>

  return (
    <ProfileView
      profile={profile}
      onUpdate={(updated) => setProfile((prev) => prev ? { ...prev, ...updated } : prev)}
    />
  )
}

function formatDate(iso: string) {
  if (!iso) return "—"
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
  })
}