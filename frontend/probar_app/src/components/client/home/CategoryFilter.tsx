"use client"

const categories = ["Todos", "Tradicional", "Mixologista", "Night Club", "Showman"]

type CategoryFilterProps = {
  active: string
  onChange: (category: string) => void
}

export function CategoryFilter({ active, onChange }: CategoryFilterProps) {
  return (
    <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onChange(cat)}
          style={{
            padding: "8px 20px",
            borderRadius: "20px",
            border: "1px solid #ddd",
            backgroundColor: active === cat ? "#F5C518" : "#fff",
            fontWeight: active === cat ? "600" : "400",
            cursor: "pointer",
          }}
        >
          {cat}
        </button>
      ))}
    </div>
  )
}