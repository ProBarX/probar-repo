const tabs = [
  { label: "Todos", active: true },
  { label: "Pendentes", active: false },
  { label: "Aceitos", active: false },
  { label: "Cancelados", active: false },
  { label: "Pagos", active: false },
  { label: "Concluídos", active: false },
]

const orders = [
  {
    id: "Pedido #1",
    client: "Nome Cliente",
    date: "26/02/2026",
    schedule: "19 - 4hrs",
    address: "Ruas dos Alfaneiros, nº 4",
    amount: "R$ 2.400",
    status: "Pendente",
    action: "Aceitar",
  },
  {
    id: "Pedido #2",
    client: "Nome Cliente",
    date: "26/02/2026",
    schedule: "20 - 2hrs",
    address: "Ruas dos Alfaneiros, nº 4",
    amount: "R$ 1.800",
    status: "Pendente",
    action: "Aceitar",
  },
  {
    id: "Pedido #3",
    client: "Nome Cliente",
    date: "26/02/2026",
    schedule: "18 - 5hrs",
    address: "Ruas dos Alfaneiros, nº 4",
    amount: "R$ 3.000",
    status: "Aceito",
    action: "Detalhes",
  },
  {
    id: "Pedido #4",
    client: "Nome Cliente",
    date: "26/02/2026",
    schedule: "18 - 3hrs",
    address: "Ruas dos Alfaneiros, nº 4",
    amount: "R$ 1.800",
    status: "Concluído",
    action: "Feedback",
  },
]

function statusStyle(status: string) {
  const base = {
    padding: "6px 12px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
  } as const

  if (status === "Pendente") return { ...base, backgroundColor: "#E5E7EB", color: "#374151" }
  if (status === "Aceito") return { ...base, backgroundColor: "#FDE68A", color: "#78350F" }
  if (status === "Concluído") return { ...base, backgroundColor: "#ECFDF5", color: "#166534" }
  if (status === "Cancelado") return { ...base, backgroundColor: "#FEF2F2", color: "#B91C1C" }
  return base
}

export default function BartenderHomePage() {
  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "24px", marginBottom: "28px" }}>
        <div>
          <p style={{ margin: 0, color: "#374151", fontSize: "14px" }}>Pedidos</p>
          <h1 style={{ margin: "8px 0 0", fontSize: "32px", fontWeight: 700 }}>Você tem 2 pedidos pendentes</h1>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "14px", width: "360px" }}>
          <div style={{ flex: 1 }}>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                placeholder="Buscar pedidos"
                style={{
                  width: "100%",
                  borderRadius: "16px",
                  border: "1px solid #D1D5DB",
                  padding: "16px 20px",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
              <span style={{ position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", fontSize: "14px" }}>
                🔍
              </span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "20px" }}>
        {tabs.map((tab) => (
          <button
            key={tab.label}
            style={{
              padding: "10px 18px",
              borderRadius: "999px",
              border: tab.active ? "1px solid #FBBF24" : "1px solid #D1D5DB",
              backgroundColor: tab.active ? "#FDE68A" : "#FFFFFF",
              color: "#111827",
              fontWeight: tab.active ? 700 : 500,
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gap: "18px" }}>
        {orders.map((order, index) => (
          <div
            key={order.id}
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "16px",
              padding: "22px",
              borderRadius: "24px",
              backgroundColor: "#FFFFFF",
              border: order.status === "Aceito" ? "1px solid #FDE68A" : "1px solid #E5E7EB",
              boxShadow: "0px 4px 16px rgba(15, 23, 42, 0.04)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "18px", minWidth: "280px", flex: 1, minHeight: "80px" }}>
              <div style={{ width: "72px", height: "72px", borderRadius: "50%", backgroundColor: "#F3F4F6", flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                  <strong style={{ fontSize: "16px" }}>{order.id}</strong>
                  <span style={statusStyle(order.status)}>{order.status}</span>
                </div>
                <p style={{ margin: 0, fontSize: "14px", color: "#4B5563" }}>{order.client}</p>
              </div>
            </div>

            <div style={{ display: "flex", flex: 1, flexWrap: "wrap", gap: "12px", minWidth: "260px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "12px", color: "#6B7280" }}>Data</span>
                <span style={{ fontWeight: 600 }}>{order.date}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "12px", color: "#6B7280" }}>Horário</span>
                <span style={{ fontWeight: 600 }}>{order.schedule}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "180px" }}>
                <span style={{ fontSize: "12px", color: "#6B7280" }}>Local</span>
                <span style={{ fontWeight: 600 }}>{order.address}</span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "16px", minWidth: "190px", justifyContent: "flex-end" }}>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>Valor</p>
                <p style={{ margin: "6px 0 0", fontSize: "18px", fontWeight: 700 }}>{order.amount}</p>
              </div>
              <button
                style={{
                  border: "none",
                  borderRadius: "999px",
                  padding: "12px 22px",
                  backgroundColor: order.action === "Aceitar" ? "#FBBF24" : "#FFFFFF",
                  color: order.action === "Aceitar" ? "#111827" : "#111827",
                  boxShadow: order.action !== "Aceitar" ? "0 0 0 1px rgba(209, 213, 219, 0.9)" : "none",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                {order.action}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
