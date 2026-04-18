"use client"
import React from "react"
import * as Icons from "lucide-react"

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
  const base = "border rounded-xl p-5 cursor-pointer transition-transform duration-150 ease-in-out"
  const selectedClasses = selected ? "border-2 border-[#FFC105] bg-[#FFFBF0] shadow-md scale-[1.01]" : "border-gray-200 bg-white hover:shadow-md hover:-translate-y-0.5"
  const disabledClasses = disabled ? "opacity-60 cursor-not-allowed" : ""
  const classes = `${base} ${selectedClasses} ${disabledClasses}`

  const iconColor = selected ? "text-[#FFC105]" : "text-gray-400"

  const getIcon = () => {
    const iconName = role === "cliente" ? "User" : "Cocktail"
    // dynamic resolution with fallbacks to avoid build-time missing export errors
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const IconComp = (Icons as any)[iconName] || (Icons as any)["User"]
    return IconComp
  }

  const IconComp = getIcon()

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !disabled && onSelect(role)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') !disabled && onSelect(role) }}
      className={classes}
    >
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 flex items-center justify-center rounded-lg bg-gray-50">
          {IconComp ? <IconComp className={`w-6 h-6 ${iconColor}`} /> : null}
        </div>
        <div className="text-left">
          <div className="font-semibold text-lg">{title}</div>
          {subtitle && <div className="text-sm text-gray-500">{subtitle}</div>}
        </div>
      </div>
    </div>
  )
}

export default RoleSelector
