import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const tipo = request.cookies.get("tipo")?.value
  const token = request.cookies.get("token")?.value
  const refresh = request.cookies.get("refresh")?.value
  const path = request.nextUrl.pathname
  const isProtectedRoute = path.startsWith("/client") || path.startsWith("/bartender")

  // sem login → vai para /login
  if (!token && !refresh && isProtectedRoute) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // bartender tentando acessar rota de cliente
  if (tipo && path.startsWith("/client") && tipo !== "cliente") {
    return NextResponse.redirect(new URL("/bartender/home", request.url))
  }

  // cliente tentando acessar rota de bartender
  if (tipo && path.startsWith("/bartender") && tipo !== "bartender") {
    return NextResponse.redirect(new URL("/client/home", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/client/:path*", "/bartender/:path*"],
}
