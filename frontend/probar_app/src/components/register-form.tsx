"use client"

import Link from "next/link"
import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { useRouter } from "next/navigation"
import { createUser } from "@/services/user"

export function RegisterForm() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)

  const [role, setRole] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  async function handleRegister() {
    try {
      if (!role) {
        alert("Selecione o tipo de conta")
        return
      }

      if (password !== confirmPassword) {
        alert("As senhas não coincidem")
        return
      }

      await createUser({ name, email, password, role })

      alert("Usuário criado com sucesso!")
      setName("")
      setEmail("")
      setPassword("")
      setConfirmPassword("")
      setRole("")

      router.push("/login")
    } catch (error) {
      console.error(error)
      alert("Erro ao cadastrar")
    }
  }

  return (
    <div className="w-full max-w-md space-y-8">
      <div>
        <h2 className="text-3xl font-bold">Cadastro</h2>
        <p className="text-gray-600 mt-2">Crie uma conta</p>
      </div>

      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); handleRegister() }}>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Tipo de conta</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRole("cliente")}
              className={`flex-1 border rounded-lg p-2 transition ${role === "cliente" ? "border-[#FFC105] bg-yellow-50" : "border-gray-300"}`}
            >
              Cliente
            </button>
            <button
              type="button"
              onClick={() => setRole("bartender")}
              className={`flex-1 border rounded-lg p-2 transition ${role === "bartender" ? "border-[#FFC105] bg-yellow-50" : "border-gray-300"}`}
            >
              Bartender
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium text-foreground">Nome</label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome"
            className="border p-2 rounded mb-2 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FFC105] w-full"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-foreground">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            className="border p-2 rounded mb-2 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FFC105] w-full"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-foreground">Senha</label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sua senha"
              className="border p-2 rounded mb-2 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FFC105] w-full pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">Confirme a senha</label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirme sua senha"
            className="border p-2 rounded mb-2 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FFC105] w-full"
          />
        </div>

        <div className="flex items-center text-xs mb-4">
          <input type="checkbox" className="mr-2" />
          <span>Li e concordo com os termos</span>
        </div>

        <button
          type="submit"
          className="flex h-12 w-full items-center justify-center rounded-lg bg-[#FFC105] hover:bg-yellow-500 text-black font-semibold transition-colors"
        >
          Cadastrar
        </button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-[#ffffff] px-4 text-muted-foreground">Ou entre com</span>
        </div>
      </div>

      <div className="flex justify-center gap-4">
        <button
          type="button"
          className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted"
          aria-label="Entrar com Google"
        >
          <span className="text-lg font-bold">G</span>
        </button>
        <button
          type="button"
          className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted"
          aria-label="Entrar com Apple"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
          </svg>
        </button>
        <button
          type="button"
          className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted"
          aria-label="Entrar com Facebook"
        >
          <span className="text-lg font-bold">f</span>
        </button>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        {"Já tem uma conta? "}
        <Link href="/login" className="font-semibold text-foreground hover:underline">
          Faça login
        </Link>
      </p>
    </div>
  )
}
