"use client"

import { Bell, Home, LogOut, MessageCircle, SidebarIcon as SidebarToggleIcon, Star, User, type LucideIcon } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState, type CSSProperties } from "react"
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
const SIDEBAR_OPEN_WIDTH = 272
const SIDEBAR_CLOSED_WIDTH = 72

export function Sidebar({ tipo, forceCollapsed = false }: { tipo: Role; forceCollapsed?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const items = navItems[tipo]
  const prefix = routePrefix[tipo]
  const [isOpenState, setIsOpenState] = useState(true)
  const isOpen = forceCollapsed ? false : isOpenState

  function toggleSidebar() {
    if (forceCollapsed) return
    setIsOpenState((current) => !current)
  }

  async function handleLogout() {
    clearTokenCache()
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
  }

  const isPerfilActive = pathname === `/${prefix}/profile`
  const toggleLabel = forceCollapsed ? "Menu recolhido" : isOpen ? "Recolher menu" : "Abrir menu"

  return (
    <aside
      style={{
        width: isOpen ? `${SIDEBAR_OPEN_WIDTH}px` : `${SIDEBAR_CLOSED_WIDTH}px`,
        height: "100dvh",
        maxHeight: "100dvh",
        minHeight: "100vh",
        position: "sticky",
        top: 0,
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid #EEEEEE",
        background: "#FFFFFF",
        flexShrink: 0,
        overflow: "hidden",
        transition: "width 180ms ease",
        boxSizing: "border-box",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: isOpen ? "space-between" : "center",
          gap: "12px",
          padding: isOpen ? "18px 14px 24px 18px" : "18px 10px 24px",
          flexShrink: 0,
          boxSizing: "border-box",
        }}
      >
        {isOpen && (
          <div
            className={kaushan.className}
            style={{
              fontSize: "38px",
              lineHeight: 1.1,
              color: "#1F2933",
              whiteSpace: "nowrap",
            }}
          >
            ProBar
          </div>
        )}

        <button
          type="button"
          onClick={toggleSidebar}
          title={toggleLabel}
          aria-label={toggleLabel}
          aria-expanded={isOpen}
          aria-disabled={forceCollapsed}
          style={{
            ...iconButtonStyle,
            cursor: forceCollapsed ? "default" : "pointer",
          }}
        >
          {isOpen ? (
            <SidebarToggleIcon size={21} />
          ) : (
            <Image src="/probar-logo.jpeg" alt="ProBar" width={38} height={38} style={compactLogoStyle} />
          )}
        </button>
      </header>

      <nav
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          padding: isOpen ? "0 12px" : "0 10px",
          boxSizing: "border-box",
        }}
      >
        {items.map((item) => {
          const isActive = pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: isOpen ? "flex-start" : "center",
                height: "44px",
                gap: "12px",
                padding: isOpen ? "0 12px" : 0,
                borderRadius: "8px",
                textDecoration: "none",
                border: isActive ? "1px solid #F1D46A" : "1px solid transparent",
                borderLeft: isActive && isOpen ? `4px solid ${PRIMARY_YELLOW}` : "1px solid transparent",
                backgroundColor: isActive ? "#FFF8DB" : "#FFFFFF",
                color: isActive ? "#1a1a1a" : "#5F6368",
                fontWeight: isActive ? 700 : 500,
                fontSize: "14px",
                boxSizing: "border-box",
                transition: "background-color 160ms ease, border-color 160ms ease",
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
              {isOpen && <span style={labelStyle}>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      <div
        style={{
          borderTop: "1px solid #EEEEEE",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          padding: isOpen
            ? "16px 18px max(24px, env(safe-area-inset-bottom))"
            : "14px 10px max(20px, env(safe-area-inset-bottom))",
          flexShrink: 0,
          boxSizing: "border-box",
          background: "#FFFFFF",
        }}
      >
        <Link
          href={`/${prefix}/profile`}
          title="Meu Perfil"
          style={footerActionStyle(isOpen, isPerfilActive)}
        >
          <div style={footerIconStyle}>
            <User size={15} color="#6D6D6D" />
          </div>
          {isOpen && <span style={{ ...labelStyle, fontSize: "14px" }}>Meu Perfil</span>}
        </Link>

        <button
          type="button"
          onClick={handleLogout}
          title="Sair"
          style={{
            ...footerActionStyle(isOpen, false),
            background: "none",
            border: "none",
            cursor: "pointer",
            font: "inherit",
          }}
        >
          <div style={footerIconStyle}>
            <LogOut size={15} color="#6D6D6D" />
          </div>
          {isOpen && <span style={{ ...labelStyle, fontSize: "14px" }}>Sair</span>}
        </button>
      </div>
    </aside>
  )
}

const iconButtonStyle: CSSProperties = {
  width: "44px",
  height: "44px",
  borderRadius: "8px",
  border: "none",
  background: "transparent",
  color: "#4B5563",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  flexShrink: 0,
}

const compactLogoStyle: CSSProperties = {
  width: "38px",
  height: "38px",
  borderRadius: "7px",
  display: "block",
  objectFit: "cover",
}

const labelStyle: CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
}

const footerIconStyle: CSSProperties = {
  width: "25px",
  height: "25px",
  borderRadius: "50%",
  border: "1px solid #E5E5E5",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
}

function footerActionStyle(isOpen: boolean, isActive: boolean): CSSProperties {
  return {
    width: "100%",
    minHeight: "42px",
    display: "flex",
    alignItems: "center",
    justifyContent: isOpen ? "flex-start" : "center",
    gap: "14px",
    borderRadius: "8px",
    textDecoration: "none",
    color: isActive ? "#1a1a1a" : "#6D6D6D",
    fontWeight: 600,
    padding: isOpen ? "0 8px" : 0,
    boxSizing: "border-box",
  }
}
