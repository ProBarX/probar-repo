/**
 * Layout dedicado para a rota de chat.
 * Mantem o chat ocupando toda a area util do main, enquanto o layout pai
 * conserva a sidebar da aplicacao recolhida ao lado.
 */
export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        height: "100%",
        minHeight: 0,
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  )
}
