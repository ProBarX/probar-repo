"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

export type UserRole = "cliente" | "bartender"

interface UserRoleContextType {
  role: UserRole
  setRole: (role: UserRole) => void
}

const UserRoleContext = createContext<UserRoleContextType | undefined>(undefined)

export function UserRoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<UserRole>("cliente")

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("probar-role") : null
    if (stored === "bartender" || stored === "cliente") {
      setRoleState(stored)
    }
  }, [])

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole)
    if (typeof window !== "undefined") {
      localStorage.setItem("probar-role", newRole)
    }
  }

  return (
    <UserRoleContext.Provider value={{ role, setRole }}>
      {children}
    </UserRoleContext.Provider>
  )
}

export function useUserRole() {
  const context = useContext(UserRoleContext)
  if (!context) {
    throw new Error("useUserRole must be used within a UserRoleProvider")
  }
  return context
}
