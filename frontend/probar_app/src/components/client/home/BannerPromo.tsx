export function BannerPromo() {
  return (
    <div style={{
      backgroundColor: "#1a1a1a",
      borderRadius: "12px",
      padding: "24px",
      marginBottom: "24px",
      position: "relative",
      overflow: "hidden",
    }}>
      <span style={{
        backgroundColor: "#e53e3e",
        color: "#fff",
        padding: "4px 10px",
        borderRadius: "6px",
        fontSize: "12px",
        fontWeight: "bold",
      }}>
        Promo
      </span>
      <h2 style={{ color: "#F5C518", fontSize: "28px", margin: "8px 0 4px" }}>
        10% de desconto
      </h2>
      <p style={{ color: "#fff" }}>Na sua primeira contratação</p>
    </div>
  )
}