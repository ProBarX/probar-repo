"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { fetchBartendersPage, type Bartender } from "@/services/bartenders"
import { BannerPromo } from "@/components/client/home/BannerPromo"
import { CategoryFilter } from "@/components/client/home/CategoryFilter"
import { BartenderCard } from "@/components/client/home/BartenderCard"

export default function HomePage() {
  const router = useRouter()
  const [bartenders, setBartenders] = useState<Bartender[]>([])
  const [nextUrl, setNextUrl] = useState<string | null>("/bartenders/")
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState("Todos")
  const [search, setSearch] = useState("")
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const isFetchingRef = useRef(false)

  const loadBartenders = useCallback(async (url: string, append = false) => {
    if (isFetchingRef.current) return

    isFetchingRef.current = true
    setError(null)

    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }

    try {
      const page = await fetchBartendersPage(url)

      setBartenders((current) => {
        if (!append) return page.results

        const loadedIds = new Set(current.map((bartender) => bartender.user_id))
        const newBartenders = page.results.filter((bartender) => !loadedIds.has(bartender.user_id))

        return [...current, ...newBartenders]
      })

      setNextUrl(page.next)
    } catch {
      if (append) {
        setNextUrl(null)
      } else {
        setError("Não foi possível carregar os bartenders.")
      }
    } finally {
      setLoading(false)
      setLoadingMore(false)
      isFetchingRef.current = false
    }
  }, [])

  useEffect(() => {
    loadBartenders("/bartenders/")
  }, [loadBartenders])

  useEffect(() => {
    const target = sentinelRef.current
    if (!target || !nextUrl || loading || loadingMore) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && nextUrl) {
          loadBartenders(nextUrl, true)
        }
      },
      { rootMargin: "360px 0px" }
    )

    observer.observe(target)

    return () => observer.disconnect()
  }, [loadBartenders, loading, loadingMore, nextUrl])

  const normalizeSpecialty = (value: string) => value.toLowerCase().replace(/[_\s-]+/g, " ").trim()

  const filtered = bartenders.filter((b) => {
    const specialty = normalizeSpecialty(b.especialidades ?? "")
    const searchTerm = normalizeSpecialty(search)

    const matchesCategory =
      activeCategory === "Todos" ||
      specialty.includes(normalizeSpecialty(activeCategory))

    const matchesSearch =
      search.trim() === "" ||
      b.nome.toLowerCase().includes(search.toLowerCase()) ||
      specialty.includes(searchTerm)

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
        <div style={{ position: "relative", width: "280px" }}>
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
              key={b.user_id ?? b.email + index}
              name={b.nome}
              specialty={b.especialidades}
              price={b.valor_hora}
              rating={b.media_avaliacoes}
              image={b.foto_perfil ?? "/bartender-placeholder.jpg"}
              onSelect={() => router.push(`/client/bartender/${b.user_id}`)}
            />
          ))}
        </div>
      )}

      {!loading && !error && (
        <div ref={sentinelRef} style={{ height: "1px" }} />
      )}

      {loadingMore && (
        <p style={{ color: "#888", textAlign: "center", padding: "24px 0" }}>
          Carregando mais bartenders...
        </p>
      )}
    </div>
  )
}
