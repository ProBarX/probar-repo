"use client"

import { useState, useRef } from "react"
import type { CSSProperties, ReactNode } from "react"
import { CalendarDays, Mail, Star, User } from "lucide-react"
import { api } from "@/services/api"
import type { ApiError, EventStatus } from "@/types/user"
import { resolveMediaUrl } from "@/lib/media-url"

const PRIMARY_YELLOW = "#F5C518"

export type ClientProfile = {
  nome: string
  email: string
  data_nascimento: string
  membro_desde: string
  total_eventos: number
  foto_perfil?: string | null
  eventos: {
    nome: string
    data: string
    status: EventStatus
  }[]
}

type Props = {
  profile: ClientProfile
  onUpdate?: (updated: Partial<ClientProfile>) => void
}

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

export function ProfileView({ profile, onUpdate }: Props) {
  const [nome, setNome] = useState(profile.nome)
  const [dataNascimento, setDataNascimento] = useState(profile.data_nascimento)
  const [fotoPreview, setFotoPreview] = useState<string | null>(profile.foto_perfil ?? null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const initials = nome
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase()

  const statusColor: Record<string, string> = {
    "Em andamento": "#d4860a",
    "Confirmado": "#185FA5",
    "Finalizado": "#2e7d32",
    "Cancelado": "#e53e3e",
  }

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
      formData.append("name", nome)

      if (dataNascimento) {
        let dataISO = dataNascimento
        if (dataNascimento.includes("/")) {
          const [dia, mes, ano] = dataNascimento.split("/")
          dataISO = `${ano}-${mes}-${dia}`
        }
        formData.append("data_nascimento", dataISO)
      }

      const fileInput = fileInputRef.current
      if (fileInput?.files?.[0]) formData.append("foto_perfil", fileInput.files[0])

      const { data } = await api.patch("/clientes/me/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })

      setSaveSuccess(true)
      onUpdate?.({
        nome:            data.name,
        email:           data.email,
        data_nascimento: data.data_nascimento,
        foto_perfil:     resolveMediaUrl(data.foto_perfil),
      })
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err: unknown) {
      const apiError = err as ApiError
      setSaveError(apiError?.response?.data?.detail ?? "Erro ao salvar. Tente novamente.")
    } finally {
      setSaving(false)
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
            <Star size={20} color="#fff" />
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFotoChange} />

        <div style={{ flex: 1 }}>
          <h3 style={{ margin: "0 0 4px", fontSize: "20px", fontWeight: "700" }}>{nome}</h3>
          <p style={{ margin: "0 0 12px", color: "#888", fontSize: "13px" }}>
            Membro desde {profile.membro_desde}
          </p>
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            background: "#fdf6dc",
            border: "1px solid #f5e090",
            borderRadius: "20px",
            padding: "4px 14px",
            fontSize: "13px",
            fontWeight: "500",
            color: "#8a6d00",
          }}>
            🎉 {profile.total_eventos} eventos criados
          </span>
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

      {/* Eventos recentes */}
      <div style={{ ...cardStyle, flexDirection: "column", alignItems: "stretch", gap: "0" }}>
        <h4 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: "600" }}>Eventos recentes</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {profile.eventos.length === 0 && (
            <p style={{ color: "#aaa", fontSize: "14px", margin: 0 }}>Nenhum evento encontrado.</p>
          )}
          {profile.eventos.map((evento, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: "#f5f5f5", borderRadius: "8px", padding: "12px 16px",
            }}>
              <div>
                <p style={{ margin: 0, fontWeight: "600", fontSize: "14px" }}>{evento.nome}</p>
                <p style={{ margin: 0, color: "#888", fontSize: "12px" }}>{evento.data}</p>
              </div>
              <span style={{ fontSize: "13px", fontWeight: "500", color: statusColor[evento.status] ?? "#888" }}>
                {evento.status}
              </span>
            </div>
          ))}
        </div>
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
