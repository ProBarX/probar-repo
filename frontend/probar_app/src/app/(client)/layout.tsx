import { cookies } from "next/headers"
import { Sidebar } from "@/components/Sidebar"

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const role = cookieStore.get("role")?.value as "cliente" | "bartender" ?? "cliente"

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <Sidebar role={role} />
      <main style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
        {children}
      </main>
    </div>
  )
}