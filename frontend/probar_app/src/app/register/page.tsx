"use client"

import { RegisterForm } from "@/components/register-form"
import { kaushan } from "@/fonts"

export default function RegisterPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-5xl rounded-2xl border border-gray-200 flex overflow-hidden bg-white">

        <div className="hidden md:flex md:w-1/2 relative items-center justify-center bg-white overflow-hidden">
          {/* Círculo amarelo ancorado no topo, centralizado horizontalmente */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-60 w-[640px] h-[603px] bg-[#FFC105] rounded-full" />

          <div className="relative z-10 flex flex-col items-center text-center px-8">
            <h1 className={`text-7xl text-white tracking-wide mb-32 ${kaushan.className}`}>ProBar</h1>
            <p className="text-[#FFC105] text-base font-semibold leading-snug">
              A plataforma que conecta<br />bartenders e clientes
            </p>
          </div>
        </div>

        <div className="w-full md:w-1/2 border-l border-gray-200 p-8 flex flex-col bg-white justify-center">
          <RegisterForm />
        </div>
      </div>
    </main>
  )
}