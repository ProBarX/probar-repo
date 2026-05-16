"use client"

import { useEffect, useMemo, useState } from "react"
import type { CSSProperties } from "react"
import { ArrowLeft, Award, ChevronLeft, ChevronRight, Clock, Minus, Plus, Star, Wine } from "lucide-react"
import { useRouter } from "next/navigation"
import { formatCurrency, formatExperience, formatSpecialty } from "@/lib/bartender-format"
import { resolveMediaUrl } from "@/lib/media-url"
import { api } from "@/services/api"

type Avaliacao = {
  id: number
  nota: number
  comentario: string
  tags: string[]
  cliente_nome: string
  evento_nome: string
  criado_em: string
}

const reviewCarouselViewportStyle: CSSProperties = {
  overflow: "hidden",
  borderRadius: "10px",
}

const reviewCarouselTrackStyle: CSSProperties = {
  display: "flex",
  transition: "transform 280ms ease",
  willChange: "transform",
}

const reviewSlideStyle: CSSProperties = {
  minWidth: "100%",
  boxSizing: "border-box",
}

export type BartenderDetail = {
  user_id: number
  email: string
  nome: string
  especialidades: string
  valor_hora: number | string
  anos_experiencia: number | null
  descricao_profissional: string | null
  foto_perfil: string | null
  drinks: {
    id: number
    nome: string
    foto: string | null
  }[]
  media_avaliacoes: number
  total_avaliacoes: number
}

type Props = {
  bartender: BartenderDetail
  onBack: () => void
}

const PLACEHOLDER_IMAGE = "/bartender-placeholder.svg"

export function BartenderDetailView({ bartender, onBack }: Props) {
  const [hours, setHours] = useState(1)
  const [drinkIndex, setDrinkIndex] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [failedDrinkImages, setFailedDrinkImages] = useState<Set<number>>(() => new Set())
  const [reviews, setReviews] = useState<Avaliacao[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(true)
  const [reviewIndex, setReviewIndex] = useState(0)
  const router = useRouter()

  useEffect(() => {
    api.get<Avaliacao[] | { results: Avaliacao[] }>(`/avaliacoes/?bartender_id=${bartender.user_id}`)
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : data.results
        setReviews(list.slice(0, 5))
      })
      .finally(() => setReviewsLoading(false))
  }, [bartender.user_id])

  const drinks = bartender.drinks ?? []
  const profileImage = resolveMediaUrl(bartender.foto_perfil) ?? PLACEHOLDER_IMAGE
  const hourlyRate = Number(String(bartender.valor_hora ?? 0).replace(",", "."))
  const totalPrice = (Number.isFinite(hourlyRate) ? hourlyRate : 0) * hours
  const ratingText = bartender.media_avaliacoes > 0 ? bartender.media_avaliacoes.toFixed(1).replace(".", ",") : "Novo"
  const reviewsText = bartender.total_avaliacoes > 0 ? `${bartender.total_avaliacoes} avaliações` : "Sem avaliações"
  const ratingSummary = bartender.media_avaliacoes > 0 ? `${ratingText} (${reviewsText})` : reviewsText
  const experienceText = formatExperience(bartender.anos_experiencia) ?? "Experiência não informada"
  const description = bartender.descricao_profissional?.trim() || "Este bartender ainda está completando o perfil profissional."
  const shortDescription = description.length > 260 ? `${description.slice(0, 260)}...` : description

  const profileStats = useMemo(
    () => [
      { icon: <Wine size={16} />, label: "Especialidade", value: formatSpecialty(bartender.especialidades) },
      { icon: <Star size={16} />, label: "Avaliações", value: ratingSummary },
      { icon: <Award size={16} />, label: "Experiência", value: experienceText },
      { icon: <Clock size={16} />, label: "Valor por hora", value: formatCurrency(bartender.valor_hora) },
    ],
    [bartender.especialidades, bartender.valor_hora, experienceText, ratingSummary]
  )

  function handleNegociar() {
    const params = new URLSearchParams({
      bartender: String(bartender.user_id),
      bartenderName: bartender.nome,
      horas: String(hours),
    })
    router.push(`/client/event/choose?${params.toString()}`)
  }

  function handlePreviousDrink() {
    if (drinks.length <= 1) return
    setDrinkIndex((index) => (index - 1 + drinks.length) % drinks.length)
  }

  function handleNextDrink() {
    if (drinks.length <= 1) return
    setDrinkIndex((index) => (index + 1) % drinks.length)
  }

  return (
    <section style={pageStyle}>
      <button onClick={onBack} style={backButtonStyle}>
        <ArrowLeft size={16} />
        Voltar
      </button>

      <div style={singleColumnStyle}>
        <header style={profileCardStyle}>
          <div style={profileIntroStyle}>
            <div style={profileImageFrameStyle}>
              <img
                src={profileImage}
                alt={bartender.nome}
                onError={(event) => {
                  if (!event.currentTarget.src.endsWith(PLACEHOLDER_IMAGE)) {
                    event.currentTarget.src = PLACEHOLDER_IMAGE
                  }
                }}
                style={profileImageStyle}
              />
            </div>

            <div style={profileTextStyle}>
              <span style={specialtyBadgeStyle}>{formatSpecialty(bartender.especialidades)}</span>
              <h1 style={titleStyle}>{bartender.nome}</h1>
              <p style={subtitleStyle}>{experienceText}</p>
            </div>
          </div>

          <div style={statsGridStyle}>
            {profileStats.map((item) => (
              <div key={item.label} style={statCardStyle}>
                <span style={statIconStyle}>{item.icon}</span>
                <span style={statLabelStyle}>{item.label}</span>
                <strong style={statValueStyle}>{item.value}</strong>
              </div>
            ))}
          </div>
        </header>

        <section style={panelStyle}>
          <h2 style={sectionTitleStyle}>Descrição</h2>
          <p style={descriptionTextStyle}>{expanded ? description : shortDescription}</p>
          {description.length > 260 && (
            <button onClick={() => setExpanded((value) => !value)} style={textButtonStyle}>
              {expanded ? "Ver menos" : "Ler mais"}
            </button>
          )}
        </section>

        <section style={drinksPanelStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>Drinks em destaque</h2>
              <p style={sectionSubtitleStyle}>{drinks.length > 0 ? `${drinks.length} drinks cadastrados` : "Nenhum drink cadastrado ainda"}</p>
            </div>

            {drinks.length > 1 && (
              <div style={carouselControlsStyle}>
                <button onClick={handlePreviousDrink} style={navButtonStyle} aria-label="Drink anterior">
                  <ChevronLeft size={16} />
                </button>
                <button onClick={handleNextDrink} style={navButtonStyle} aria-label="Próximo drink">
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>

          {drinks.length > 0 ? (
            <div style={drinkCarouselViewportStyle}>
              <div
                style={{
                  ...drinkCarouselTrackStyle,
                  transform: `translateX(-${drinkIndex * 100}%)`,
                }}
              >
                {drinks.map((drink, index) => {
                  const drinkImageUrl = resolveMediaUrl(drink.foto)
                  const showDrinkImage = drinkImageUrl && !failedDrinkImages.has(drink.id)

                  return (
                    <article key={drink.id} style={drinkSlideStyle}>
                      <div style={drinkImageFrameStyle}>
                        {showDrinkImage ? (
                          <img
                            src={drinkImageUrl}
                            alt={drink.nome}
                            onError={() => {
                              setFailedDrinkImages((failed) => new Set(failed).add(drink.id))
                            }}
                            style={drinkImageStyle}
                          />
                        ) : (
                          <div style={drinkPlaceholderStyle}>
                            <Wine size={34} color="#9CA3AF" />
                          </div>
                        )}
                      </div>

                      <div style={drinkInfoStyle}>
                        <span style={drinkCounterStyle}>{index + 1} de {drinks.length}</span>
                        <p style={drinkNameStyle}>{drink.nome}</p>
                      </div>
                    </article>
                  )
                })}
              </div>

              {drinks.length > 1 && (
                <div style={drinkDotsStyle}>
                  {drinks.map((drink, index) => (
                    <button
                      key={drink.id}
                      onClick={() => setDrinkIndex(index)}
                      style={{
                        ...drinkDotStyle,
                        width: index === drinkIndex ? "22px" : "8px",
                        backgroundColor: index === drinkIndex ? "#F5C518" : "#D1D5DB",
                      }}
                      aria-label={`Ver drink ${drink.nome}`}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={emptyDrinkStyle}>
              <Wine size={34} color="#9CA3AF" />
              <span>Nenhum drink cadastrado ainda.</span>
            </div>
          )}
        </section>

        {/* Avaliações */}
        <section style={panelStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>Avaliações</h2>
              <p style={sectionSubtitleStyle}>
                {bartender.total_avaliacoes > 0
                  ? `${bartender.total_avaliacoes} avaliação${bartender.total_avaliacoes > 1 ? "ões" : ""}`
                  : "Ainda sem avaliações"}
              </p>
            </div>
            {bartender.media_avaliacoes > 0 && (
              <div style={reviewSummaryStyle}>
                <strong style={{ fontSize: "28px", fontWeight: 800, color: "#111827", lineHeight: 1 }}>
                  {bartender.media_avaliacoes.toFixed(1).replace(".", ",")}
                </strong>
                <div style={{ display: "flex", gap: "3px" }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={14}
                      fill={s <= Math.round(bartender.media_avaliacoes) ? "#F5C518" : "none"}
                      color={s <= Math.round(bartender.media_avaliacoes) ? "#F5C518" : "#D1D5DB"}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {reviewsLoading && (
            <p style={{ color: "#9CA3AF", fontSize: "13px", margin: "12px 0 0" }}>Carregando avaliações...</p>
          )}

          {!reviewsLoading && reviews.length === 0 && (
            <div style={emptyReviewsStyle}>
              <Star size={28} color="#D1D5DB" />
              <span>Nenhuma avaliação ainda. Seja o primeiro!</span>
            </div>
          )}

          {!reviewsLoading && reviews.length > 0 && (
            <div style={{ marginTop: "16px" }}>
              {/* Viewport do carrossel */}
              <div style={reviewCarouselViewportStyle}>
                <div style={{ ...reviewCarouselTrackStyle, transform: `translateX(-${reviewIndex * 100}%)` }}>
                  {reviews.map((review) => (
                    <div key={review.id} style={reviewSlideStyle}>
                      <div style={reviewCardStyle}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
                          <div>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: "14px", color: "#111827" }}>
                              {review.cliente_nome.split(" ")[0]}
                            </p>
                            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
                              {review.evento_nome} · {new Date(review.criado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                            </p>
                          </div>
                          <div style={{ display: "flex", gap: "3px" }}>
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                size={13}
                                fill={s <= review.nota ? "#F5C518" : "none"}
                                color={s <= review.nota ? "#F5C518" : "#D1D5DB"}
                              />
                            ))}
                          </div>
                        </div>

                        {review.tags.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
                            {review.tags.map((tag) => (
                              <span key={tag} style={reviewTagStyle}>{tag}</span>
                            ))}
                          </div>
                        )}

                        {review.comentario.trim() && (
                          <p style={{ margin: "10px 0 0", fontSize: "13px", color: "#4B5563", lineHeight: 1.6 }}>
                            "{review.comentario.trim()}"
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Navegação: botões + dots */}
              {reviews.length > 1 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", marginTop: "14px" }}>
                  <button
                    onClick={() => setReviewIndex((i) => Math.max(0, i - 1))}
                    disabled={reviewIndex === 0}
                    style={{ ...navButtonStyle, opacity: reviewIndex === 0 ? 0.35 : 1 }}
                    aria-label="Avaliação anterior"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <div style={{ display: "flex", gap: "7px", alignItems: "center" }}>
                    {reviews.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setReviewIndex(i)}
                        style={{
                          ...drinkDotStyle,
                          width: i === reviewIndex ? "22px" : "8px",
                          backgroundColor: i === reviewIndex ? "#F5C518" : "#D1D5DB",
                        }}
                        aria-label={`Avaliação ${i + 1}`}
                      />
                    ))}
                  </div>

                  <button
                    onClick={() => setReviewIndex((i) => Math.min(reviews.length - 1, i + 1))}
                    disabled={reviewIndex === reviews.length - 1}
                    style={{ ...navButtonStyle, opacity: reviewIndex === reviews.length - 1 ? 0.35 : 1 }}
                    aria-label="Próxima avaliação"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        <section style={bookingPanelStyle}>
          <div>
            <h2 style={sectionTitleStyle}>Contratação</h2>
            <p style={sectionSubtitleStyle}>{formatCurrency(bartender.valor_hora)} por hora</p>
          </div>

          <div style={bookingRowStyle}>
            <div>
              <span style={fieldLabelStyle}>Horas de serviço</span>
              <div style={stepperStyle}>
                <button onClick={() => setHours((value) => Math.max(1, value - 1))} style={stepperButtonStyle} aria-label="Diminuir horas">
                  <Minus size={15} />
                </button>
                <strong style={hoursValueStyle}>{hours}</strong>
                <button onClick={() => setHours((value) => Math.min(24, value + 1))} style={stepperButtonStyle} aria-label="Aumentar horas">
                  <Plus size={15} />
                </button>
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <span style={fieldLabelStyle}>Total estimado</span>
              <strong style={totalPriceStyle}>{formatCurrency(totalPrice)}</strong>
            </div>
          </div>

          <button onClick={handleNegociar} style={primaryButtonStyle}>
            Negociar agora
          </button>
        </section>
      </div>
    </section>
  )
}

const pageStyle: CSSProperties = {
  width: "100%",
  maxWidth: "860px",
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  gap: "18px",
  boxSizing: "border-box",
  overflowX: "hidden",
}

const backButtonStyle: CSSProperties = {
  width: "fit-content",
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  border: "none",
  background: "transparent",
  color: "#6B7280",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
  padding: 0,
}

const singleColumnStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  display: "grid",
  gap: "14px",
}

const profileCardStyle: CSSProperties = {
  padding: "20px",
  border: "1px solid #E5E7EB",
  borderRadius: "12px",
  backgroundColor: "#fff",
  display: "grid",
  gap: "18px",
  minWidth: 0,
  boxSizing: "border-box",
}

const profileIntroStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "18px",
  flexWrap: "wrap",
  minWidth: 0,
}

const profileImageFrameStyle: CSSProperties = {
  width: "150px",
  aspectRatio: "1 / 1",
  flex: "0 0 150px",
  overflow: "hidden",
  borderRadius: "12px",
  border: "1px solid #E5E7EB",
  backgroundColor: "#F3F4F6",
  boxSizing: "border-box",
}

const profileImageStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
}

const profileTextStyle: CSSProperties = {
  flex: "1 1 280px",
  minWidth: 0,
}

const specialtyBadgeStyle: CSSProperties = {
  display: "inline-flex",
  width: "fit-content",
  borderRadius: "999px",
  backgroundColor: "#FFF8D6",
  border: "1px solid #F5C518",
  color: "#6F5300",
  fontSize: "12px",
  fontWeight: 700,
  padding: "5px 10px",
}

const titleStyle: CSSProperties = {
  margin: "10px 0 0",
  color: "#111827",
  fontSize: "28px",
  lineHeight: 1.12,
  fontWeight: 800,
  overflowWrap: "anywhere",
}

const subtitleStyle: CSSProperties = {
  margin: "6px 0 0",
  color: "#6B7280",
  fontSize: "14px",
  lineHeight: 1.4,
}

const statsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
  gap: "10px",
  minWidth: 0,
}

const statCardStyle: CSSProperties = {
  minHeight: "78px",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #F0F0F0",
  backgroundColor: "#FAFAFA",
  display: "grid",
  gap: "4px",
  minWidth: 0,
  boxSizing: "border-box",
}

const statIconStyle: CSSProperties = {
  color: "#8A6D00",
  display: "inline-flex",
}

const statLabelStyle: CSSProperties = {
  color: "#9CA3AF",
  fontSize: "12px",
  fontWeight: 600,
}

const statValueStyle: CSSProperties = {
  color: "#111827",
  fontSize: "14px",
  lineHeight: 1.3,
  overflowWrap: "anywhere",
}

const panelStyle: CSSProperties = {
  padding: "18px 20px",
  border: "1px solid #E5E7EB",
  borderRadius: "12px",
  backgroundColor: "#fff",
  minWidth: 0,
  boxSizing: "border-box",
}

const drinksPanelStyle: CSSProperties = {
  ...panelStyle,
  display: "grid",
  gap: "14px",
}

const sectionHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "12px",
  minWidth: 0,
  flexWrap: "wrap",
}

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  color: "#111827",
  fontSize: "16px",
  fontWeight: 800,
  lineHeight: 1.25,
}

const sectionSubtitleStyle: CSSProperties = {
  margin: "4px 0 0",
  color: "#6B7280",
  fontSize: "13px",
  lineHeight: 1.4,
}

const descriptionTextStyle: CSSProperties = {
  margin: "10px 0 0",
  color: "#4B5563",
  fontSize: "14px",
  lineHeight: 1.7,
  overflowWrap: "anywhere",
}

const textButtonStyle: CSSProperties = {
  marginTop: "8px",
  border: "none",
  background: "transparent",
  padding: 0,
  color: "#B77900",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
}

const carouselControlsStyle: CSSProperties = {
  display: "flex",
  gap: "8px",
}

const drinkCarouselViewportStyle: CSSProperties = {
  position: "relative",
  overflow: "hidden",
  borderRadius: "10px",
  backgroundColor: "#F9FAFB",
  border: "1px solid #F0F0F0",
  minWidth: 0,
}

const drinkCarouselTrackStyle: CSSProperties = {
  display: "flex",
  transition: "transform 280ms ease",
  willChange: "transform",
}

const drinkSlideStyle: CSSProperties = {
  minWidth: "100%",
  padding: "16px",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
  gap: "18px",
  alignItems: "center",
  boxSizing: "border-box",
}

const drinkImageFrameStyle: CSSProperties = {
  width: "100%",
  aspectRatio: "3 / 2",
  minHeight: "220px",
  borderRadius: "10px",
  backgroundColor: "#fff",
  border: "1px solid #E5E7EB",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
}

const drinkImageStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
}

const drinkPlaceholderStyle: CSSProperties = {
  width: "88px",
  height: "88px",
  borderRadius: "18px",
  backgroundColor: "#F3F4F6",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
}

const drinkInfoStyle: CSSProperties = {
  minWidth: 0,
}

const drinkCounterStyle: CSSProperties = {
  display: "inline-flex",
  color: "#8A6D00",
  backgroundColor: "#FFF8D6",
  border: "1px solid #F5C518",
  borderRadius: "999px",
  padding: "4px 9px",
  fontSize: "12px",
  fontWeight: 700,
}

const drinkNameStyle: CSSProperties = {
  margin: "10px 0 0",
  color: "#111827",
  fontSize: "22px",
  fontWeight: 800,
  overflowWrap: "anywhere",
}

const drinkDotsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "7px",
  padding: "0 16px 14px",
}

const drinkDotStyle: CSSProperties = {
  height: "8px",
  border: "none",
  borderRadius: "999px",
  padding: 0,
  cursor: "pointer",
  transition: "width 180ms ease, background-color 180ms ease",
}

const emptyDrinkStyle: CSSProperties = {
  minHeight: "140px",
  border: "1px dashed #D1D5DB",
  borderRadius: "10px",
  color: "#6B7280",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  fontSize: "13px",
}

const navButtonStyle: CSSProperties = {
  width: "32px",
  height: "32px",
  borderRadius: "50%",
  border: "1px solid #E5E7EB",
  backgroundColor: "#fff",
  color: "#374151",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
}

const bookingPanelStyle: CSSProperties = {
  padding: "18px 20px",
  border: "1px solid #E5E7EB",
  borderRadius: "12px",
  backgroundColor: "#fff",
  display: "grid",
  gap: "16px",
  minWidth: 0,
  boxSizing: "border-box",
}

const bookingRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  flexWrap: "wrap",
  minWidth: 0,
}

const fieldLabelStyle: CSSProperties = {
  display: "block",
  color: "#9CA3AF",
  fontSize: "12px",
  fontWeight: 700,
  marginBottom: "8px",
}

const stepperStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "10px",
}

const stepperButtonStyle: CSSProperties = {
  width: "34px",
  height: "34px",
  borderRadius: "50%",
  border: "1px solid #D1D5DB",
  backgroundColor: "#fff",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#111827",
}

const hoursValueStyle: CSSProperties = {
  minWidth: "28px",
  textAlign: "center",
  color: "#111827",
  fontSize: "18px",
}

const totalPriceStyle: CSSProperties = {
  display: "block",
  color: "#111827",
  fontSize: "20px",
  lineHeight: 1.2,
  overflowWrap: "anywhere",
}

const primaryButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: "46px",
  border: "none",
  borderRadius: "10px",
  backgroundColor: "#F5C518",
  color: "#1F1600",
  fontSize: "15px",
  fontWeight: 800,
  cursor: "pointer",
}

const reviewSummaryStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "6px",
}

const reviewCardStyle: CSSProperties = {
  padding: "14px 16px",
  border: "1px solid #F0F0F0",
  borderRadius: "10px",
  backgroundColor: "#FAFAFA",
}

const reviewTagStyle: CSSProperties = {
  display: "inline-flex",
  border: "1px solid #F5C518",
  borderRadius: "999px",
  padding: "3px 10px",
  fontSize: "11px",
  fontWeight: 700,
  color: "#8A6D00",
  backgroundColor: "#FFF8D6",
  letterSpacing: "0.3px",
}

const emptyReviewsStyle: CSSProperties = {
  marginTop: "16px",
  minHeight: "100px",
  border: "1px dashed #D1D5DB",
  borderRadius: "10px",
  color: "#9CA3AF",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  fontSize: "13px",
}
