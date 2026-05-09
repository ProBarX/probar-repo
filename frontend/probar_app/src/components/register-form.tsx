"use client"

import Link from "next/link"
import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import RoleSelector from "@/components/RoleSelector"
import { useRouter } from "next/navigation"
import { createUser } from "@/services/user"
import { apiAuth, setToken } from "@/services/api"

export function RegisterForm() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [tipo, setTipo] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [agreed, setAgreed] = useState(false)

  async function handleRegister() {
    try {
      if (!tipo) {
        alert("Selecione o tipo de conta")
        return
      }
      if (!agreed) {
        alert("Aceite os termos para continuar")
        return
      }
      if (password !== confirmPassword) {
        alert("As senhas não coincidem")
        return
      }

      await createUser({ name, email, password, tipo })

      const { data: authData } = await apiAuth.post("/api/token/", { email, password })
      setToken(authData.access)

      await fetch("/api/auth/set-cookies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: authData.access,
          refresh: authData.refresh,
          tipo: authData.tipo,
        }),
      })

      setName("")
      setEmail("")
      setPassword("")
      setConfirmPassword("")
      setTipo("")
      setAgreed(false)

      if (authData.tipo === "cliente") {
        router.push("/client/complete")
        return
      }

      if (authData.tipo === "bartender") {
        router.push("/bartender/complete")
        return
      }

      router.push("/login")
    } catch (error) {
      console.error(error)
      alert("Erro ao cadastrar")
    }
  }

  const inputClass =
    "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F5C518] focus:border-transparent"

  return (
    <div className="w-full space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Cadastro</h2>
        <p className="text-gray-500 text-sm mt-1">Crie uma conta</p>
      </div>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          handleRegister()
        }}
      >
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Tipo de conta</label>
          <div className="flex flex-col md:flex-row gap-2">
            <RoleSelector
              role="cliente"
              title="Cliente"
              subtitle="Contratar bartenders"
              selected={tipo === "cliente"}
              onSelect={(r) => setTipo(r)}
            />
            <RoleSelector
              role="bartender"
              title="Bartender"
              subtitle="Oferecer serviços"
              selected={tipo === "bartender"}
              onSelect={(r) => setTipo(r)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="name" className="text-sm font-medium text-gray-700">Nome</label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="José alencar"
            className={inputClass}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium text-gray-700">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jose@email.com"
            className={inputClass}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium text-gray-700">Senha</label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Crie uma senha"
              className={`${inputClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">Confirmar Senha</label>
          <div className="relative">
            <input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirme sua senha"
              className={`${inputClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-start gap-2 text-xs text-gray-500">
          <input
            type="checkbox"
            id="terms"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 accent-[#F5C518]"
          />
          <label htmlFor="terms">
            Li e concordo com os{" "}
            <span className="font-semibold underline cursor-pointer text-gray-700">Termos e Condições</span>
            {" "}e a{" "}
            <span className="font-semibold underline cursor-pointer text-gray-700">Política de Privacidade</span>
          </label>
        </div>

        <button
          type="submit"
          className="w-full h-10 rounded-lg bg-[#F5C518] hover:bg-yellow-400 text-black text-sm font-semibold transition-colors"
        >
          Cadastrar
        </button>
      </form>

      <p className="text-center text-xs text-gray-500">
        Já tem uma conta?{" "}
        <Link href="/login" className="font-semibold text-gray-900 hover:underline">
          Faça login
        </Link>
      </p>
    </div>
  )
}
