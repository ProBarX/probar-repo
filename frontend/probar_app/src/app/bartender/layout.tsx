import { cookies } from "next/headers"
import { Sidebar } from "@/components/Sidebar"

export default async function BartenderLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const tipo = (cookieStore.get("tipo")?.value as "cliente" | "bartender") ?? "bartender"

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#F8FAFC" }}>
      <Sidebar tipo={tipo} />
      <main style={{ flex: 1, overflowY: "auto", padding: "24px 24px 32px" }}>
        {children}
      </main>
    </div>
  )
}
