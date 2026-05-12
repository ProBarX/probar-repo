type BartenderCardProps = {
  name: string
  specialty: string
  price: number
  rating: number
  totalReviews: number
  image: string
  onSelect?: () => void
}

export function BartenderCard({ name, specialty, price, rating, totalReviews, image, onSelect }: BartenderCardProps) {
  const ratingText = rating > 0 ? rating.toFixed(1) : "Novo"
  const reviewsText = totalReviews > 0 ? ` (${totalReviews})` : ""

  return (
    <div style={{
      borderRadius: "12px",
      overflow: "hidden",
      border: "1px solid #eee",
      backgroundColor: "#fff",
    }}>
      <div style={{ position: "relative" }}>
        <img src={image} alt={name} style={{ width: "100%", height: "160px", objectFit: "cover" }} />
        <span style={ratingBadgeStyle}>
          <span style={ratingStarStyle}>{"\u2605"}</span>
          {ratingText}{reviewsText}
        </span>
      </div>

      <div style={{ padding: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ fontWeight: "600", margin: 0 }}>{name}</p>
          <p style={{ color: "#888", fontSize: "12px", margin: 0 }}>{specialty}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontWeight: "600" }}>{price} R$</span>
          <button
            onClick={onSelect}
            style={{
              backgroundColor: "#F5C518",
              border: "none",
              borderRadius: "50%",
              width: "28px",
              height: "28px",
              fontSize: "18px",
              cursor: "pointer",
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
