import { cookies } from "next/headers"
import { BartenderLayoutWrapper } from "@/components/bartender/BartenderLayoutWrapper"

export default async function BartenderLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const tipo = (cookieStore.get("tipo")?.value as "cliente" | "bartender") ?? "bartender"

  return <BartenderLayoutWrapper tipo={tipo}>{children}</BartenderLayoutWrapper>
}
