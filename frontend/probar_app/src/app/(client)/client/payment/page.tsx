"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"
import { AlertCircle, ArrowLeft, CheckCircle2, CreditCard, Loader2, ShieldCheck } from "lucide-react"
import {
  confirmarSetupPagamento,
  criarPagamento,
  finalizarPagamento,
  type PaymentSession,
} from "@/services/payment"

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
const stripePromise = publishableKey ? loadStripe(publishableKey) : null

function formatCurrency(value: string | number) {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

function getErrorMessage(error: unknown, fallback = "Nao foi possivel iniciar o pagamento.") {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: { erro?: string; detail?: string } } }).response
    return response?.data?.erro ?? response?.data?.detail ?? fallback
  }

  if (error instanceof Error) return error.message
  return fallback
}

function isCapturablePaymentStatus(status?: string | null) {
  return status === "requires_capture"
}

function isPaidPaymentStatus(status?: string | null) {
  return status === "succeeded"
}

function isAuthorizedPaymentStatus(status?: string | null) {
  return isCapturablePaymentStatus(status) || isPaidPaymentStatus(status)
}

function isConfirmedSetupStatus(status?: string | null) {
  return status === "succeeded"
}

function hasStripeClientSecret(
  session: PaymentSession | null
): session is PaymentSession & { client_secret: string } {
  return typeof session?.client_secret === "string" && session.client_secret.length > 0
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<PaymentLoading />}>
      <PaymentRoute />
    </Suspense>
  )
}

function PaymentRoute() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pedidoId = useMemo(() => {
    const value = Number(searchParams.get("pedido"))
    return Number.isFinite(value) && value > 0 ? value : null
  }, [searchParams])

  const [session, setSession] = useState<PaymentSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmedStatus, setConfirmedStatus] = useState<string | null>(null)
  const [finalizing, setFinalizing] = useState(false)
  const [finalizeError, setFinalizeError] = useState<string | null>(null)

  useEffect(() => {
    if (!pedidoId) return

    let active = true

    criarPagamento(pedidoId)
      .then((data) => {
        if (!active) return
        setSession(data)
        if (isAuthorizedPaymentStatus(data.stripe_status) || isConfirmedSetupStatus(data.stripe_status)) {
          setConfirmedStatus(data.stripe_status)
        }
      })
      .catch((err) => {
        if (!active) return
        setError(getErrorMessage(err))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [pedidoId])

  const stripeStatus = confirmedStatus ?? session?.stripe_status
  const isSetupSession = session?.mode === "setup"
  const hasSavedCard = Boolean(
    isSetupSession && (isConfirmedSetupStatus(stripeStatus) || session?.payment_method_id)
  )
  const isPaymentPaid = Boolean(
    !isSetupSession && (session?.status === "PAGO" || isPaidPaymentStatus(stripeStatus))
  )
  const isPaymentAuthorized = Boolean(
    !isSetupSession && !isPaymentPaid && isCapturablePaymentStatus(stripeStatus)
  )
  const isConfirmed = hasSavedCard || isPaymentPaid
  const stripeElementsSession =
    hasStripeClientSecret(session) && !isConfirmed && !isPaymentAuthorized ? session : null
  const needsStripeElements = Boolean(stripeElementsSession)
  const hasUnavailableSession = Boolean(session && !stripeElementsSession && !isConfirmed && !isPaymentAuthorized)
  const statusLabel = session
    ? hasSavedCard
      ? "Cartao salvo"
      : isPaymentPaid
        ? "Pago"
        : isPaymentAuthorized
          ? "Aguardando finalizacao"
          : session.status
    : "-"
  const missingPedido = !pedidoId

  async function handleFinalizePayment() {
    if (!session || finalizing) return

    setFinalizing(true)
    setFinalizeError(null)

    try {
      await finalizarPagamento(session.pagamento_id)
      setConfirmedStatus("succeeded")
      setSession((current) =>
        current
          ? {
              ...current,
              status: "PAGO",
              stripe_status: "succeeded",
              finalizado_pelo_cliente: true,
            }
          : current
      )
    } catch (err) {
      setFinalizeError(
        getErrorMessage(err, "Nao foi possivel finalizar o pagamento.")
      )
    } finally {
      setFinalizing(false)
    }
  }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gap: 18 }}>
      <button
        type="button"
        onClick={() => router.push("/client/chat")}
        style={{
          width: "fit-content",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          border: "1px solid #D1D5DB",
          background: "#fff",
          color: "#111827",
          borderRadius: 8,
          padding: "9px 12px",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        <ArrowLeft size={16} />
        Chat
      </button>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
          gap: 18,
          alignItems: "start",
        }}
      >
        <div
          style={{
            border: "1px solid #E5E7EB",
            borderRadius: 8,
            background: "#fff",
            padding: 24,
            minHeight: 420,
          }}
        >
          {missingPedido && (
            <PaymentNotice
              tone="error"
              title="Pedido nao informado"
              message="Volte ao chat e abra o pagamento pela proposta aceita."
              actionLabel="Voltar ao chat"
              onAction={() => router.push("/client/chat")}
            />
          )}

          {!missingPedido && loading && <PaymentLoading />}

          {!missingPedido && !loading && error && (
            <PaymentNotice
              tone="error"
              title="Pagamento indisponivel"
              message={error}
              actionLabel="Voltar ao chat"
              onAction={() => router.push("/client/chat")}
            />
          )}

          {!missingPedido && !loading && !error && hasUnavailableSession && (
            <PaymentNotice
              tone="error"
              title="Sessao indisponivel"
              message="Nao foi possivel continuar este pagamento. Volte ao chat e tente abrir a proposta novamente."
              actionLabel="Voltar ao chat"
              onAction={() => router.push("/client/chat")}
            />
          )}

          {!missingPedido && !loading && !error && needsStripeElements && !publishableKey && (
            <PaymentNotice
              tone="error"
              title="Chave Stripe ausente"
              message="Configure NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY no frontend."
            />
          )}

          {!missingPedido && !loading && !error && session && isConfirmed && (
            <PaymentNotice
              tone="success"
              title={isSetupSession ? "Cartao salvo" : "Pagamento finalizado"}
              message={
                isSetupSession
                  ? "O cartao foi salvo e a cobranca sera autorizada perto da data do evento."
                  : "O pagamento foi capturado e o pedido foi marcado como pago."
              }
              actionLabel="Voltar ao chat"
              onAction={() => router.push("/client/chat")}
            />
          )}

          {!missingPedido && !loading && !error && session && isPaymentAuthorized && (
            <FinalizePaymentPanel
              session={session}
              error={finalizeError}
              finalizing={finalizing}
              onBack={() => router.push("/client/chat")}
              onFinalize={handleFinalizePayment}
            />
          )}

          {!missingPedido && !loading && !error && publishableKey && stripeElementsSession && (
            <Elements
              key={stripeElementsSession.client_secret}
              stripe={stripePromise}
              options={{
                clientSecret: stripeElementsSession.client_secret,
                appearance: {
                  theme: "stripe",
                  variables: {
                    colorPrimary: "#111827",
                    borderRadius: "8px",
                  },
                },
              }}
            >
              <PaymentForm
                session={stripeElementsSession}
                onConfirmed={(stripeStatus) => {
                  setConfirmedStatus(stripeStatus)
                  setSession((current) =>
                    current ? { ...current, stripe_status: stripeStatus } : current
                  )
                }}
              />
            </Elements>
          )}
        </div>

        <aside
          style={{
            border: "1px solid #E5E7EB",
            borderRadius: 8,
            background: "#fff",
            padding: 22,
            display: "grid",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 8,
                background: "#F5C518",
                color: "#111827",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <CreditCard size={19} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, color: "#6B7280", fontSize: 13 }}>Pedido</p>
              <h1 style={{ margin: 0, color: "#111827", fontSize: 22, fontWeight: 750 }}>
                #{pedidoId ?? "-"}
              </h1>
            </div>
          </div>

          <div style={{ borderTop: "1px solid #E5E7EB" }} />

          <div style={{ display: "grid", gap: 10 }}>
            <InfoRow label="Valor" value={session ? formatCurrency(session.valor) : "-"} strong />
            <InfoRow label="Status" value={statusLabel} />
            <InfoRow label="Gateway" value="Stripe" />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              background: "#F9FAFB",
              border: "1px solid #E5E7EB",
              borderRadius: 8,
              padding: 12,
              color: "#374151",
              fontSize: 13,
              lineHeight: 1.45,
            }}
          >
            <ShieldCheck size={18} color="#166534" style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              {isSetupSession
                ? "O cartao fica salvo com seguranca na Stripe e a autorizacao ocorre perto do evento."
                : "O pagamento e processado pela Stripe e o repasse ao bartender fica controlado pelo pedido."}
            </span>
          </div>
        </aside>
      </section>
    </main>
  )
}

function FinalizePaymentPanel({
  session,
  error,
  finalizing,
  onBack,
  onFinalize,
}: {
  session: PaymentSession
  error: string | null
  finalizing: boolean
  onBack: () => void
  onFinalize: () => void
}) {
  return (
    <div
      style={{
        minHeight: 320,
        display: "grid",
        alignContent: "center",
        justifyItems: "center",
        gap: 14,
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 54,
          height: 54,
          display: "grid",
          placeItems: "center",
          borderRadius: 8,
          color: "#166534",
          background: "#F0FDF4",
          border: "1px solid #BBF7D0",
        }}
      >
        <ShieldCheck size={26} />
      </div>

      <div style={{ display: "grid", gap: 6, justifyItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: 24, color: "#111827" }}>
          Pagamento autorizado
        </h2>
        <p style={{ margin: 0, color: "#4B5563", maxWidth: 440, lineHeight: 1.5 }}>
          O valor de {formatCurrency(session.valor)} esta reservado no cartao. Finalize para capturar a cobranca e marcar o pedido como pago.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
            color: "#991B1B",
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: 8,
            padding: 12,
            fontSize: 13,
            textAlign: "left",
            maxWidth: 440,
          }}
        >
          <AlertCircle size={17} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 10,
          marginTop: 4,
        }}
      >
        <button
          type="button"
          onClick={onFinalize}
          disabled={finalizing}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            minHeight: 42,
            border: "none",
            borderRadius: 8,
            background: finalizing ? "#D1D5DB" : "#F5C518",
            color: "#111827",
            cursor: finalizing ? "wait" : "pointer",
            fontWeight: 750,
            padding: "0 14px",
          }}
        >
          {finalizing ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}
          {finalizing ? "Finalizando..." : "Finalizar pagamento"}
        </button>

        <button
          type="button"
          onClick={onBack}
          disabled={finalizing}
          style={{
            minHeight: 42,
            border: "1px solid #D1D5DB",
            borderRadius: 8,
            background: "#fff",
            color: "#111827",
            cursor: finalizing ? "not-allowed" : "pointer",
            fontWeight: 700,
            padding: "0 14px",
          }}
        >
          Voltar ao chat
        </button>
      </div>
    </div>
  )
}

function PaymentForm({
  session,
  onConfirmed,
}: {
  session: PaymentSession
  onConfirmed: (stripeStatus: string) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!stripe || !elements) return

    setSubmitting(true)
    setError(null)

    if (session.mode === "setup") {
      const result = await stripe.confirmSetup({
        elements,
        redirect: "if_required",
        confirmParams: {
          return_url: `${window.location.origin}/client/payment?pedido=${session.pedido_id}`,
        },
      })

      if (result.error) {
        setError(result.error.message ?? "Nao foi possivel salvar o cartao.")
        setSubmitting(false)
        return
      }

      const status = result.setupIntent?.status ?? null
      if (isConfirmedSetupStatus(status)) {
        try {
          const updated = await confirmarSetupPagamento(session.pagamento_id)
          onConfirmed(updated.stripe_status ?? status)
        } catch (err) {
          setError(getErrorMessage(err))
          setSubmitting(false)
          return
        }
        setSubmitting(false)
        return
      }

      setError("Cartao ainda nao confirmado. Verifique os dados e tente novamente.")
      setSubmitting(false)
      return
    }

    const result = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: {
        return_url: `${window.location.origin}/client/payment?pedido=${session.pedido_id}`,
      },
    })

    if (result.error) {
      setError(result.error.message ?? "Nao foi possivel confirmar o pagamento.")
      setSubmitting(false)
      return
    }

    const status = result.paymentIntent?.status ?? null
    if (isAuthorizedPaymentStatus(status)) {
      onConfirmed(status)
      setSubmitting(false)
      return
    }

    setError("Pagamento ainda nao confirmado. Verifique os dados e tente novamente.")
    setSubmitting(false)
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 18 }}>
      <div>
        <p style={{ margin: "0 0 6px", color: "#6B7280", fontSize: 13 }}>Total</p>
        <h2 style={{ margin: 0, color: "#111827", fontSize: 30, fontWeight: 800 }}>
          {formatCurrency(session.valor)}
        </h2>
      </div>

      <div style={{ borderTop: "1px solid #E5E7EB" }} />

      <PaymentElement />

      {error && (
        <div
          role="alert"
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
            color: "#991B1B",
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: 8,
            padding: 12,
            fontSize: 13,
          }}
        >
          <AlertCircle size={17} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || !elements || submitting}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          minHeight: 44,
          border: "none",
          borderRadius: 8,
          background: submitting ? "#D1D5DB" : "#F5C518",
          color: "#111827",
          cursor: submitting ? "wait" : "pointer",
          fontWeight: 750,
          fontSize: 15,
        }}
      >
        {submitting ? <Loader2 size={17} className="animate-spin" /> : <CreditCard size={17} />}
        {session.mode === "setup" ? "Salvar cartao" : "Confirmar pagamento"}
      </button>
    </form>
  )
}

function PaymentNotice({
  tone,
  title,
  message,
  actionLabel,
  onAction,
}: {
  tone: "success" | "error"
  title: string
  message: string
  actionLabel?: string
  onAction?: () => void
}) {
  const Icon = tone === "success" ? CheckCircle2 : AlertCircle
  const color = tone === "success" ? "#166534" : "#991B1B"
  const bg = tone === "success" ? "#F0FDF4" : "#FEF2F2"
  const border = tone === "success" ? "#BBF7D0" : "#FECACA"

  return (
    <div
      style={{
        minHeight: 320,
        display: "grid",
        alignContent: "center",
        justifyItems: "center",
        gap: 12,
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 54,
          height: 54,
          display: "grid",
          placeItems: "center",
          borderRadius: 8,
          color,
          background: bg,
          border: `1px solid ${border}`,
        }}
      >
        <Icon size={26} />
      </div>
      <h2 style={{ margin: 0, fontSize: 24, color: "#111827" }}>{title}</h2>
      <p style={{ margin: 0, color: "#4B5563", maxWidth: 420, lineHeight: 1.5 }}>{message}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          style={{
            marginTop: 8,
            border: "none",
            borderRadius: 8,
            background: "#111827",
            color: "#fff",
            padding: "10px 14px",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

function InfoRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <span style={{ color: "#6B7280", fontSize: 13 }}>{label}</span>
      <span
        style={{
          color: "#111827",
          fontWeight: strong ? 800 : 650,
          fontSize: strong ? 18 : 14,
          textAlign: "right",
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </span>
    </div>
  )
}

function PaymentLoading() {
  return (
    <div
      style={{
        minHeight: 320,
        display: "grid",
        placeItems: "center",
        color: "#6B7280",
        gap: 10,
      }}
    >
      <Loader2 size={24} className="animate-spin" />
      <span>Carregando pagamento...</span>
    </div>
  )
}
