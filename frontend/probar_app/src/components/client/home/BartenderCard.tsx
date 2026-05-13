import { formatCurrency, formatExperience, formatSpecialty } from "@/lib/bartender-format"

type BartenderCardProps = {
  name: string
  specialty: string
  price: number | string
  rating: number
  totalReviews: number
  image: string
  experience?: number | null
  description?: string | null
  onSelect?: () => void
}

export function BartenderCard({
  name,
  specialty,
  price,
  rating,
  totalReviews,
  image,
  experience,
  description,
  onSelect,
}: BartenderCardProps) {
  const ratingText = rating > 0 ? rating.toFixed(1) : "Novo"
  const reviewsText = totalReviews > 0 ? ` (${totalReviews})` : ""
  const experienceText = formatExperience(experience)
  const descriptionText = description?.trim() || "Perfil em atualização."

  return (
    <div style={{
      borderRadius: "12px",
      overflow: "hidden",
      border: "1px solid #eee",
      backgroundColor: "#fff",
      display: "flex",
      flexDirection: "column",
      height: "100%",
    }}>
      <div
        style={{
          position: "relative",
          aspectRatio: "4 / 3",
          backgroundColor: "#F3F4F6",
          flexShrink: 0,
        }}
      >
        <img
          src={image}
          alt={name}
          onError={(event) => {
            if (!event.currentTarget.src.endsWith("/bartender-placeholder.svg")) {
              event.currentTarget.src = "/bartender-placeholder.svg"
            }
          }}
          style={{ width: "100%", height: "100%", display: "block", objectFit: "cover", objectPosition: "center" }}
        />
        <span style={ratingBadgeStyle}>
          <span style={ratingStarStyle}>{"\u2605"}</span>
          {ratingText}{reviewsText}
        </span>
      </div>

      <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
        <div>
          <p style={{ fontWeight: "700", margin: 0, color: "#111827", lineHeight: 1.25 }}>{name}</p>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "6px" }}>
            <span style={specialtyBadgeStyle}>{formatSpecialty(specialty)}</span>
            {experienceText && <span style={experienceStyle}>{experienceText}</span>}
          </div>
        </div>

        <p style={descriptionStyle}>{descriptionText}</p>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginTop: "auto" }}>
          <span style={{ fontWeight: "700", color: "#111827", whiteSpace: "nowrap" }}>{formatCurrency(price)}</span>
          <button
            onClick={onSelect}
            aria-label={`Ver perfil de ${name}`}
            style={{
              backgroundColor: "#F5C518",
              border: "none",
              borderRadius: "50%",
              width: "28px",
              height: "28px",
              fontSize: "18px",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            +
          </button>
        </div>
      </div>
    </div>
  )
}

const ratingBadgeStyle = {
  position: "absolute" as const,
  top: "8px",
  right: "8px",
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  backgroundColor: "#FFF7D6",
  border: "1px solid #F5C518",
  borderRadius: "20px",
  padding: "3px 9px",
  color: "#111827",
  fontSize: "12px",
  fontWeight: "bold",
}

const ratingStarStyle = {
  color: "#F5C518",
  lineHeight: 1,
}

const specialtyBadgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: "22px",
  borderRadius: "999px",
  backgroundColor: "#F3F4F6",
  color: "#374151",
  fontSize: "12px",
  fontWeight: 600,
  padding: "3px 9px",
}

const experienceStyle = {
  color: "#6B7280",
  fontSize: "12px",
  lineHeight: 1.3,
}

const descriptionStyle = {
  minHeight: "40px",
  margin: 0,
  color: "#6B7280",
  fontSize: "13px",
  lineHeight: 1.5,
  display: "-webkit-box",
  WebkitBoxOrient: "vertical" as const,
  WebkitLineClamp: 2,
  overflow: "hidden",
}
