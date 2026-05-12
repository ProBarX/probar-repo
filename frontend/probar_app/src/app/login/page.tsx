import { LoginForm } from "@/components/login-form"
import { kaushan } from "@/fonts"

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
      <div className="w-full max-w-5xl rounded-2xl border border-gray-200 flex overflow-hidden bg-white">


        <div className="hidden md:flex md:w-1/2 relative items-center justify-center bg-[#ffffff] overflow-hidden p-8">
          <div className="absolute left-1/2 -translate-x-1/2 bottom-1/2 w-[640px] h-[640px] bg-[#F5C518] rounded-full" />
          <div className="relative z-10 flex flex-col items-center text-center mt-6 px-6 translate-y-6">
            <h1 className={`text-6xl text-white tracking-wide mb-40 ${kaushan.className}`}>ProBar</h1>
            <p className="text-[#F5C518] mt-4 text-center text-lg font-semibold">
              A plataforma que conecta <br />
              bartenders e clientes
            </p>
          </div>
        </div>

      
          <div className="w-full md:w-1/2 border-l border-gray-200 p-10 flex flex-col bg-white text-[#000000] justify-center">
          <div className="mb-6">
            <h2 className="text-2xl font-bold">Bem-vindo!</h2>
            <p className="text-gray-500 text-sm mt-1">Entre na sua conta para continuar</p>
          </div>

          <div className="w-full">
            <LoginForm />
          </div>
        </div>
      </div>
    </main>
  )
}
