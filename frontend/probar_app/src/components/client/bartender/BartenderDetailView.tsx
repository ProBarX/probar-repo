"use client"

import { useState } from "react"
import type { CSSProperties } from "react"
import { useRouter } from "next/navigation"

export type BartenderDetail = {
  email: string
  nome: string
  especialidades: string
  valor_hora: number
  anos_experiencia: number
  descricao_profissional: string
  foto_perfil: string | null
  drinks: {
    id: number
    nome: string
    foto: string | null
  }[]
}

type Props = {
  bartender: BartenderDetail
  onBack: () => void
}

export function BartenderDetailView({ bartender, onBack }: Props) {
  const [hours, setHours] = useState(4)
  const [drinkIndex, setDrinkIndex] = useState(0)
  const [expanded, setExpanded] = useState(false)

  const totalPrice = Number(bartender.valor_hora) * hours
  const currentDrink = bartender.drinks[drinkIndex]
  const descricao = bartender.descricao_profissional ?? ""
  const descricaoCurta = descricao.length > 160 ? descricao.slice(0, 160) + "..." : descricao
  const router = useRouter()

  return (
    // O wrapper precisa que o pai tenha height definido (ex: height: 100vh ou 100%)
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* Botão voltar */}
      <button
        onClick={onBack}
        style={{
          display: "flex", alignItems: "center", gap: "6px",
          background: "none", border: "none", cursor: "pointer",
          color: "#888", fontSize: "14px",
          marginBottom: "16px", padding: 0, flexShrink: 0,
        }}
      >
        ‹ Voltar
      </button>

      {/* Grid principal — ocupa o espaço restante, sem overflow */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "20px",
        flex: 1,
        minHeight: 0,
      }}>

        {/* ── Coluna esquerda ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", minHeight: 0 }}>

          {/* Foto — altura fixa menor */}
          <div style={{
            position: "relative",
            borderRadius: "12px",
            overflow: "hidden",
            height: "300px",
            flexShrink: 0,
          }}>
            <img
              src={bartender.foto_perfil ?? "/bartender-placeholder.jpg"}
              alt={bartender.nome}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
            <span style={{
              position: "absolute", top: "10px", right: "10px",
              backgroundColor: "rgba(255,255,255,0.93)",
              borderRadius: "20px", padding: "3px 10px",
              fontSize: "12px", fontWeight: "600",
            }}>
              ⭐ 4,5
            </span>
          </div>

          {/* Carrossel de drinks — cresce para preencher o espaço */}
          <div style={{
            border: "1px solid #eee", borderRadius: "12px",
            padding: "12px 20px",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            position: "relative", backgroundColor: "#fff",
            flex: 1, minHeight: 0,
          }}>
            {bartender.drinks.length > 1 && (
              <>
                <button onClick={() => setDrinkIndex((i) => Math.max(0, i - 1))} style={navBtnStyle}>‹</button>
                <button onClick={() => setDrinkIndex((i) => Math.min(bartender.drinks.length - 1, i + 1))} style={{ ...navBtnStyle, right: "12px", left: "auto" }}>›</button>
              </>
            )}

            {currentDrink?.foto ? (
              <img src={currentDrink.foto} alt={currentDrink.nome}
                style={{ height: "110px", objectFit: "contain", marginBottom: "8px" }} />
            ) : (
              <div style={{
                width: "72px", height: "72px", background: "#f5f5f5",
                borderRadius: "8px", marginBottom: "8px",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "30px",
              }}>🍹</div>
            )}

            <p style={{ fontWeight: "600", margin: 0, fontSize: "13px" }}>
              {currentDrink?.nome ?? "Sem drinks cadastrados"}
            </p>

            {bartender.drinks.length > 1 && (
              <div style={{ display: "flex", gap: "4px", marginTop: "8px" }}>
                {bartender.drinks.map((_, i) => (
                  <div key={i} onClick={() => setDrinkIndex(i)} style={{
                    width: "6px", height: "6px", borderRadius: "50%",
                    background: i === drinkIndex ? "#F5C518" : "#ddd", cursor: "pointer",
                  }} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Coluna direita ── */}
        <div style={{
          display: "flex", flexDirection: "column",
          gap: "12px", minHeight: 0,
        }}>

          {/* Nome + especialidade + rating */}
          <div style={{ flexShrink: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "24px", fontWeight: "700", lineHeight: 1.2 }}>{bartender.nome}</h2>
                <p style={{ color: "#888", margin: "4px 0 0", fontSize: "13px" }}>{bartender.especialidades}</p>
              </div>
              <span style={{
                display: "flex", alignItems: "center", gap: "4px",
                background: "#f9f9f9", border: "1px solid #eee",
                borderRadius: "20px", padding: "4px 12px",
                fontSize: "13px", fontWeight: "600", whiteSpace: "nowrap",
              }}>
                ⭐ 4,5
              </span>
            </div>

            <button
              onClick={() => router.push("/client/chat")}
              style={{
                display: "inline-flex", alignItems: "center", gap: "6px",
                background: "none", border: "1px solid #ddd",
                borderRadius: "8px", padding: "6px 12px",
                fontSize: "13px", cursor: "pointer", marginTop: "10px",
              }}
            >
              💬 Chat
            </button>
          </div>

          {/* Separador */}
          <div style={{ height: "1px", background: "#f0f0f0", flexShrink: 0 }} />

          {/* Descrição — ocupa o espaço do meio */}
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
            <h3 style={{ fontSize: "15px", fontWeight: "700", margin: "0 0 6px", color: "#111" }}>Descrição</h3>
            <p style={{ color: "#555", fontSize: "13px", lineHeight: "1.65", margin: "0 0 4px" }}>
              {expanded ? descricao : descricaoCurta}
            </p>
            {descricao.length > 160 && (
              <span
                onClick={() => setExpanded((e) => !e)}
                style={{ color: "#d4860a", fontSize: "13px", cursor: "pointer" }}
              >
                {expanded ? "Ver menos" : "Ler mais"}
              </span>
            )}
          </div>

          {/* Box contratação — fixo na base */}
          <div style={{
            border: "1px solid #eee", borderRadius: "12px",
            padding: "14px 16px", backgroundColor: "#fff", flexShrink: 0,
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between",
              fontSize: "12px", color: "#aaa", marginBottom: "10px",
            }}>
              <span>Hora(s)</span>
              <span>Valor</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <button onClick={() => setHours((h) => Math.max(1, h - 1))} style={ctrlBtnStyle}>−</button>
                <span style={{ fontWeight: "600", fontSize: "16px", minWidth: "20px", textAlign: "center" }}>{hours}</span>
                <button onClick={() => setHours((h) => Math.min(24, h + 1))} style={ctrlBtnStyle}>+</button>
              </div>
              <span style={{ fontWeight: "700", fontSize: "18px" }}>
                {totalPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </div>

            <button onClick={() => router.push("/client/event/choose")} style={{
              width: "100%", padding: "12px", marginTop: "12px",
              background: "#F5C518", border: "none", borderRadius: "10px",
              fontSize: "15px", fontWeight: "700", cursor: "pointer", color: "#1a1000",
            }}>
              Negociar
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

const navBtnStyle: CSSProperties = {
  position: "absolute",
  left: "12px",
  background: "none",
  border: "none",
  fontSize: "22px",
  cursor: "pointer",
  color: "#555",
  padding: "4px",
}

const ctrlBtnStyle: CSSProperties = {
  width: "30px",
  height: "30px",
  borderRadius: "50%",
  border: "1px solid #ddd",
  background: "none",
  fontSize: "16px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
}