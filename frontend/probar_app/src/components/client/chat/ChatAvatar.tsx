"use client"

import { resolveMediaUrl } from "@/lib/media-url"

type Props = {
  name?: string | null
  src?: string | null
  color: string
  size?: number
}

export function ChatAvatar({ name, src, color, size = 44 }: Props) {
  const imageUrl = resolveMediaUrl(src)
  const initial = name?.trim()?.[0]?.toUpperCase() ?? "?"

  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: imageUrl ? "#F5F5F5" : color,
        backgroundImage: imageUrl ? `url(${imageUrl})` : undefined,
        backgroundPosition: "center",
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontWeight: 600,
        fontSize: size >= 44 ? "15px" : "14px",
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      {!imageUrl && initial}
    </div>
  )
}
