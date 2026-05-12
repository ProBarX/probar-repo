import { cookies } from "next/headers"
import { NextResponse } from "next/server"

const ACCESS_TOKEN_MAX_AGE = 60 * 10
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24

export async function POST(req: Request) {
  const { token, refresh, tipo } = await req.json()
  const cookieStore = await cookies()
  const secure = process.env.NODE_ENV === "production"
  const cookieOptions = {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
  }

  cookieStore.set("token", token, { ...cookieOptions, maxAge: ACCESS_TOKEN_MAX_AGE })
  cookieStore.set("refresh", refresh, { ...cookieOptions, maxAge: REFRESH_TOKEN_MAX_AGE })
  cookieStore.set("tipo", tipo, { ...cookieOptions, maxAge: REFRESH_TOKEN_MAX_AGE })

  return NextResponse.json({ ok: true })
}
