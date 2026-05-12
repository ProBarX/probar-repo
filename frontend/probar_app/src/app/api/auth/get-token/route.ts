import { cookies } from "next/headers"
import { NextResponse } from "next/server"

const ACCESS_TOKEN_MAX_AGE = 60 * 10

function tokenExpiresSoon(token?: string) {
  if (!token) return true

  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"))
    const exp = typeof payload.exp === "number" ? payload.exp : 0
    const now = Math.floor(Date.now() / 1000)

    return exp <= now + 30
  } catch {
    return true
  }
}

async function refreshAccessToken(refresh: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
  const res = await fetch(`${apiUrl}/api/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  })

  if (!res.ok) return null

  const data = await res.json()
  return typeof data.access === "string" ? data.access : null
}

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get("token")?.value
  const refresh = cookieStore.get("refresh")?.value

  if (!tokenExpiresSoon(token)) {
    return NextResponse.json({ token })
  }

  if (!refresh) {
    cookieStore.delete("token")
    cookieStore.delete("tipo")
    return NextResponse.json({ token: null }, { status: 401 })
  }

  const newToken = await refreshAccessToken(refresh)

  if (!newToken) {
    cookieStore.delete("token")
    cookieStore.delete("refresh")
    cookieStore.delete("tipo")
    return NextResponse.json({ token: null }, { status: 401 })
  }

  cookieStore.set("token", newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_TOKEN_MAX_AGE,
  })

  return NextResponse.json({ token: newToken })
}
