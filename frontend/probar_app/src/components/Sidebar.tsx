"use client"

import { Home, MessageCircle, Star, Bell, User, LogOut, LucideIcon } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { kaushan } from "@/fonts"

type Role = "cliente" | "bartender"

type NavItem = {
  label: string
  icon: LucideIcon
  href: string
}

const navItems: Record<Role, NavItem[]> = {
  cliente: [
    { label: "Home",         icon: Home,          href: "/client/home" },
    { label: "Chat",         icon: MessageCircle, href: "/client/chat" },
    { label: "Feedback",     icon: Star,          href: "/client/feedback" },
    { label: "Notificações", icon: Bell,          href: "/client/notificacoes" },
  ],
  bartender: [
    { label: "Home",         icon: Home,          href: "/bartender/home" },
    { label: "Chat",         icon: MessageCircle, href: "/bartender/chat" },
    { label: "Feedback",     icon: Star,          href: "/bartender/feedback" },
    { label: "Notificações", icon: Bell,          href: "/bartender/notificacoes" },
  ],
}

export function Sidebar({ tipo }: { tipo: Role }) {
  const pathname = usePathname()
  const router = useRouter()
  const items = navItems[tipo]

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
  }

  return (
    <aside style={{
      width: "220px",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      borderRight: "1px solid #A7A7A7",
    }}>

      {/* Logo */}
      <div className={kaushan.className} style={{
        fontSize: "28px",
        margin: "24px 16px 32px",
        textAlign: "center",
      }}>
        ProBar
      </div>

      {/* Nav */}
      <nav style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1, padding: "0 16px" }}>
        {items.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "10px 14px",
                borderRadius: "10px",
                textDecoration: "none",
                border: "1px solid #A7A7A7",
                backgroundColor: isActive ? "#F5C518" : "#fff",
                color: "#000",
                fontWeight: isActive ? "600" : "400",
              }}
            >
              {/* Ícone com fundo circular quando ativo */}
              <div style={{
                width: "32px",
                height: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                }}>
                <item.icon size={18} color="#000" />
              </div>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Divisor + Botões de baixo */}
      <div>
        <div style={{ borderTop: "1px solid #A7A7A7", marginBottom: "12px" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "0 16px 24px" }}>
          <Link
            href={`/${tipo}/perfil`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              textDecoration: "none",
              color: "#444",
              padding: "6px 4px",
            }}
          >
            <div style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              border: "1px solid #A7A7A7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}>
              <User size={16} color="#444" />
            </div>
            <span style={{ fontSize: "14px" }}>Meu perfil</span>
          </Link>

          <button
            onClick={handleLogout}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#444",
              padding: "6px 4px",
            }}
          >
            <div style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              border: "1px solid #A7A7A7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}>
              <LogOut size={16} color="#444" />
            </div>
            <span style={{ fontSize: "14px" }}>Sair</span>
          </button>
        </div>
      </div>

    </aside>
  )
}