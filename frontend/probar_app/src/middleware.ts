import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const role = request.cookies.get("role")?.value
  const token = request.cookies.get("token")?.value
  const path = request.nextUrl.pathname

  // sem login → vai para /login
  if (!token && (path.startsWith("/client") || path.startsWith("/bartender"))) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // bartender tentando acessar rota de cliente
  if (path.startsWith("/client") && role !== "cliente") {
    return NextResponse.redirect(new URL("/bartender/home", request.url))
  }

  // cliente tentando acessar rota de bartender
  if (path.startsWith("/bartender") && role !== "bartender") {
    return NextResponse.redirect(new URL("/client/home", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/client/:path*", "/bartender/:path*"],
}