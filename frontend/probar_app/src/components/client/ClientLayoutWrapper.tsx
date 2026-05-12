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
  const isChatPage = pathname === "/client/chat"

  return (
    <div
      style={{
        display: "flex",
        height: "100dvh",
        minHeight: "100vh",
        overflow: "hidden",
        backgroundColor: isCompletePage ? "#f5f5f5" : "#FAFAFA",
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
          padding: isCompletePage || isChatPage ? 0 : "24px",
        }}
      >
        {children}
      </main>
    </div>
  )
}
