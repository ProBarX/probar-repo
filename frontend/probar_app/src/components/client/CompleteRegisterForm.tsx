"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { User } from "lucide-react"

export function CompleteRegisterForm() {
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dataNascimento, setDataNascimento] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
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

  function formatarData(value: string) {
    const nums = value.replace(/\D/g, "").slice(0, 8)
    if (nums.length <= 2) return nums
    if (nums.length <= 4) return `${nums.slice(0, 2)}/${nums.slice(2)}`
    return `${nums.slice(0, 2)}/${nums.slice(2, 4)}/${nums.slice(4)}`
  }

  async function handleSubmit() {
    setError("")

    if (!dataNascimento || dataNascimento.length < 10) {
      setError("Informe sua data de nascimento.")
      return
    }

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

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/clientes/me/`,{
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (!res.ok) {
        setError("Erro ao salvar. Tente novamente.")
        return
      }

      router.push("/client/home")
    } catch {
      setError("Erro ao conectar com o servidor.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Foto de perfil */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
        <label style={{ fontSize: "14px", fontWeight: "500" }}>Foto de perfil</label>
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
            <img src={preview} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <User size={36} color="#A7A7A7" />
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/*" onChange={handleImageChange} style={{ display: "none" }} />
        <span style={{ fontSize: "12px", color: "#A7A7A7" }}>Clique aqui para adicionar uma foto ao seu perfil</span>
      </div>

      {/* Data de nascimento */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <label style={{ fontSize: "14px", fontWeight: "500" }}>Data de nascimento</label>
        <input
          type="text"
          placeholder="dd/mm/aaaa"
          value={dataNascimento}
          onChange={(e) => setDataNascimento(formatarData(e.target.value))}
          style={{
            border: "1px solid #A7A7A7",
            borderRadius: "8px",
            padding: "10px 14px",
            fontSize: "14px",
            outline: "none",
            width: "100%",
            boxSizing: "border-box",
          }}
        />
      </div>

      {error && (
        <p style={{ color: "red", fontSize: "13px", textAlign: "center", margin: 0 }}>{error}</p>
      )}

      <button
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
    </div>
  )
}