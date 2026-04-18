"use client"

import { useRouter } from "next/navigation"
import { BartenderDetailView, type BartenderDetail } from "@/components/client/bartender/BartenderDetailView"

// ─── Mock estático ────────────────────────────────────────────────────────────
// Futuramente: remover esse mock e buscar via api.get(`/bartenders/${params.email}`)
const MOCK_BARTENDER: BartenderDetail = {
  email: "fulano@probar.com",
  nome: "Fulano",
  especialidades: "Tradicional",
  valor_hora: 600,
  rating: 4.5,
  total_avaliacoes: 180,
  descricao:
    "Especialista em coquetéis clássicos com mais de 8 anos de experiência. Domina técnicas tradicionais de preparo de drinks e atende eventos de todos os portes.",
  foto_perfil: "/52063af3-9940-4248-bf16-f32b0b4f68b0.png",
  drinks: [
    { nome: "Caipirinha", imagem: null },
    { nome: "Mojito", imagem: null },
    { nome: "Negroni", imagem: null },
  ],
}
// ─────────────────────────────────────────────────────────────────────────────

type Props = {
  params: { email: string }
}

export default function BartenderDetailPage({ params }: Props) {
  const router = useRouter()

  // TODO (quando o backend estiver pronto):
  // const [bartender, setBartender] = useState<BartenderDetail | null>(null)
  // useEffect(() => {
  //   api.get<BartenderDetail>(`/bartenders/${decodeURIComponent(params.email)}/`)
  //     .then(({ data }) => setBartender(data))
  // }, [params.email])

  const bartender = MOCK_BARTENDER // trocar por estado quando integrar

  return (
    <BartenderDetailView
      bartender={bartender}
      onBack={() => router.back()}
    />
  )
}