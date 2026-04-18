import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { clearTokenCache } from "@/services/api"

export async function POST() {
  const cookieStore = await cookies()

  cookieStore.delete("token")
  cookieStore.delete("refresh")
  cookieStore.delete("tipo")

  clearTokenCache()

  return NextResponse.json({ ok: true })
}