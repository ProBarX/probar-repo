"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { User } from "lucide-react"

const steps = [
  "Informações pessoais",
  "Experiência",
  "Endereço",
]

function formatCep(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

function formatDate(value: string) {
  const nums = value.replace(/\D/g, "").slice(0, 8)
  if (nums.length <= 2) return nums
  if (nums.length <= 4) return `${nums.slice(0, 2)}/${nums.slice(2)}`
  return `${nums.slice(0, 2)}/${nums.slice(2, 4)}/${nums.slice(4)}`
}

export function CompleteBartenderRegistrationForm() {
  const [step, setStep] = useState(1)
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dataNascimento, setDataNascimento] = useState("")
  const [anosExperiencia, setAnosExperiencia] = useState("")
  const [descricaoProfissional, setDescricaoProfissional] = useState("")
  const [especialidade, setEspecialidade] = useState("")
  const [cep, setCep] = useState("")
  const [rua, setRua] = useState("")
  const [bairro, setBairro] = useState("")
  const [numero, setNumero] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return
    setFile(selected)
    setPreview(URL.createObjectURL(selected))
  }

  function calcularIdade(dataNasc: string) {
    const nasc = new Date(dataNasc)
    const hoje = new Date()
    let idade = hoje.getFullYear() - nasc.getFullYear()
    const m = hoje.getMonth() - nasc.getMonth()
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--
    return idade
  }

  async function handleSubmit() {
    setError("")

    const [dia, mes, ano] = dataNascimento.split("/")
    const dataISO = `${ano}-${mes}-${dia}`

    if (calcularIdade(dataISO) < 18) {
      setError("Você precisa ter pelo menos 18 anos.")
      return
    }

    setLoading(true)

    try {
      const tokenRes = await fetch("/api/auth/get-token")
      const { token } = await tokenRes.json()

      const formData = new FormData()
      formData.append("data_nascimento", dataISO)
      if (file) formData.append("foto_perfil", file)
      formData.append("anos_experiencia", anosExperiencia)
      formData.append("descricao_profissional", descricaoProfissional)
      formData.append("especialidades", especialidade)
      formData.append("cep", cep)
      formData.append("rua", rua)
      formData.append("bairro", bairro)
      formData.append("numero", numero)

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/bartenders/me/`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      if (!res.ok) {
        setError("Erro ao salvar. Tente novamente.")
        return
      }

      const apiBase =
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        (process.env.NEXT_PUBLIC_API_URL
          ? `${process.env.NEXT_PUBLIC_API_URL}/api/v1`
          : "http://127.0.0.1:8000/api/v1")

      const onboardingRes = await fetch(`${apiBase}/stripe/onboarding/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (onboardingRes.ok) {
        const { url } = await onboardingRes.json()
        if (url) {
          window.location.href = url
          return
        }
      }

      router.push("/bartender/home")
    } catch (error) {
      console.error(error)
      setError("Erro ao conectar com o servidor.")
    } finally {
      setLoading(false)
    }
  }

  function renderStep() {
    if (step === 1) {
      return (
        <>
          <div className="flex flex-col items-center gap-3">
            <label className="text-sm font-semibold text-[#111]">Foto de perfil</label>
            <button
              type="button"
              onClick={() => document.getElementById("perfil-file")?.click()}
              className="w-24 h-24 rounded-full border border-[#D1D5DB] bg-[#F8F8F8] flex items-center justify-center overflow-hidden"
            >
              {preview ? (
                <img src={preview} alt="preview" className="w-full h-full object-cover" />
              ) : (
                <User size={32} color="#9CA3AF" />
              )}
            </button>
            <input id="perfil-file" type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            <span className="text-xs text-[#6B7280]">Clique aqui para adicionar uma foto ao seu perfil</span>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#111]">Data de nascimento</label>
            <input
              value={dataNascimento}
              onChange={(e) => setDataNascimento(formatDate(e.target.value))}
              placeholder="dd/mm/aaaa"
              className="w-full border border-[#D1D5DB] rounded-xl p-3 outline-none focus:border-[#F5C518]"
            />
          </div>
        </>
      )
    }

    if (step === 2) {
      return (
        <>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#111]">Anos de experiência</label>
            <input
              value={anosExperiencia}
              onChange={(e) => setAnosExperiencia(e.target.value.replace(/\D/g, ""))}
              placeholder="Ex: 5"
              className="w-full border border-[#D1D5DB] rounded-xl p-3 outline-none focus:border-[#F5C518]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#111]">Descrição profissional</label>
            <textarea
              value={descricaoProfissional}
              onChange={(e) => setDescricaoProfissional(e.target.value)}
              placeholder="Conte um pouco sobre sua experiência, estilo de trabalho e diferenciais..."
              className="w-full min-h-[140px] border border-[#D1D5DB] rounded-xl p-3 outline-none focus:border-[#F5C518]"
            />
            <p className="text-xs text-[#6B7280]">Mínimo de 50 caracteres</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#111]">Especialidade</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: "showman", label: "Showman", subtitle: "Entretenimento e performance" },
                { value: "mixologista", label: "Mixologista", subtitle: "Drinks autorais e moléculas" },
                { value: "tradicional", label: "Tradicional", subtitle: "Drinks clássicos e atendimentos" },
                { value: "night_club", label: "Night Club", subtitle: "Alta demanda e velocidade" },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setEspecialidade(item.value)}
                  className={`rounded-2xl border p-3 text-left ${especialidade === item.value ? "border-[#F5C518] bg-yellow-50" : "border-[#D1D5DB] bg-white"}`}
                >
                  <span className="block font-medium">{item.label}</span>
                  <span className="text-xs text-[#6B7280]">{item.subtitle}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )
    }

    return (
      <>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-[#111]">CEP</label>
          <input
            value={cep}
            onChange={(e) => setCep(formatCep(e.target.value))}
            placeholder="00000-000"
            className="w-full border border-[#D1D5DB] rounded-xl p-3 outline-none focus:border-[#F5C518]"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-[#111]">Rua</label>
          <input
            value={rua}
            onChange={(e) => setRua(e.target.value)}
            placeholder="Nome da rua"
            className="w-full border border-[#D1D5DB] rounded-xl p-3 outline-none focus:border-[#F5C518]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#111]">Bairro</label>
            <input
              value={bairro}
              onChange={(e) => setBairro(e.target.value)}
              placeholder="Bairro"
              className="w-full border border-[#D1D5DB] rounded-xl p-3 outline-none focus:border-[#F5C518]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#111]">N°</label>
            <input
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="123"
              className="w-full border border-[#D1D5DB] rounded-xl p-3 outline-none focus:border-[#F5C518]"
            />
          </div>
        </div>
      </>
    )
  }

  function handleNext() {
    setError("")

    if (step === 1) {
      if (!dataNascimento || dataNascimento.length < 10) {
        setError("Informe sua data de nascimento.")
        return
      }
    }

    if (step === 2) {
      if (!anosExperiencia) {
        setError("Informe os anos de experiência.")
        return
      }
      if (descricaoProfissional.length < 50) {
        setError("A descrição deve ter pelo menos 50 caracteres.")
        return
      }
      if (!especialidade) {
        setError("Selecione sua especialidade.")
        return
      }
    }

    if (step < 3) {
      setStep(step + 1)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-6">
      <div className="w-full max-w-[520px] space-y-8">
        <div className="space-y-3 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#F5C518]">ProBar</p>
          <h1 className="text-3xl font-bold text-[#111827]">Complete seu perfil profissional</h1>
          <p className="text-sm text-[#6B7280]">Adicione suas informações para finalizar seu cadastro de bartender.</p>
        </div>

        <div className="rounded-[32px] border border-[#E5E7EB] bg-white p-8 shadow-[0px_24px_80px_rgba(15,23,42,0.08)]">
          <div className="mb-8 relative px-4">
            <div className="absolute left-0 right-0 top-1/2 h-[2px] bg-[#E5E7EB] translate-y-1/2"></div>
            <div className="relative flex items-center justify-between">
              {steps.map((label, index) => {
                const stepNumber = index + 1
                const isActive = stepNumber === step
                return (
                  <div key={label} className="flex flex-col items-center gap-2 z-10">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold ${isActive ? "bg-[#F5C518] text-black" : "bg-[#E5E7EB] text-[#6B7280]"}`}>
                      {stepNumber}
                    </div>
                    <span className="text-xs text-[#6B7280]">{label}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[#111827]">{steps[step - 1]}</h2>
              <p className="mt-2 text-sm text-[#6B7280]">
                {step === 1 && 'Adicione sua foto e informações básicas'}
                {step === 2 && 'Fale sobre sua experiência'}
                {step === 3 && 'Informe seu endereço de atuação'}
              </p>
            </div>

            {renderStep()}

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setStep(Math.max(1, step - 1))}
                disabled={step === 1 || loading}
                className="w-full rounded-[12px] border border-[#E5E7EB] bg-white px-6 py-3 text-sm font-semibold text-[#111827] disabled:opacity-50"
              >
                ← Voltar
              </button>
              {step < 3 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="w-full rounded-[12px] bg-[#F5C518] px-6 py-3 text-sm font-semibold text-black"
                >
                  Próximo →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full rounded-[12px] bg-[#F5C518] px-6 py-3 text-sm font-semibold text-black disabled:opacity-50"
                >
                  {loading ? "Concluindo..." : "Concluir cadastro →"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
