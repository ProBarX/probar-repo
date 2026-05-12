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
  const isChatPage = pathname === "/bartender/chat"

  return (
    <div
      style={{
        display: "flex",
        height: "100dvh",
        minHeight: "100vh",
        overflow: "hidden",
        backgroundColor: isCompletePage ? "#f5f5f5" : "#F8FAFC",
      }}
    >
      {!isCompletePage && <Sidebar tipo={tipo} forceCollapsed={isChatPage} />}
      <main
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          overflowX: "hidden",
          overflowY: isChatPage ? "hidden" : "auto",
          padding: isCompletePage || isChatPage ? "0" : "24px 24px 32px",
        }}
      >
        {children}
      </main>
    </div>
  )
}
