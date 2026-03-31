"use client"

import { RegisterForm } from "@/components/register-form"
import { kaushan } from "@/fonts"

export default function RegisterPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
      <div className="w-full max-w-5xl rounded-2xl shadow-xl flex overflow-hidden">

        <div className="hidden md:flex md:w-1/2 relative items-center justify-center bg-[#ffffff] overflow-hidden p-8">
          <div className="absolute left-1/2 -translate-x-1/2 bottom-1/2 w-[640px] h-[640px] bg-[#FFC105] rounded-full" />
          <div className="relative z-10 flex flex-col items-center text-center mt-6 px-6 translate-y-6">
            <h1 className={`text-6xl text-white tracking-wide mb-40 ${kaushan.className}`}>ProBar</h1>
            <p className="text-[#FFC105] mt-4 text-center text-lg font-semibold">
              A plataforma que conecta <br />
              bartenders e clientes
            </p>
          </div>
        </div>

        <div className="w-full md:w-1/2 p-10 flex flex-col bg-[#ffffff] text-[#000000] justify-center">
          <RegisterForm />
        </div>
      </div>
    </main>
  )
}