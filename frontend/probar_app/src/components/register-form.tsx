"use client"

import Link from "next/link"
import { useState } from "react"
import { Eye, EyeOff, User, Wine } from "lucide-react"
import { useRouter } from "next/navigation"
import { createUser } from "@/services/user"

export function RegisterForm() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)

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

      alert("Usuário criado com sucesso!")
      setName("")
      setEmail("")
      setPassword("")
      setConfirmPassword("")
      setTipo("")
      setAgreed(false)

      router.push("/login")
    } catch (error) {
      console.error(error)
      alert("Erro ao cadastrar")
    }
  }

  const inputClass =
    "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FFC105] focus:border-transparent"

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
        {/* Tipo de conta */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Tipo de conta</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTipo("cliente")}
              className={`flex-1 flex items-center gap-2 border rounded-lg px-3 py-2.5 text-sm transition ${
                tipo === "cliente"
                  ? "border-[#FFC105] bg-yellow-50 text-gray-900"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              <User className="h-4 w-4 text-[#FFC105]" />
              <div className="text-left">
                <p className="font-medium text-xs">Cliente</p>
                <p className="text-[10px] text-gray-400">Contratar bartenders</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setTipo("bartender")}
              className={`flex-1 flex items-center gap-2 border rounded-lg px-3 py-2.5 text-sm transition ${
                tipo === "bartender"
                  ? "border-[#FFC105] bg-yellow-50 text-gray-900"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              <Wine className="h-4 w-4 text-[#FFC105]" />
              <div className="text-left">
                <p className="font-medium text-xs">Bartender</p>
                <p className="text-[10px] text-gray-400">Oferecer serviços</p>
              </div>
            </button>
          </div>
        </div>

        {/* Nome */}
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

        {/* Email */}
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

        {/* Senha */}
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

        {/* Confirmar Senha */}
        <div className="space-y-1.5">
          <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">Confirmar Senha</label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirme sua senha"
            className={inputClass}
          />
        </div>

        {/* Termos */}
        <div className="flex items-start gap-2 text-xs text-gray-500">
          <input
            type="checkbox"
            id="terms"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 accent-[#FFC105]"
          />
          <label htmlFor="terms">
            Li e concordo com os{" "}
            <span className="font-semibold underline cursor-pointer text-gray-700">Termos e Condições</span>
            {" "}e a{" "}
            <span className="font-semibold underline cursor-pointer text-gray-700">Política de Privacidade</span>
          </label>
        </div>

        {/* Botão */}
        <button
          type="submit"
          className="w-full h-10 rounded-lg bg-[#FFC105] hover:bg-yellow-400 text-black text-sm font-semibold transition-colors"
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
