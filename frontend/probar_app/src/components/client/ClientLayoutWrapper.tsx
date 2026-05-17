"use client"

import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
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
  const [hideSidebarForChat, setHideSidebarForChat] = useState(false)
  const shouldHideSidebar = isChatPage && hideSidebarForChat

  useEffect(() => {
    if (!isChatPage) return

    const handleChatMobileState = (event: Event) => {
      const detail = (event as CustomEvent<{ open?: boolean }>).detail
      setHideSidebarForChat(Boolean(detail?.open))
    }

    window.addEventListener("probar:chat-mobile-state", handleChatMobileState)
    const frame = window.requestAnimationFrame(() => {
      setHideSidebarForChat(document.body.dataset.probarChatMobileOpen === "true")
    })

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener("probar:chat-mobile-state", handleChatMobileState)
    }
  }, [isChatPage])

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
      {!isCompletePage && !shouldHideSidebar && <Sidebar tipo={tipo} forceCollapsed={isChatPage} />}
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
