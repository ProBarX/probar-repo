import { cookies } from "next/headers"
import { ClientLayoutWrapper } from "@/components/client/ClientLayoutWrapper"

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const tipo = cookieStore.get("tipo")?.value as "cliente" | "bartender" ?? "cliente"

  return <ClientLayoutWrapper tipo={tipo}>{children}</ClientLayoutWrapper>
}
