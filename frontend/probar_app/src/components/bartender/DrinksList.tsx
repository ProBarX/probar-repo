"use client"

import { useRef, useState } from "react"
import { Camera, Edit2, Plus, Wine, X } from "lucide-react"

const PRIMARY_YELLOW = "#F5C518"

export type DrinkDisplayItem = {
  id?: number
  nome: string
  preview: string | null
}

type DrinksListProps = {
  drinks: DrinkDisplayItem[]
  onAdd: (nome: string, file: File | null) => Promise<void> | void
  onDelete: (index: number) => Promise<void> | void
  onEdit?: (index: number, nome: string, file: File | null) => Promise<void> | void
  externalError?: string | null
}

function normalizeName(value: string) {
  return value.trim().toLowerCase()
}

export function DrinksList({ drinks, onAdd, onDelete, onEdit, externalError }: DrinksListProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [modalName, setModalName] = useState("")
  const [modalFile, setModalFile] = useState<File | null>(null)
  const [modalPreview, setModalPreview] = useState<string | null>(null)
  const [modalError, setModalError] = useState("")
  const [saving, setSaving] = useState(false)
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  function openModal(index?: number) {
    if (index === undefined && drinks.length >= 6) return
    const drink = index !== undefined ? drinks[index] : null
    setEditingIndex(index ?? null)
    setModalName(drink?.nome ?? "")
    setModalFile(null)
    setModalPreview(drink?.preview ?? null)
    setModalError("")
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingIndex(null)
    setModalName("")
    setModalFile(null)
    setModalPreview(null)
    setModalError("")
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setModalFile(file)
    setModalPreview(URL.createObjectURL(file))
  }

  async function handleSave() {
    const nome = modalName.trim()
    if (!nome) {
      setModalError("Informe o nome do drink.")
      return
    }

    const hasDuplicate = drinks.some((drink, i) => {
      if (editingIndex === i) return false
      return normalizeName(drink.nome) === normalizeName(nome)
    })

    if (hasDuplicate) {
      setModalError("Este drink já foi cadastrado.")
      return
    }

    setSaving(true)
    setModalError("")

    try {
      if (editingIndex !== null) {
        await onEdit?.(editingIndex, nome, modalFile)
      } else {
        await onAdd(nome, modalFile)
      }
      closeModal()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      setModalError(e?.response?.data?.detail ?? "Erro ao salvar drink.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(e: React.MouseEvent, index: number) {
    e.stopPropagation()
    setDeletingIndex(index)
    try {
      await onDelete(index)
    } finally {
      setDeletingIndex(null)
    }
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {externalError && (
          <p style={{ margin: 0, fontSize: "13px", color: "#e53e3e" }}>{externalError}</p>
        )}

        {drinks.length === 0 ? (
          <button
            type="button"
            onClick={() => openModal()}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = PRIMARY_YELLOW)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#E5E5E5")}
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              borderRadius: "10px",
              border: "2px dashed #E5E5E5",
              backgroundColor: "#fafafa",
              padding: "32px",
              cursor: "pointer",
              transition: "border-color 0.15s",
            }}
          >
            <Wine size={40} color="#A7A7A7" />
            <div style={{ textAlign: "center" }}>
              <p style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 500, color: "#1a1a1a" }}>
                Adicione fotos dos seus drinks
              </p>
              <p style={{ margin: 0, fontSize: "12px", color: "#A7A7A7" }}>
                Até 6 drinks para mostrar seu trabalho
              </p>
            </div>
          </button>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
            gap: "12px",
          }}>
            {drinks.map((drink, index) => (
              <div
                key={drink.id ?? index}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{
                  position: "relative",
                  borderRadius: "10px",
                  border: "1px solid #E5E5E5",
                  backgroundColor: "#fff",
                  overflow: "hidden",
                }}
              >
                <div style={{
                  width: "100%",
                  aspectRatio: "1 / 1",
                  overflow: "hidden",
                  backgroundColor: "#f5f5f5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  {drink.preview ? (
                    <img
                      src={drink.preview}
                      alt={drink.nome}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <Wine size={32} color="#A7A7A7" />
                  )}
                </div>

                <div style={{ padding: "8px 10px" }}>
                  <span style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#1a1a1a",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {drink.nome}
                  </span>
                </div>

                {hoveredIndex === index && (
                  <div style={{
                    position: "absolute",
                    top: "6px",
                    right: "6px",
                    display: "flex",
                    gap: "4px",
                  }}>
                    {onEdit !== undefined && (
                      <button
                        type="button"
                        onClick={() => openModal(index)}
                        aria-label={`Editar ${drink.nome}`}
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "50%",
                          backgroundColor: "rgba(255,255,255,0.92)",
                          border: "none",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
                        }}
                      >
                        <Edit2 size={13} color="#333" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, index)}
                      disabled={deletingIndex === index}
                      aria-label={`Remover ${drink.nome}`}
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        backgroundColor: "#e53e3e",
                        border: "none",
                        cursor: deletingIndex === index ? "wait" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
                        opacity: deletingIndex === index ? 0.5 : 1,
                      }}
                    >
                      <X size={13} color="#fff" />
                    </button>
                  </div>
                )}
              </div>
            ))}

            {drinks.length < 6 && (
              <button
                type="button"
                onClick={() => openModal()}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = PRIMARY_YELLOW)}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#E5E5E5")}
                style={{
                  aspectRatio: "1 / 1",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  borderRadius: "10px",
                  border: "2px dashed #E5E5E5",
                  backgroundColor: "#fafafa",
                  cursor: "pointer",
                  transition: "border-color 0.15s",
                }}
              >
                <Plus size={22} color="#A7A7A7" />
                <span style={{ fontSize: "12px", color: "#A7A7A7" }}>Adicionar</span>
              </button>
            )}
          </div>
        )}

        <span style={{ color: "#A7A7A7", fontSize: "12px" }}>
          {drinks.length}/6 drinks cadastrados.
        </span>
      </div>

      {modalOpen && (
        <div
          onClick={closeModal}
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
            onClick={(e) => e.stopPropagation()}
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
                {editingIndex === null ? "Adicionar drink" : "Editar drink"}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Fechar"
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
              onClick={() => fileInputRef.current?.click()}
              style={{
                alignSelf: "center",
                backgroundColor: "#f5f5f5",
                backgroundImage: modalPreview ? `url(${modalPreview})` : undefined,
                backgroundPosition: "center",
                backgroundSize: "cover",
                border: "1px dashed #A7A7A7",
                borderRadius: "12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "148px",
                overflow: "hidden",
                width: "148px",
              }}
            >
              {!modalPreview && (
                <div style={{ alignItems: "center", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <Wine size={32} color="#A7A7A7" />
                  <Camera size={18} color="#A7A7A7" />
                  <span style={{ color: "#888", fontSize: "13px", fontWeight: 600 }}>Adicionar foto</span>
                </div>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "14px", fontWeight: 500 }}>Nome do drink</label>
              <input
                type="text"
                placeholder="Ex: Mojito"
                value={modalName}
                onChange={(e) => setModalName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
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

            {modalError && (
              <p style={{ color: "#e53e3e", fontSize: "13px", margin: 0, textAlign: "center" }}>{modalError}</p>
            )}

            <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "1fr 1fr" }}>
              <button
                type="button"
                onClick={closeModal}
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
                onClick={handleSave}
                disabled={saving}
                style={{
                  backgroundColor: PRIMARY_YELLOW,
                  border: "none",
                  borderRadius: "10px",
                  cursor: saving ? "not-allowed" : "pointer",
                  fontSize: "15px",
                  fontWeight: 600,
                  opacity: saving ? 0.6 : 1,
                  padding: "12px",
                }}
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
