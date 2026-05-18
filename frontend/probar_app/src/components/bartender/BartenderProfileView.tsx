"use client"

import { useState, useRef } from "react"
import type { CSSProperties, ReactNode } from "react"
import {
  AlignLeft,
  Award,
  Banknote,
  CalendarDays,
  Hash,
  Home,
  Mail,
  Map,
  MapPin,
  Star,
  Camera,
  User,
  Wine,
} from "lucide-react"
import { api } from "@/services/api"
import { DrinksList, type DrinkDisplayItem } from "@/components/bartender/DrinksList"
import { resolveMediaUrl } from "@/lib/media-url"

const PRIMARY_YELLOW = "#F5C518"

export type BartenderProfile = {
  id: number
  nome: string
  email: string
  data_nascimento: string
  foto_perfil?: string | null
  membro_desde: string
  especialidades: string
  anos_experiencia: number | null
  descricao_profissional: string
  valor_hora: string | null
  media_avaliacoes: number
  total_avaliacoes: number
  cep: string
  rua: string
  bairro: string
  numero: string
  drinks: DrinkDisplayItem[]
}

type Props = {
  profile: BartenderProfile
  onUpdate?: (updated: Partial<BartenderProfile>) => void
}

const ESPECIALIDADES = [
  { value: "", label: "Não informado" },
  { value: "showman", label: "Showman" },
  { value: "mixologista", label: "Mixologista" },
  { value: "tradicional", label: "Tradicional" },
  { value: "night_club", label: "Night Club" },
]

const cardStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "20px",
  border: "1px solid #e8e8e8",
  borderRadius: "12px",
  padding: "20px 24px",
  marginBottom: "20px",
  backgroundColor: "#fff",
}

function formatDateDisplay(iso: string) {
  if (!iso) return "—"
  if (iso.includes("/")) return iso
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export function BartenderProfileView({ profile, onUpdate }: Props) {
  const [nome, setNome] = useState(profile.nome)
  const [dataNascimento, setDataNascimento] = useState(profile.data_nascimento)
  const [especialidades, setEspecialidades] = useState(profile.especialidades)
  const [anosExperiencia, setAnosExperiencia] = useState(String(profile.anos_experiencia ?? ""))
  const [valorHora, setValorHora] = useState(profile.valor_hora ?? "")
  const [descricao, setDescricao] = useState(profile.descricao_profissional)
  const [cep, setCep] = useState(profile.cep)
  const [rua, setRua] = useState(profile.rua)
  const [bairro, setBairro] = useState(profile.bairro)
  const [numero, setNumero] = useState(profile.numero)
  const [fotoPreview, setFotoPreview] = useState<string | null>(profile.foto_perfil ?? null)
  const [drinks, setDrinks] = useState<DrinkDisplayItem[]>(profile.drinks)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [drinkError, setDrinkError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const initials = nome
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase()

  function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setFotoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      const formData = new FormData()
      formData.append("nome", nome)
      formData.append("especialidades", especialidades)
      formData.append("descricao_profissional", descricao)
      formData.append("cep", cep)
      formData.append("rua", rua)
      formData.append("bairro", bairro)
      formData.append("numero", numero)

      if (dataNascimento) {
        let dataISO = dataNascimento
        if (dataNascimento.includes("/")) {
          const [dia, mes, ano] = dataNascimento.split("/")
          dataISO = `${ano}-${mes}-${dia}`
        }
        formData.append("data_nascimento", dataISO)
      }

      if (anosExperiencia) formData.append("anos_experiencia", anosExperiencia)
      if (valorHora) formData.append("valor_hora", valorHora)

      const fileInput = fileInputRef.current
      if (fileInput?.files?.[0]) formData.append("foto_perfil", fileInput.files[0])

      const { data } = await api.patch("/bartenders/me/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })

      setSaveSuccess(true)
      onUpdate?.({
        nome: data.nome,
        data_nascimento: data.data_nascimento,
        foto_perfil: resolveMediaUrl(data.foto_perfil),
        especialidades: data.especialidades,
        anos_experiencia: data.anos_experiencia,
        valor_hora: data.valor_hora,
        descricao_profissional: data.descricao_profissional,
        cep: data.cep,
        rua: data.rua,
        bairro: data.bairro,
        numero: data.numero,
      })
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      setSaveError(e?.response?.data?.detail ?? "Erro ao salvar. Tente novamente.")
    } finally {
      setSaving(false)
    }
  }

  async function handleAddDrink(nome: string, file: File | null) {
    setDrinkError(null)
    const formData = new FormData()
    formData.append("nome", nome)
    if (file) formData.append("foto", file)

    const { data } = await api.post("/drinks/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    setDrinks((prev) => [...prev, { id: data.id, nome: data.nome, preview: resolveMediaUrl(data.foto) }])
  }

  async function handleEditDrink(index: number, nome: string, file: File | null) {
    const drink = drinks[index]
    if (!drink?.id) return
    setDrinkError(null)

    const formData = new FormData()
    formData.append("nome", nome)
    if (file) formData.append("foto", file)

    const { data } = await api.patch(`/drinks/${drink.id}/`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    setDrinks((prev) =>
      prev.map((d, i) =>
        i === index ? { id: data.id, nome: data.nome, preview: data.foto ? resolveMediaUrl(data.foto) : d.preview } : d
      )
    )
  }

  async function handleDeleteDrink(index: number) {
    const drink = drinks[index]
    setDrinkError(null)
    try {
      if (drink?.id) await api.delete(`/drinks/${drink.id}/`)
      setDrinks((prev) => prev.filter((_, i) => i !== index))
    } catch {
      setDrinkError("Erro ao remover drink.")
      throw new Error("delete failed")
    }
  }

  return (
    <div style={{ maxWidth: "780px" }} className="mx-auto">
      <h2 style={{ fontSize: "22px", fontWeight: "700", margin: "0 0 24px" }}>Meu perfil</h2>

      {/* Header: avatar + nome + stats */}
      <div style={cardStyle}>
        <div
          onClick={() => fileInputRef.current?.click()}
          title="Trocar foto"
          style={{
            width: "72px",
            height: "72px",
            borderRadius: "50%",
            background: "#ddd",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "24px",
            fontWeight: "700",
            color: "#555",
            flexShrink: 0,
            cursor: "pointer",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {fotoPreview ? (
            <img
              src={fotoPreview}
              alt="Foto de perfil"
              onError={() => setFotoPreview(null)}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            initials
          )}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: 0,
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}
          >
            <Camera size={20} color="#fff" />
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFotoChange} />

        <div style={{ flex: 1 }}>
          <h3 style={{ margin: "0 0 4px", fontSize: "20px", fontWeight: "700" }}>{nome}</h3>
          <p style={{ margin: "0 0 12px", color: "#888", fontSize: "13px" }}>
            Membro desde {profile.membro_desde}
          </p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              background: "#fdf6dc",
              border: "1px solid #f5e090",
              borderRadius: "20px",
              padding: "4px 12px",
              fontSize: "13px",
              fontWeight: "500",
              color: "#8a6d00",
            }}>
              <Star size={13} fill={PRIMARY_YELLOW} color={PRIMARY_YELLOW} />
              {profile.media_avaliacoes.toFixed(1)}
              <span style={{ color: "#b89400" }}>({profile.total_avaliacoes} avaliações)</span>
            </span>
            {especialidades && (
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                background: "#f0f0f0",
                border: "1px solid #e0e0e0",
                borderRadius: "20px",
                padding: "4px 12px",
                fontSize: "13px",
                fontWeight: "500",
                color: "#555",
              }}>
                <Wine size={13} color="#555" />
                {ESPECIALIDADES.find((e) => e.value === especialidades)?.label ?? especialidades}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Informações pessoais */}
      <div style={{ ...cardStyle, flexDirection: "column", alignItems: "stretch", gap: "0" }}>
        <h4 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: "600" }}>Informações pessoais</h4>
        <InfoRow icon={<User size={16} color="#8a6d00" />} label="Nome" value={nome} onChange={setNome} />
        <Divider />
        <InfoRow icon={<Mail size={16} color="#8a6d00" />} label="Email" value={profile.email} readOnly />
        <Divider />
        <InfoRow
          icon={<CalendarDays size={16} color="#8a6d00" />}
          label="Data de nascimento"
          value={dataNascimento}
          displayValue={formatDateDisplay(dataNascimento)}
          onChange={setDataNascimento}
          inputType="date"
        />
      </div>

      {/* Informações profissionais */}
      <div style={{ ...cardStyle, flexDirection: "column", alignItems: "stretch", gap: "0" }}>
        <h4 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: "600" }}>Informações profissionais</h4>
        <SelectRow
          icon={<Wine size={16} color="#8a6d00" />}
          label="Especialidade"
          value={especialidades}
          options={ESPECIALIDADES}
          onChange={setEspecialidades}
        />
        <Divider />
        <InfoRow
          icon={<Award size={16} color="#8a6d00" />}
          label="Anos de experiência"
          value={anosExperiencia}
          onChange={setAnosExperiencia}
          inputType="number"
          placeholder="Ex: 3"
        />
        <Divider />
        <InfoRow
          icon={<Banknote size={16} color="#8a6d00" />}
          label="Valor por hora (R$)"
          value={valorHora}
          onChange={setValorHora}
          inputType="number"
          placeholder="Ex: 80.00"
        />
        <Divider />
        <TextAreaRow
          icon={<AlignLeft size={16} color="#8a6d00" />}
          label="Descrição profissional"
          value={descricao}
          onChange={setDescricao}
          placeholder="Conte sobre sua experiência, estilo e diferenciais..."
        />
      </div>

      {/* Localização */}
      <div style={{ ...cardStyle, flexDirection: "column", alignItems: "stretch", gap: "0" }}>
        <h4 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: "600" }}>Localização</h4>
        <InfoRow icon={<MapPin size={16} color="#8a6d00" />} label="CEP" value={cep} onChange={setCep} placeholder="00000-000" />
        <Divider />
        <InfoRow icon={<Home size={16} color="#8a6d00" />} label="Rua" value={rua} onChange={setRua} placeholder="Nome da rua" />
        <Divider />
        <InfoRow icon={<Map size={16} color="#8a6d00" />} label="Bairro" value={bairro} onChange={setBairro} placeholder="Nome do bairro" />
        <Divider />
        <InfoRow icon={<Hash size={16} color="#8a6d00" />} label="Número" value={numero} onChange={setNumero} placeholder="Ex: 123" />
      </div>

      {/* Drinks */}
      <div style={{ ...cardStyle, flexDirection: "column", alignItems: "stretch", gap: "0" }}>
        <h4 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: "600" }}>Meus drinks</h4>
        <DrinksList
          drinks={drinks}
          onAdd={handleAddDrink}
          onEdit={handleEditDrink}
          onDelete={handleDeleteDrink}
          externalError={drinkError}
        />
      </div>

      {/* Botão salvar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "12px", marginTop: "4px", marginBottom: "32px" }}>
        {saveError && <p style={{ margin: 0, fontSize: "13px", color: "#e53e3e" }}>{saveError}</p>}
        {saveSuccess && <p style={{ margin: 0, fontSize: "13px", color: "#2e7d32" }}>✓ Salvo com sucesso</p>}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            backgroundColor: PRIMARY_YELLOW,
            border: "none",
            borderRadius: "8px",
            padding: "10px 24px",
            fontWeight: "600",
            fontSize: "14px",
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </div>
  )
}

function Divider() {
  return <div style={{ height: "1px", background: "#f0f0f0" }} />
}

function InfoRow({
  icon,
  label,
  value,
  displayValue,
  onChange,
  inputType = "text",
  readOnly = false,
  placeholder,
}: {
  icon: ReactNode
  label: string
  value: string
  displayValue?: string
  onChange?: (v: string) => void
  inputType?: string
  readOnly?: boolean
  placeholder?: string
}) {
  const [editing, setEditing] = useState(false)

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      background: "#f9f9f9",
      borderRadius: "8px",
      padding: "12px 14px",
      margin: "6px 0",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <span style={{
          width: "32px",
          height: "32px",
          background: "#fdf6dc",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}>
          {icon}
        </span>
        <div>
          <p style={{ margin: 0, fontSize: "11px", color: "#aaa" }}>{label}</p>
          {editing && !readOnly ? (
            <input
              autoFocus
              type={inputType}
              value={value}
              onChange={(e) => onChange?.(e.target.value)}
              onBlur={() => setEditing(false)}
              onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
              placeholder={placeholder}
              style={{
                border: "none",
                borderBottom: `1px solid ${PRIMARY_YELLOW}`,
                outline: "none",
                fontSize: "14px",
                fontWeight: "500",
                background: "transparent",
                padding: "2px 0",
                width: "260px",
              }}
            />
          ) : (
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "500", color: readOnly ? "#999" : "#1a1a1a" }}>
              {(displayValue ?? value) || (readOnly ? "" : <span style={{ color: "#bbb" }}>{placeholder ?? "—"}</span>)}
            </p>
          )}
        </div>
      </div>
      {!readOnly && (
        <button
          type="button"
          onClick={() => setEditing((prev) => !prev)}
          title="Editar"
          style={{ background: "none", border: "none", cursor: "pointer", color: "#bbb", fontSize: "15px", padding: "4px" }}
        >
          ✏️
        </button>
      )}
    </div>
  )
}

function SelectRow({
  icon,
  label,
  value,
  options,
  onChange,
}: {
  icon: ReactNode
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      background: "#f9f9f9",
      borderRadius: "8px",
      padding: "12px 14px",
      margin: "6px 0",
    }}>
      <span style={{
        width: "32px",
        height: "32px",
        background: "#fdf6dc",
        borderRadius: "8px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        marginRight: "12px",
      }}>
        {icon}
      </span>
      <div>
        <p style={{ margin: 0, fontSize: "11px", color: "#aaa" }}>{label}</p>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            border: "none",
            outline: "none",
            fontSize: "14px",
            fontWeight: "500",
            background: "transparent",
            cursor: "pointer",
            padding: "2px 0",
            color: "#1a1a1a",
          }}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

function TextAreaRow({
  icon,
  label,
  value,
  onChange,
  placeholder,
}: {
  icon: ReactNode
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div style={{
      background: "#f9f9f9",
      borderRadius: "8px",
      padding: "12px 14px",
      margin: "6px 0",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        <span style={{
          width: "32px",
          height: "32px",
          background: "#fdf6dc",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}>
          {icon}
        </span>
        <div style={{ flex: 1 }}>
          <p style={{ margin: "0 0 6px", fontSize: "11px", color: "#aaa" }}>{label}</p>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={3}
            style={{
              width: "100%",
              border: "1px solid #e8e8e8",
              borderRadius: "6px",
              outline: "none",
              fontSize: "14px",
              fontWeight: "500",
              background: "#fff",
              padding: "8px 10px",
              resize: "vertical",
              boxSizing: "border-box",
              lineHeight: 1.5,
              fontFamily: "inherit",
            }}
          />
        </div>
      </div>
    </div>
  )
}
