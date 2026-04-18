"use client"

import { useEffect, useState } from "react"
import { api } from "@/services/api"
import { BannerPromo } from "@/components/client/home/BannerPromo"
import { CategoryFilter } from "@/components/client/home/CategoryFilter"
import { BartenderCard } from "@/components/client/home/BartenderCard"

type Bartender = {
  email: string
  nome: string
  valor_hora: number
  especialidades: string
  foto_perfil: string | null
  anos_experiencia: number
}

export default function HomePage() {
  const [bartenders, setBartenders] = useState<Bartender[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState("Todos")
  const [search, setSearch] = useState("")

  useEffect(() => {
    api.get<Bartender[] | { results: Bartender[] }>("/bartenders/")
      .then(({ data }) => {
        setBartenders("results" in data ? data.results : data)
      })
      .catch(() => setError("Não foi possível carregar os bartenders."))
      .finally(() => setLoading(false))
  }, [])

  const filtered = bartenders.filter((b) => {
    const matchesCategory =
      activeCategory === "Todos" ||
      b.especialidades?.toLowerCase().includes(activeCategory.toLowerCase())

    const matchesSearch =
      search.trim() === "" ||
      b.nome.toLowerCase().includes(search.toLowerCase()) ||
      b.especialidades?.toLowerCase().includes(search.toLowerCase())

    return matchesCategory && matchesSearch
  })

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <p style={{ color: "#888", margin: 0, fontSize: "14px" }}>Localização</p>
          <p style={{ margin: 0, fontWeight: "600" }}>Patos, Paraíba ↓</p>
          <h1 style={{ margin: "4px 0 0" }}>Encontre seu Bartender</h1>
        </div>
        <div style={{
          position: "relative",
          width: "280px",
        }}>
          <svg
            style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
              color: "#aaa",
            }}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Procurar bartenders"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 16px 10px 38px",
              borderRadius: "8px",
              border: "1px solid #ddd",
              fontSize: "14px",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      <BannerPromo />
      <CategoryFilter active={activeCategory} onChange={setActiveCategory} />

      {loading && (
        <p style={{ color: "#888", textAlign: "center", padding: "40px 0" }}>
          Carregando bartenders...
        </p>
      )}

      {error && (
        <p style={{ color: "#e53e3e", textAlign: "center", padding: "40px 0" }}>
          {error}
        </p>
      )}

      {!loading && !error && filtered.length === 0 && (
        <p style={{ color: "#888", textAlign: "center", padding: "40px 0" }}>
          Nenhum bartender encontrado.
        </p>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
          {filtered.map((b, index) => (
            <BartenderCard
              key={b.email + index}
              name={b.nome}
              specialty={b.especialidades}
              price={b.valor_hora}
              rating={b.anos_experiencia}
              image={b.foto_perfil ?? "/bartender-placeholder.jpg"}
            />
          ))}
        </div>
      )}
    </div>
  )
}
