"use client"

import { usePathname } from "next/navigation"
import { Sidebar } from "@/components/Sidebar"

export function BartenderLayoutWrapper({
  tipo,
  children,
}: {
  tipo: "cliente" | "bartender"
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isCompletePage = pathname === "/bartender/complete"

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: isCompletePage ? "#f5f5f5" : "#F8FAFC" }}>
      {!isCompletePage && <Sidebar tipo={tipo} />}
      <main
        style={{
          flex: 1,
          minWidth: 0,
          overflowX: "hidden",
          overflowY: "auto",
          padding: isCompletePage ? "0" : "24px 24px 32px",
        }}
      >
        {children}
      </main>
    </div>
  )
}
