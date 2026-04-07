import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const tipo = request.cookies.get("tipo")?.value
  const token = request.cookies.get("token")?.value
  const path = request.nextUrl.pathname

  // sem login → vai para /login
  if (!token && (path.startsWith("/client") || path.startsWith("/bartender"))) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // bartender tentando acessar rota de cliente
  if (path.startsWith("/client") && tipo !== "cliente") {
    return NextResponse.redirect(new URL("/bartender/home", request.url))
  }

  // cliente tentando acessar rota de bartender
  if (path.startsWith("/bartender") && tipo !== "bartender") {
    return NextResponse.redirect(new URL("/client/home", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/client/:path*", "/bartender/:path*"],
}