// Futuramente esse tipo virá do seu serviço/API
export type BartenderDetail = {
  email: string
  nome: string
  especialidades: string
  valor_hora: number
  rating: number
  total_avaliacoes: number
  descricao: string
  foto_perfil: string | null
  drinks: { nome: string; imagem: string | null }[]
}

type Props = {
  bartender: BartenderDetail
  onBack: () => void
}

export function BartenderDetailView({ bartender, onBack }: Props) {
  const [hours, setHours] = useState(4)
  const [drinkIndex, setDrinkIndex] = useState(0)

  const totalPrice = bartender.valor_hora * hours
  const currentDrink = bartender.drinks[drinkIndex]

  return (
    <div>
      {/* Voltar */}
      <button
        onClick={onBack}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#888",
          fontSize: "14px",
          marginBottom: "24px",
          padding: 0,
        }}
      >
        ‹ Voltar
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "28px" }}>
        {/* Coluna esquerda */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Foto do bartender */}
          <img
            src={bartender.foto_perfil ?? "/52063af3-9940-4248-bf16-f32b0b4f68b0.png"}
            alt={bartender.nome}
            style={{
              width: "100%",
              height: "260px",
              objectFit: "cover",
              borderRadius: "12px",
            }}
          />

          {/* Carrossel de drinks */}
          <div style={{
            border: "1px solid #eee",
            borderRadius: "12px",
            padding: "16px",
            minHeight: "140px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}>
            {bartender.drinks.length > 1 && (
              <>
                <button
                  onClick={() => setDrinkIndex((i) => Math.max(0, i - 1))}
                  style={navBtnStyle}
                >
                  ‹
                </button>
                <button
                  onClick={() => setDrinkIndex((i) => Math.min(bartender.drinks.length - 1, i + 1))}
                  style={{ ...navBtnStyle, right: "12px", left: "auto" }}
                >
                  ›
                </button>
              </>
            )}
            {currentDrink?.imagem ? (
              <img
                src={currentDrink.imagem}
                alt={currentDrink.nome}
                style={{ height: "80px", objectFit: "contain", marginBottom: "8px" }}
              />
            ) : (
              <div style={{
                width: "60px",
                height: "60px",
                background: "#f5f5f5",
                borderRadius: "8px",
                marginBottom: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#bbb",
                fontSize: "24px",
              }}>
                🍹
              </div>
            )}
            <p style={{ fontWeight: "600", margin: 0, fontSize: "14px" }}>
              {currentDrink?.nome ?? "Sem drinks cadastrados"}
            </p>
          </div>
        </div>

        {/* Coluna direita */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Nome e rating */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "26px", fontWeight: "700" }}>{bartender.nome}</h2>
              <p style={{ color: "#888", margin: "4px 0 0", fontSize: "14px" }}>{bartender.especialidades}</p>
            </div>
            <span style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              background: "#f9f9f9",
              border: "1px solid #eee",
              borderRadius: "20px",
              padding: "4px 12px",
              fontSize: "13px",
              fontWeight: "600",
              whiteSpace: "nowrap",
            }}>
              ⭐ {bartender.rating} ({bartender.total_avaliacoes})
            </span>
          </div>

          {/* Botão chat */}
          <button style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: "none",
            border: "1px solid #ddd",
            borderRadius: "8px",
            padding: "7px 14px",
            fontSize: "13px",
            cursor: "pointer",
            width: "fit-content",
          }}>
            💬 Chat
          </button>

          {/* Descrição */}
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: "700", margin: "0 0 6px" }}>Descrição</h3>
            <p style={{ color: "#555", fontSize: "13px", lineHeight: "1.6", margin: 0 }}>
              {bartender.descricao}
            </p>
          </div>

          {/* Box de contratação */}
          <div style={{
            border: "1px solid #eee",
            borderRadius: "12px",
            padding: "16px",
            marginTop: "auto",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#888", marginBottom: "12px" }}>
              <span>Hora(s)</span>
              <span>Valor</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <button
                  onClick={() => setHours((h) => Math.max(1, h - 1))}
                  style={ctrlBtnStyle}
                >
                  −
                </button>
                <span style={{ fontWeight: "600", fontSize: "16px", minWidth: "20px", textAlign: "center" }}>
                  {hours}
                </span>
                <button
                  onClick={() => setHours((h) => Math.min(24, h + 1))}
                  style={ctrlBtnStyle}
                >
                  +
                </button>
              </div>
              <span style={{ fontWeight: "700", fontSize: "18px" }}>
                {totalPrice} R$
              </span>
            </div>

            <button style={{
              width: "100%",
              padding: "13px",
              marginTop: "14px",
              background: "#F5C518",
              border: "none",
              borderRadius: "10px",
              fontSize: "15px",
              fontWeight: "700",
              cursor: "pointer",
              color: "#1a1000",
            }}>
              Negociar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- estilos internos ----
import { useState } from "react"
import type { CSSProperties } from "react"

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
  width: "28px",
  height: "28px",
  borderRadius: "50%",
  border: "1px solid #ddd",
  background: "none",
  fontSize: "16px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
}