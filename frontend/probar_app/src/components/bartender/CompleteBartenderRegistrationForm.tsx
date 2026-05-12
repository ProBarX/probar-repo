"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Camera, Trash2, User, Wine, X } from "lucide-react"

const steps = [
  {
    title: "Informações pessoais",
    description: "Adicione sua foto e informações básicas",
  },
  {
    title: "Experiência",
    description: "Fale sobre sua atuação profissional",
  },
  {
    title: "Serviços",
    description: "Informe seu valor por hora e seus drinks",
  },
  {
    title: "Endereço",
    description: "Informe seu endereço de atuação",
  },
]

type DrinkDraft = {
  id?: number
  nome: string
  file: File | null
  preview: string | null
}

type InitialBartenderProfile = {
  valor_hora?: string | number | null
  drinks?: Array<{
    id?: number
    nome?: string | null
    foto?: string | null
  }> | null
}

const specialties = [
  { value: "showman", label: "Showman", subtitle: "Entretenimento e performance" },
  { value: "mixologista", label: "Mixologista", subtitle: "Drinks autorais e técnicas avançadas" },
  { value: "tradicional", label: "Tradicional", subtitle: "Drinks clássicos e atendimento" },
  { value: "night_club", label: "Night Club", subtitle: "Alta demanda e velocidade" },
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

function calcularIdade(dataNasc: string) {
  const nasc = new Date(dataNasc)
  const hoje = new Date()
  let idade = hoje.getFullYear() - nasc.getFullYear()
  const m = hoje.getMonth() - nasc.getMonth()
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--
  return idade
}

function getDataISO(dataNascimento: string) {
  const [dia, mes, ano] = dataNascimento.split("/")
  if (!dia || !mes || !ano) return ""
  return `${ano}-${mes}-${dia}`
}

function normalizeValorHora(value: string) {
  const normalized = value.trim().replace(",", ".")
  const parsed = Number(normalized)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  return parsed.toFixed(2)
}

function normalizeDrinkName(value: string) {
  return value.trim().toLowerCase()
}

function createInitialDrinks(profile?: InitialBartenderProfile | null): DrinkDraft[] {
  const existingDrinks = profile?.drinks
    ?.map((drink) => ({
      id: drink.id,
      nome: drink.nome ?? "",
      file: null,
      preview: drink.foto ?? null,
    }))
    .filter((drink) => drink.nome.trim())

  return existingDrinks ?? []
}

const inputStyle: React.CSSProperties = {
  border: "1px solid #A7A7A7",
  borderRadius: "8px",
  padding: "10px 14px",
  fontSize: "14px",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
}

const labelStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: "500",
}

export function CompleteBartenderRegistrationForm({
  initialProfile,
}: {
  initialProfile?: InitialBartenderProfile | null
}) {
  const [step, setStep] = useState(1)
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dataNascimento, setDataNascimento] = useState("")
  const [anosExperiencia, setAnosExperiencia] = useState("")
  const [descricaoProfissional, setDescricaoProfissional] = useState("")
  const [especialidade, setEspecialidade] = useState("")
  const [valorHora, setValorHora] = useState(() => initialProfile?.valor_hora ? String(initialProfile.valor_hora).replace(".", ",") : "")
  const [drinks, setDrinks] = useState<DrinkDraft[]>(() => createInitialDrinks(initialProfile))
  const [cep, setCep] = useState("")
  const [rua, setRua] = useState("")
  const [bairro, setBairro] = useState("")
  const [numero, setNumero] = useState("")
  const [error, setError] = useState("")
  const [drinkModalOpen, setDrinkModalOpen] = useState(false)
  const [editingDrinkIndex, setEditingDrinkIndex] = useState<number | null>(null)
  const [modalDrinkName, setModalDrinkName] = useState("")
  const [modalDrinkFile, setModalDrinkFile] = useState<File | null>(null)
  const [modalDrinkPreview, setModalDrinkPreview] = useState<string | null>(null)
  const [modalDrinkError, setModalDrinkError] = useState("")
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const drinkFileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const currentStep = steps[step - 1]

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return
    setFile(selected)
    setPreview(URL.createObjectURL(selected))
  }

  function openDrinkModal(index?: number) {
    if (index === undefined && drinks.length >= 6) {
      setError("Você já cadastrou o máximo de 6 drinks.")
      return
    }

    const drink = index !== undefined ? drinks[index] : null

    setEditingDrinkIndex(index ?? null)
    setModalDrinkName(drink?.nome ?? "")
    setModalDrinkFile(null)
    setModalDrinkPreview(drink?.preview ?? null)
    setModalDrinkError("")
    setDrinkModalOpen(true)
  }

  function closeDrinkModal() {
    setDrinkModalOpen(false)
    setEditingDrinkIndex(null)
    setModalDrinkName("")
    setModalDrinkFile(null)
    setModalDrinkPreview(null)
    setModalDrinkError("")
  }

  function handleDrinkModalImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return

    setModalDrinkFile(selected)
    setModalDrinkPreview(URL.createObjectURL(selected))
  }

  function removeDrink(index: number) {
    setDrinks((current) => current.filter((_, currentIndex) => currentIndex !== index))
  }

  function saveDrinkModal() {
    const nome = modalDrinkName.trim()

    if (!nome) {
      setModalDrinkError("Informe o nome do drink.")
      return
    }

    const hasDuplicate = drinks.some((drink, index) => {
      if (editingDrinkIndex === index) return false
      return normalizeDrinkName(drink.nome) === normalizeDrinkName(nome)
    })

    if (hasDuplicate) {
      setModalDrinkError("Este drink já foi cadastrado.")
      return
    }

    const drinkData = {
      nome,
      file: modalDrinkFile,
      preview: modalDrinkPreview,
    }

    setDrinks((current) => {
      if (editingDrinkIndex === null) {
        return [...current, drinkData]
      }

      return current.map((drink, index) =>
        index === editingDrinkIndex ? { ...drink, ...drinkData } : drink
      )
    })
    closeDrinkModal()
  }

  function validatePersonalData() {
    if (!dataNascimento || dataNascimento.length < 10) {
      setError("Informe sua data de nascimento.")
      return false
    }

    const dataISO = getDataISO(dataNascimento)

    if (!dataISO || Number.isNaN(new Date(dataISO).getTime())) {
      setError("Informe uma data de nascimento válida.")
      return false
    }

    if (calcularIdade(dataISO) < 18) {
      setError("Você precisa ter pelo menos 18 anos.")
      return false
    }

    return true
  }

  function validateExperienceData() {
    if (!anosExperiencia) {
      setError("Informe os anos de experiência.")
      return false
    }

    if (descricaoProfissional.trim().length < 50) {
      setError("A descrição deve ter pelo menos 50 caracteres.")
      return false
    }

    if (!especialidade) {
      setError("Selecione sua especialidade.")
      return false
    }

    return true
  }

  function validateAddressData() {
    if (cep.length < 9 || !rua.trim() || !bairro.trim() || !numero.trim()) {
      setError("Preencha todos os dados do endereço.")
      return false
    }

    return true
  }

  function validateServiceData() {
    if (!normalizeValorHora(valorHora)) {
      setError("Informe um valor por hora válido.")
      return false
    }

    const drinkNames = drinks.map((drink) => drink.nome.trim()).filter(Boolean)

    const uniqueDrinkNames = new Set(drinkNames.map(normalizeDrinkName))

    if (uniqueDrinkNames.size !== drinkNames.length) {
      setError("Informe drinks diferentes.")
      return false
    }

    return true
  }

  function handleNext() {
    setError("")

    if (step === 1 && !validatePersonalData()) return
    if (step === 2 && !validateExperienceData()) return
    if (step === 3 && !validateServiceData()) return

    setStep((current) => Math.min(steps.length, current + 1))
  }

  async function handleSubmit() {
    setError("")

    if (!validatePersonalData() || !validateExperienceData() || !validateServiceData() || !validateAddressData()) {
      return
    }

    setLoading(true)

    try {
      const tokenRes = await fetch("/api/auth/get-token")
      const { token } = await tokenRes.json()

      if (!token) {
        setError("Sua sessão expirou. Faça login novamente para concluir o cadastro.")
        router.push("/login")
        return
      }

      const dataISO = getDataISO(dataNascimento)
      const valorHoraNormalizado = normalizeValorHora(valorHora)
      const apiBase =
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        (process.env.NEXT_PUBLIC_API_URL
          ? `${process.env.NEXT_PUBLIC_API_URL}/api/v1`
          : "http://127.0.0.1:8000/api/v1")

      const formData = new FormData()
      formData.append("data_nascimento", dataISO)
      if (file) formData.append("foto_perfil", file)
      formData.append("anos_experiencia", anosExperiencia)
      formData.append("descricao_profissional", descricaoProfissional.trim())
      if (valorHoraNormalizado) formData.append("valor_hora", valorHoraNormalizado)
      formData.append("especialidades", especialidade)
      formData.append("cep", cep)
      formData.append("rua", rua.trim())
      formData.append("bairro", bairro.trim())
      formData.append("numero", numero.trim())

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

      for (const drink of drinks) {
        const nome = drink.nome.trim()

        if (!nome) {
          continue
        }

        const drinkFormData = new FormData()
        drinkFormData.append("nome", nome)
        if (drink.file) drinkFormData.append("foto", drink.file)

        const initialDrink = initialProfile?.drinks?.find((item) => item.id === drink.id)
        const isExistingDrinkUnchanged =
          drink.id &&
          !drink.file &&
          normalizeDrinkName(initialDrink?.nome ?? "") === normalizeDrinkName(nome)

        if (isExistingDrinkUnchanged) {
          continue
        }

        const drinkRes = await fetch(`${apiBase}/drinks/${drink.id ? `${drink.id}/` : ""}`, {
          method: drink.id ? "PATCH" : "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: drinkFormData,
        })

        if (!drinkRes.ok) {
          setError("Erro ao salvar os drinks. Tente novamente.")
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
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
            <label style={labelStyle}>Foto de perfil</label>
            <div
              onClick={() => inputRef.current?.click()}
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "50%",
                border: "2px solid #A7A7A7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                overflow: "hidden",
                backgroundColor: "#f5f5f5",
              }}
            >
              {preview ? (
                <div
                  aria-label="Pré-visualização da foto de perfil"
                  role="img"
                  style={{
                    width: "100%",
                    height: "100%",
                    backgroundImage: `url(${preview})`,
                    backgroundPosition: "center",
                    backgroundSize: "cover",
                  }}
                />
              ) : (
                <User size={36} color="#A7A7A7" />
              )}
            </div>
            <input ref={inputRef} type="file" accept="image/*" onChange={handleImageChange} style={{ display: "none" }} />
            <span style={{ fontSize: "12px", color: "#A7A7A7", textAlign: "center" }}>
              Clique aqui para adicionar uma foto ao seu perfil
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={labelStyle}>Data de nascimento</label>
            <input
              type="text"
              placeholder="dd/mm/aaaa"
              value={dataNascimento}
              onChange={(e) => setDataNascimento(formatDate(e.target.value))}
              style={inputStyle}
            />
          </div>
        </>
      )
    }

    if (step === 2) {
      return (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={labelStyle}>Anos de experiência</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Ex: 5"
              value={anosExperiencia}
              onChange={(e) => setAnosExperiencia(e.target.value.replace(/\D/g, ""))}
              style={inputStyle}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={labelStyle}>Descrição profissional</label>
            <textarea
              placeholder="Conte um pouco sobre sua experiência, estilo de trabalho e diferenciais..."
              value={descricaoProfissional}
              onChange={(e) => setDescricaoProfissional(e.target.value)}
              style={{ ...inputStyle, minHeight: "120px", resize: "vertical" }}
            />
            <span style={{ fontSize: "12px", color: "#A7A7A7" }}>Mínimo de 50 caracteres</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <label style={labelStyle}>Especialidade</label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: "10px",
              }}
            >
              {specialties.map((item) => {
                const selected = especialidade === item.value

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setEspecialidade(item.value)}
                    style={{
                      border: selected ? "1px solid #F5C518" : "1px solid #A7A7A7",
                      borderRadius: "8px",
                      backgroundColor: selected ? "#FFF8D6" : "#fff",
                      padding: "10px",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ display: "block", fontSize: "14px", fontWeight: 600 }}>{item.label}</span>
                    <span style={{ display: "block", marginTop: "4px", fontSize: "12px", color: "#888" }}>
                      {item.subtitle}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )
    }

    if (step === 3) {
      return (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={labelStyle}>Valor por hora</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="Ex: 150,00"
              value={valorHora}
              onChange={(e) => setValorHora(e.target.value.replace(/[^\d.,]/g, ""))}
              style={inputStyle}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
              <label style={labelStyle}>Drinks</label>
              <span style={{ color: "#A7A7A7", fontSize: "12px" }}>Opcional</span>
            </div>

            <button
              type="button"
              onClick={() => openDrinkModal()}
              disabled={drinks.length >= 6}
              style={{
                alignItems: "center",
                backgroundColor: "#fff",
                border: "1px dashed #A7A7A7",
                borderRadius: "10px",
                cursor: drinks.length >= 6 ? "not-allowed" : "pointer",
                display: "flex",
                gap: "12px",
                opacity: drinks.length >= 6 ? 0.6 : 1,
                padding: "16px",
                textAlign: "left",
                width: "100%",
              }}
            >
              <div
                style={{
                  alignItems: "center",
                  backgroundColor: "#FFF8D6",
                  borderRadius: "10px",
                  color: "#111",
                  display: "flex",
                  flexShrink: 0,
                  height: "44px",
                  justifyContent: "center",
                  width: "44px",
                }}
              >
                <Wine size={22} />
              </div>
              <div>
                <span style={{ display: "block", fontSize: "14px", fontWeight: 600 }}>Adicionar drink</span>
                <span style={{ color: "#888", display: "block", fontSize: "12px", marginTop: "4px" }}>
                  Inclua nome e foto quando quiser destacar seu cardápio.
                </span>
              </div>
            </button>

            <span style={{ color: "#A7A7A7", fontSize: "12px" }}>
              Você pode adicionar até 6 drinks.
            </span>

            {drinks.length > 0 && (
              <div style={{ display: "grid", gap: "10px" }}>
                {drinks.map((drink, index) => (
                  <div
                    key={`${drink.id ?? "new"}-${index}`}
                    onClick={() => openDrinkModal(index)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        openDrinkModal(index)
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    style={{
                      alignItems: "center",
                      backgroundColor: "#fff",
                      border: "1px solid #E5E5E5",
                      borderRadius: "10px",
                      cursor: "pointer",
                      display: "grid",
                      gap: "10px",
                      gridTemplateColumns: "56px 1fr 34px",
                      padding: "10px",
                      textAlign: "left",
                      width: "100%",
                    }}
                  >
                    <div
                      style={{
                        alignItems: "center",
                        backgroundColor: "#f5f5f5",
                        backgroundImage: drink.preview ? `url(${drink.preview})` : undefined,
                        backgroundPosition: "center",
                        backgroundSize: "cover",
                        border: "1px solid #E5E5E5",
                        borderRadius: "8px",
                        display: "flex",
                        height: "56px",
                        justifyContent: "center",
                        overflow: "hidden",
                        width: "56px",
                      }}
                    >
                      {!drink.preview && <Wine size={20} color="#A7A7A7" />}
                    </div>

                    <div>
                      <span style={{ display: "block", fontSize: "14px", fontWeight: 600 }}>{drink.nome}</span>
                      <span style={{ color: "#888", display: "block", fontSize: "12px", marginTop: "4px" }}>
                        Clique para editar
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        removeDrink(index)
                      }}
                      aria-label={`Remover ${drink.nome}`}
                      style={{
                        alignItems: "center",
                        backgroundColor: "#fff",
                        border: "1px solid #E5E5E5",
                        borderRadius: "8px",
                        cursor: "pointer",
                        display: "flex",
                        height: "34px",
                        justifyContent: "center",
                        width: "34px",
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )
    }

    return (
      <>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={labelStyle}>CEP</label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="00000-000"
            value={cep}
            onChange={(e) => setCep(formatCep(e.target.value))}
            style={inputStyle}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={labelStyle}>Rua</label>
          <input
            type="text"
            placeholder="Nome da rua"
            value={rua}
            onChange={(e) => setRua(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "12px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={labelStyle}>Bairro</label>
            <input
              type="text"
              placeholder="Bairro"
              value={bairro}
              onChange={(e) => setBairro(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={labelStyle}>Número</label>
            <input
              type="text"
              placeholder="123"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>
      </>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ textAlign: "center", marginBottom: "8px" }}>
        <h2 style={{ fontSize: "22px", fontWeight: "700", margin: "0 0 8px" }}>
          {currentStep.title}
        </h2>
        <p style={{ color: "#888", margin: 0 }}>
          {currentStep.description}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", color: "#888", fontSize: "12px" }}>
          <span>Etapa {step} de {steps.length}</span>
          <span>{Math.round((step / steps.length) * 100)}%</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${steps.length}, 1fr)`, gap: "6px" }}>
          {steps.map((item, index) => (
            <div
              key={item.title}
              style={{
                height: "4px",
                borderRadius: "999px",
                backgroundColor: index + 1 <= step ? "#F5C518" : "#E5E5E5",
              }}
            />
          ))}
        </div>
      </div>

      {renderStep()}

      {drinkModalOpen && (
        <div
          onClick={closeDrinkModal}
          style={{
            alignItems: "center",
            backgroundColor: "rgba(0, 0, 0, 0.4)",
            display: "flex",
            inset: 0,
            justifyContent: "center",
            padding: "24px",
            position: "fixed",
            zIndex: 50,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              backgroundColor: "#fff",
              borderRadius: "12px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
              display: "flex",
              flexDirection: "column",
              gap: "18px",
              maxWidth: "420px",
              padding: "24px",
              width: "100%",
            }}
          >
            <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", gap: "12px" }}>
              <h3 style={{ fontSize: "20px", fontWeight: 700, margin: 0 }}>
                {editingDrinkIndex === null ? "Adicionar drink" : "Editar drink"}
              </h3>
              <button
                type="button"
                onClick={closeDrinkModal}
                aria-label="Fechar modal de drink"
                style={{
                  alignItems: "center",
                  backgroundColor: "#fff",
                  border: "1px solid #E5E5E5",
                  borderRadius: "8px",
                  cursor: "pointer",
                  display: "flex",
                  height: "34px",
                  justifyContent: "center",
                  width: "34px",
                }}
              >
                <X size={16} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => drinkFileInputRef.current?.click()}
              style={{
                alignItems: "center",
                alignSelf: "center",
                backgroundColor: "#f5f5f5",
                backgroundImage: modalDrinkPreview ? `url(${modalDrinkPreview})` : undefined,
                backgroundPosition: "center",
                backgroundSize: "cover",
                border: "1px dashed #A7A7A7",
                borderRadius: "12px",
                cursor: "pointer",
                display: "flex",
                height: "132px",
                justifyContent: "center",
                overflow: "hidden",
                width: "100%",
              }}
            >
              {!modalDrinkPreview && (
                <div style={{ alignItems: "center", color: "#888", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <Wine size={32} color="#A7A7A7" />
                  <Camera size={18} color="#A7A7A7" />
                  <span style={{ color: "#888", fontSize: "13px", fontWeight: 600 }}>Adicionar foto</span>
                </div>
              )}
            </button>
            <input
              ref={drinkFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleDrinkModalImageChange}
              style={{ display: "none" }}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={labelStyle}>Nome do drink</label>
              <input
                type="text"
                placeholder="Ex: Mojito"
                value={modalDrinkName}
                onChange={(event) => setModalDrinkName(event.target.value)}
                style={inputStyle}
              />
            </div>

            {modalDrinkError && (
              <p style={{ color: "red", fontSize: "13px", margin: 0, textAlign: "center" }}>{modalDrinkError}</p>
            )}

            <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "1fr 1fr" }}>
              <button
                type="button"
                onClick={closeDrinkModal}
                style={{
                  backgroundColor: "#fff",
                  border: "1px solid #A7A7A7",
                  borderRadius: "10px",
                  cursor: "pointer",
                  fontSize: "15px",
                  fontWeight: 600,
                  padding: "12px",
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveDrinkModal}
                style={{
                  backgroundColor: "#F5C518",
                  border: "none",
                  borderRadius: "10px",
                  cursor: "pointer",
                  fontSize: "15px",
                  fontWeight: 600,
                  padding: "12px",
                }}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p style={{ color: "red", fontSize: "13px", textAlign: "center", margin: 0 }}>{error}</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {step > 1 && (
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(1, current - 1))}
            disabled={loading}
            style={{
              backgroundColor: "#fff",
              border: "1px solid #A7A7A7",
              borderRadius: "10px",
              padding: "14px",
              fontSize: "16px",
              fontWeight: "600",
              cursor: "pointer",
              width: "100%",
              opacity: loading ? 0.6 : 1,
            }}
          >
            Voltar
          </button>
        )}

        {step < steps.length ? (
          <button
            type="button"
            onClick={handleNext}
            style={{
              backgroundColor: "#F5C518",
              border: "none",
              borderRadius: "10px",
              padding: "14px",
              fontSize: "16px",
              fontWeight: "600",
              cursor: "pointer",
              width: "100%",
            }}
          >
            Próximo →
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            style={{
              backgroundColor: "#F5C518",
              border: "none",
              borderRadius: "10px",
              padding: "14px",
              fontSize: "16px",
              fontWeight: "600",
              cursor: "pointer",
              width: "100%",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Salvando..." : "Concluir cadastro →"}
          </button>
        )}
      </div>
    </div>
  )
}
