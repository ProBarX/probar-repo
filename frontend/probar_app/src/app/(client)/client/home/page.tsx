import { BannerPromo } from "@/components/client/home/BannerPromo"
import { CategoryFilter } from "@/components/client/home/CategoryFilter"
import { BartenderCard } from "@/components/client/home/BartenderCard"

const mockBartenders = [
  { id: 1, name: "Fulano",   specialty: "Tradicional", price: 600,  rating: 4.5, image: "/bartender1.jpg" },
  { id: 2, name: "Cicrano",  specialty: "Showman",     price: 1200, rating: 4.5, image: "/bartender2.jpg" },
  { id: 3, name: "Beltrano", specialty: "Mixologista", price: 1000, rating: 4.5, image: "/bartender3.jpg" },
  { id: 4, name: "Fulano",   specialty: "Tradicional", price: 600,  rating: 4.5, image: "/bartender1.jpg" },
  { id: 5, name: "Cicrano",  specialty: "Showman",     price: 1200, rating: 4.5, image: "/bartender2.jpg" },
  { id: 6, name: "Beltrano", specialty: "Mixologista", price: 1000, rating: 4.5, image: "/bartender3.jpg" },
  { id: 7, name: "Fulano",   specialty: "Tradicional", price: 600,  rating: 4.5, image: "/bartender1.jpg" },
  { id: 8, name: "Cicrano",  specialty: "Showman",     price: 1200, rating: 4.5, image: "/bartender2.jpg" },
  { id: 9, name: "Beltrano", specialty: "Mixologista", price: 1000, rating: 4.5, image: "/bartender3.jpg" },
]

export default function HomePage() {
  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <p style={{ color: "#888", margin: 0, fontSize: "14px" }}>Localização</p>
          <p style={{ margin: 0, fontWeight: "600" }}>Patos, Paraíba ↓</p>
          <h1 style={{ margin: "4px 0 0" }}>Encontre seu Bartender</h1>
        </div>
        <input
          type="text"
          placeholder="🔍 Procurar bartenders"
          style={{
            padding: "10px 16px",
            borderRadius: "8px",
            border: "1px solid #ddd",
            width: "280px",
          }}
        />
      </div>

      <BannerPromo />
      <CategoryFilter />

      {/* Grid de bartenders */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "16px",
      }}>
        {mockBartenders.map((b) => (
          <BartenderCard key={b.id} {...b} />
        ))}
      </div>
    </div>
  )
}