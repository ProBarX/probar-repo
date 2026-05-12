"use client"

import { usePathname } from "next/navigation"
import { Sidebar } from "@/components/Sidebar"

export function ClientLayoutWrapper({
  tipo,
  children,
}: {
  tipo: "cliente" | "bartender"
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isCompletePage = pathname === "/client/complete"

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        backgroundColor: isCompletePage ? "#f5f5f5" : "#FAFAFA",
      }}
    >
      {!isCompletePage && <Sidebar tipo={tipo} />}
      <main
        style={{
          flex: 1,
          overflowY: "auto",
          padding: isCompletePage ? 0 : "24px",
        }}
      >
        {children}
      </main>
    </div>
  )
}
