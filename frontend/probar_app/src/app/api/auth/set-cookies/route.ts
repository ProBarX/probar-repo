import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const { token, refresh, tipo } = await req.json()
  const cookieStore = await cookies()
  const secure = process.env.NODE_ENV === "production"

  cookieStore.set("token", token, { httpOnly: true, secure, path: "/" })
  cookieStore.set("refresh", refresh, { httpOnly: true, secure, path: "/" })
  cookieStore.set("tipo", tipo, { httpOnly: true, secure, path: "/" })

  return NextResponse.json({ ok: true })
}
