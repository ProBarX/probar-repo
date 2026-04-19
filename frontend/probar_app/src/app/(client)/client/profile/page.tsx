"use client"

import { ProfileView, type ClientProfile } from "@/components/client/profile/ProfileView"

// ─── Mock estático ────────────────────────────────────────────────────────────
// Futuramente: remover e buscar via api.get("/clientes/me/")
const MOCK_PROFILE: ClientProfile = {
  nome: "Antônio Félix",
  email: "toinhofelix@gmail.com",
  data_nascimento: "20/06/2006",
  membro_desde: "11/03/2026",
  total_eventos: 2,
  eventos: [
    { nome: "Festa de aniversário", data: "15 Mar 2025", status: "Concluído" },
    { nome: "Happy Hour",           data: "28 Fev 2026", status: "Concluído" },
    { nome: "Casamento",            data: "10 Abr 2026", status: "Em andamento" },
  ],
}
// ─────────────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  // TODO (quando o backend estiver pronto):
  // const [profile, setProfile] = useState<ClientProfile | null>(null)
  // useEffect(() => {
  //   api.get<ClientProfile>("/clientes/me/")
  //     .then(({ data }) => setProfile(data))
  // }, [])

  return <ProfileView profile={MOCK_PROFILE} />
}