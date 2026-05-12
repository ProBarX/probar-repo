"use client"

import { Bell, Home, LogOut, MessageCircle, Star, User, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { kaushan } from "@/fonts"
import { clearTokenCache } from "@/services/api"

type Role = "cliente" | "bartender"

type NavItem = {
  label: string
  icon: LucideIcon
  href: string
}

const navItems: Record<Role, NavItem[]> = {
  cliente: [
    { label: "Home", icon: Home, href: "/client/home" },
    { label: "Chat", icon: MessageCircle, href: "/client/chat" },
    { label: "Feedback", icon: Star, href: "/client/feedback" },
    { label: "Notificacoes", icon: Bell, href: "/client/notificacoes" },
  ],
  bartender: [
    { label: "Home", icon: Home, href: "/bartender/home" },
    { label: "Chat", icon: MessageCircle, href: "/bartender/chat" },
    { label: "Feedback", icon: Star, href: "/bartender/feedback" },
    { label: "Notificacoes", icon: Bell, href: "/bartender/notificacoes" },
  ],
}

const routePrefix: Record<Role, string> = {
  cliente: "client",
  bartender: "bartender",
}

const PRIMARY_YELLOW = "#F5C518"

export function Sidebar({ tipo }: { tipo: Role }) {
  const pathname = usePathname()
  const router = useRouter()
  const items = navItems[tipo]
  const prefix = routePrefix[tipo]

  async function handleLogout() {
    clearTokenCache()
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
  }

  const isPerfilActive = pathname === `/${prefix}/profile`

  return (
    <aside
      style={{
        width: "260px",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid #EEEEEE",
        background: "#FFFFFF",
        flexShrink: 0,
      }}
    >
      <div
        className={kaushan.className}
        style={{
          fontSize: "40px",
          margin: "24px 18px 36px",
          textAlign: "center",
          lineHeight: 1.1,
          color: "#1F2933",
        }}
      >
        ProBar
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1, padding: "0 14px" }}>
        {items.map((item) => {
          const isActive = pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                height: "44px",
                gap: "12px",
                padding: "0 14px",
                borderRadius: "8px",
                textDecoration: "none",
                border: isActive ? "1px solid #F1D46A" : "1px solid transparent",
                borderLeft: isActive ? `4px solid ${PRIMARY_YELLOW}` : "4px solid transparent",
                backgroundColor: isActive ? "#FFF8DB" : "#FFFFFF",
                color: isActive ? "#1a1a1a" : "#5F6368",
                fontWeight: isActive ? 700 : 500,
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  width: "24px",
                  height: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <item.icon size={21} color={isActive ? "#1a1a1a" : "#6B7280"} />
              </div>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div>
        <div style={{ borderTop: "1px solid #EEEEEE", marginBottom: "16px" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "0 22px 24px" }}>
          <Link
            href={`/${prefix}/profile`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              textDecoration: "none",
              color: isPerfilActive ? "#1a1a1a" : "#6D6D6D",
              fontWeight: 600,
              padding: 0,
            }}
          >
            <div
              style={{
                width: "25px",
                height: "25px",
                borderRadius: "50%",
                border: "1px solid #E5E5E5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <User size={15} color="#6D6D6D" />
            </div>
            <span style={{ fontSize: "14px" }}>Meu perfil</span>
          </Link>

          <button
            onClick={handleLogout}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#6D6D6D",
              padding: 0,
              fontWeight: 600,
            }}
          >
            <div
              style={{
                width: "25px",
                height: "25px",
                borderRadius: "50%",
                border: "1px solid #E5E5E5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <LogOut size={15} color="#6D6D6D" />
            </div>
            <span style={{ fontSize: "14px" }}>Sair</span>
          </button>
        </div>
      </div>
    </aside>
  )
}
