"use client"

import { use, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Star } from "lucide-react"
import { api } from "@/services/api"

const PRIMARY_YELLOW = "#F5C518"

const TAGS_BARTENDER = ["PONTUAL", "COMUNICATIVO", "HABILIDOSO", "RESPONSÁVEL", "PROATIVO", "SIMPÁTICO"]
const TAGS_SERVICO = ["SUPEROU EXPECTATIVAS", "ORGANIZADO", "COMPLETO", "EFICIENTE"]

type Props = {
  params: Promise<{ pedido_id: string }>
}

export default function FeedbackPage({ params }: Props) {
  const { pedido_id } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const bartenderNome = searchParams.get("bartender") ?? "o bartender"

  const [nota, setNota] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [tagsSelected, setTagsSelected] = useState<string[]>([])
  const [comentario, setComentario] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function toggleTag(tag: string) {
    setTagsSelected((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  async function handleSubmit() {
    if (nota === 0) {
      setError("Por favor, selecione uma classificação.")
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await api.post("/avaliacoes/", {
        pedido: Number(pedido_id),
        nota,
        comentario,
        tags: tagsSelected,
      })
      setSuccess(true)
      setTimeout(() => router.push("/client/home"), 2500)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; pedido?: string[] } } }
      setError(
        e?.response?.data?.pedido?.[0] ??
        e?.response?.data?.detail ??
        "Erro ao enviar avaliação. Tente novamente."
      )
    } finally {
      setSubmitting(false)
    }
  }

  const activeNota = hovered || nota

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "0 16px 40px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: "28px" }}>
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            color: "#555",
            fontSize: "14px",
            fontWeight: "500",
            padding: "0",
          }}
        >
          ← Voltar
        </button>
      </div>

      <h2 style={{ fontSize: "26px", fontWeight: "700", margin: "0 0 24px" }}>Feedback</h2>

      {/* Banner de serviço concluído */}
      <div style={{
        border: "1px solid #e8e8e8",
        borderRadius: "12px",
        padding: "18px 24px",
        marginBottom: "24px",
        backgroundColor: "#fff",
        textAlign: "center",
        fontSize: "15px",
        fontWeight: "500",
        color: "#333",
      }}>
        Seu serviço foi concluído!
      </div>

      {/* Classificação por estrelas */}
      <div style={{
        border: "1px solid #e8e8e8",
        borderRadius: "12px",
        padding: "24px",
        marginBottom: "20px",
        backgroundColor: "#fff",
      }}>
        <p style={{ margin: "0 0 16px", fontWeight: "600", fontSize: "15px" }}>
          Como você classificaria o serviço?
        </p>
        <div style={{ display: "flex", gap: "8px" }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setNota(star)}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "2px" }}
            >
              <Star
                size={32}
                fill={star <= activeNota ? PRIMARY_YELLOW : "none"}
                color={star <= activeNota ? PRIMARY_YELLOW : "#ccc"}
                style={{ transition: "all 0.1s" }}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Tags do bartender */}
      <div style={{
        border: "1px solid #e8e8e8",
        borderRadius: "12px",
        padding: "24px",
        marginBottom: "20px",
        backgroundColor: "#fff",
      }}>
        <p style={{ margin: "0 0 16px", fontWeight: "600", fontSize: "15px" }}>
          O que você achou de {bartenderNome}?
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
          {TAGS_BARTENDER.map((tag) => {
            const selected = tagsSelected.includes(tag)
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                style={{
                  border: `1px solid ${selected ? PRIMARY_YELLOW : "#d0d0d0"}`,
                  borderRadius: "20px",
                  padding: "6px 16px",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer",
                  letterSpacing: "0.5px",
                  backgroundColor: selected ? "#fdf6dc" : "#fff",
                  color: selected ? "#8a6d00" : "#555",
                  transition: "all 0.15s",
                }}
              >
                {tag}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tags do serviço */}
      <div style={{
        border: "1px solid #e8e8e8",
        borderRadius: "12px",
        padding: "24px",
        marginBottom: "20px",
        backgroundColor: "#fff",
      }}>
        <p style={{ margin: "0 0 16px", fontWeight: "600", fontSize: "15px" }}>
          O que você achou do serviço?
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
          {TAGS_SERVICO.map((tag) => {
            const selected = tagsSelected.includes(tag)
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                style={{
                  border: `1px solid ${selected ? PRIMARY_YELLOW : "#d0d0d0"}`,
                  borderRadius: "20px",
                  padding: "6px 16px",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer",
                  letterSpacing: "0.5px",
                  backgroundColor: selected ? "#fdf6dc" : "#fff",
                  color: selected ? "#8a6d00" : "#555",
                  transition: "all 0.15s",
                }}
              >
                {tag}
              </button>
            )
          })}
        </div>
      </div>

      {/* Comentário livre */}
      <div style={{
        border: "1px solid #e8e8e8",
        borderRadius: "12px",
        padding: "24px",
        marginBottom: "28px",
        backgroundColor: "#fff",
      }}>
        <p style={{ margin: "0 0 12px", fontWeight: "600", fontSize: "15px" }}>
          Mais alguma coisa?
        </p>
        <textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Digite uma mensagem..."
          rows={4}
          style={{
            width: "100%",
            border: "1px solid #e8e8e8",
            borderRadius: "8px",
            padding: "12px 14px",
            fontSize: "14px",
            outline: "none",
            resize: "vertical",
            boxSizing: "border-box",
            fontFamily: "inherit",
            color: "#333",
            lineHeight: 1.5,
          }}
        />
      </div>

      {/* Feedback de erro */}
      {error && (
        <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#e53e3e", textAlign: "center" }}>
          {error}
        </p>
      )}

      {/* Sucesso */}
      {success && (
        <div style={{
          border: "1px solid #c3e6cb",
          borderRadius: "12px",
          padding: "16px 24px",
          marginBottom: "20px",
          backgroundColor: "#d4edda",
          textAlign: "center",
          color: "#2e7d32",
          fontWeight: "600",
          fontSize: "15px",
        }}>
          ✓ Avaliação enviada! Redirecionando...
        </div>
      )}

      {/* Botão enviar */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || success}
        style={{
          width: "100%",
          backgroundColor: PRIMARY_YELLOW,
          border: "none",
          borderRadius: "12px",
          padding: "16px",
          fontWeight: "700",
          fontSize: "16px",
          cursor: submitting || success ? "not-allowed" : "pointer",
          opacity: submitting || success ? 0.7 : 1,
          transition: "opacity 0.2s",
        }}
      >
        {submitting ? "Enviando..." : "Enviar"}
      </button>
    </div>
  )
}
