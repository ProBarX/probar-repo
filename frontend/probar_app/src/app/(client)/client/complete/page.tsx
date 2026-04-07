"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { CompleteRegisterForm } from "@/components/client/CompleteRegisterForm"
import { kaushan } from "@/fonts"

export default function CompletePage() {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkUserData() {
      try {
        const tokenRes = await fetch("/api/auth/get-token")
        const { token } = await tokenRes.json()

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/clientes/me/`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (res.ok) {
          const userData = await res.json()
          // Se o usuário já tem data_nascimento salva, redireciona para home
          if (userData.data_nascimento) {
            router.push("/client/home")
          } else {
            setShowForm(true)
          }
        } else {
          setShowForm(true)
        }
      } catch {
        setShowForm(true)
      } finally {
        setLoading(false)
      }
    }

    checkUserData()
  }, [router])

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        backgroundColor: "#f5f5f5",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <p>Carregando...</p>
      </div>
    )
  }

  if (!showForm) {
    return null
  }

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#f5f5f5",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
    }}>
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <h1 className={kaushan.className} style={{ fontSize: "32px", color: "#F5C518", margin: 0 }}>
          ProBar
        </h1>
        <p style={{ color: "#666", margin: "4px 0 0" }}>Complete seu cadastro para continuar</p>
      </div>

      <div style={{
        backgroundColor: "#fff",
        borderRadius: "12px",
        padding: "40px 32px",
        width: "100%",
        maxWidth: "460px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
      }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h2 style={{ fontSize: "22px", fontWeight: "700", margin: "0 0 8px" }}>
            Informações pessoais
          </h2>
          <p style={{ color: "#888", margin: 0 }}>Adicione sua foto e informações básicas</p>
        </div>

        <CompleteRegisterForm />
      </div>
    </div>
  )
}