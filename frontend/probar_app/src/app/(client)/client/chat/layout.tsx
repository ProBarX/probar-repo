/**
 * app/(client)/client/chat/layout.tsx
 *
 * Layout dedicado para a rota de chat.
 * Sobrescreve o layout pai — remove padding, sidebar e qualquer wrapper,
 * deixando a página ocupar 100vw × 100vh.
 *
 * Se o seu layout raiz aplica uma sidebar como:
 *   <Sidebar />
 *   <main style={{ padding: "..." }}>{children}</main>
 *
 * Basta este arquivo existir na pasta da rota — o Next.js usa o layout
 * mais próximo, então o chat terá o seu próprio, sem herdar o padding.
 */

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 50,
      background: "#fff",
      display: "flex",
      flexDirection: "column",
    }}>
      {children}
    </div>
  )
}