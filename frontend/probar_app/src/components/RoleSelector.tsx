"use client"
import React from "react"
import * as Icons from "lucide-react"
import type { LucideIcon } from "lucide-react"

type Role = "cliente" | "bartender"

interface Props {
  role: Role
  title: string
  subtitle?: string
  selected?: boolean
  disabled?: boolean
  onSelect: (role: Role) => void
}

export function RoleSelector({ role, title, subtitle, selected = false, disabled = false, onSelect }: Props) {
  const base = "w-full md:flex-1 flex items-center gap-3 border rounded-xl px-4 py-3 text-sm transition"
  const selectedClasses = selected ? "border-[#F5C518] bg-yellow-50 text-gray-900" : "border-gray-200 text-gray-600 hover:border-gray-300"
  const disabledClasses = disabled ? "opacity-60 cursor-not-allowed" : ""
  const classes = `${base} ${selectedClasses} ${disabledClasses}`

  const iconName = role === "cliente" ? "User" : "Wine"
  const IconComp = (Icons[iconName as keyof typeof Icons] as LucideIcon) || (Icons.User as LucideIcon)

  return (
    <button
      type="button"
      data-testid={`role-selector-${role}`}
      onClick={() => !disabled && onSelect(role)}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !disabled) onSelect(role) }}
      className={classes}
    >
      <IconComp className="h-5 w-5 text-[#F5C518] flex-shrink-0" />
      <div className="text-left">
        <p className="font-medium text-sm md:whitespace-nowrap">{title}</p>
        {subtitle && <p className="text-xs text-gray-400 md:whitespace-nowrap">{subtitle}</p>}
      </div>
    </button>
  )
}

export default RoleSelector
