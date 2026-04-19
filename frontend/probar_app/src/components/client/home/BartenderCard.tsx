type BartenderCardProps = {
  name: string
  specialty: string
  price: number
  rating: number
  image: string
  onSelect?: () => void
}

export function BartenderCard({ name, specialty, price, rating, image, onSelect }: BartenderCardProps) {
  return (
    <div style={{
      borderRadius: "12px",
      overflow: "hidden",
      border: "1px solid #eee",
      backgroundColor: "#fff",
    }}>
      <div style={{ position: "relative" }}>
        <img src={image} alt={name} style={{ width: "100%", height: "160px", objectFit: "cover" }} />
        <span style={{
          position: "absolute",
          top: "8px",
          right: "8px",
          backgroundColor: "#fff",
          borderRadius: "20px",
          padding: "2px 8px",
          fontSize: "12px",
          fontWeight: "bold",
        }}>
          ⭐ {rating}
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
