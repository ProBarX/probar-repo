"use client"

import { useState } from "react"

const categories = ["Todos", "Tradicional", "Mixologista", "Night Club"]

export function CategoryFilter() {
  const [active, setActive] = useState("Todos")

  return (
    <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => setActive(cat)}
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