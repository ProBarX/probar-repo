import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const { token, refresh, role } = await req.json()
  const cookieStore = await cookies()

  cookieStore.set("token", token, { httpOnly: true, secure: true, path: "/" })
  cookieStore.set("refresh", refresh, { httpOnly: true, secure: true, path: "/" })
  cookieStore.set("role", role, { httpOnly: true, secure: true, path: "/" })

  return NextResponse.json({ ok: true })
}