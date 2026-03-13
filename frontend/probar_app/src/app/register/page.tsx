"use client"

import { useState } from "react"
import { kaushan } from "@/fonts"
import { createUser } from "@/services/user"

export default function Register() {

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

    await createUser({
        name,
        email,
        password,
        role
    })

    alert("Usuário criado com sucesso!")

    setName("")
    setEmail("")
    setPassword("")
    setConfirmPassword("")
    setRole("")

    } catch (error) {
    console.error(error)
    alert("Erro ao cadastrar")
    }
}

return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#FFC105] to-yellow-200">

    <div className="w-[900px] h-[520px] rounded-2xl shadow-xl flex overflow-hidden">

        {/* LADO ESQUERDO */}
        <div className="w-1/2 relative flex items-center justify-center bg-[#F9F9F9] overflow-hidden">

        <div className="absolute w-[700px] h-[700px] bg-[#FFC105] rounded-full -top-[380px] left-[-120px]"></div>

        <div className="z-10 flex flex-col items-center text-center mt-15">

            <h1 className={`text-7xl text-white tracking-wide ${kaushan.className}`}>
            ProBar
            </h1>
            <p className="text-[#FFC105] mt-25 text-center text-lg font-semibold">
                A plataforma que conecta <br />
                bartenders e clientes
            </p>  

        </div>
        </div>

        {/* LADO DIREITO */}
        <div className="w-1/2 p-10 flex flex-col bg-[#F9F9F9] text-[#000000]">

        <h2 className="text-2xl font-bold">
            Cadastro
        </h2>

        <p className="mb-4">
            Crie uma conta
        </p>

        <label className="text-sm font-medium mb-2">
            Tipo de conta
        </label>

        <div className="flex gap-2 mb-4">

            <button
            onClick={() => setRole("cliente")}
            className={`flex-1 border rounded-lg p-2 transition ${
                role === "cliente"
                ? "border-[#FFC105] bg-yellow-50"
                : "border-gray-300"
            }`}
            >
            Cliente
            </button>

            <button
            onClick={() => setRole("bartender")}
            className={`flex-1 border rounded-lg p-2 transition ${
                role === "bartender"
                ? "border-[#FFC105] bg-yellow-50"
                : "border-gray-300"
            }`}
            >
            Bartender
            </button>

        </div>

        <input
            placeholder="Seu nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border p-2 rounded mb-2 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FFC105]"
        />

        <input
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border p-2 rounded mb-2 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FFC105]"
        />

        <input
            type="password"
            placeholder="Sua senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border p-2 rounded mb-2 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FFC105]"
        />

        <input
            type="password"
            placeholder="Confirme sua senha"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="border p-2 rounded mb-3 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FFC105]"
        />

        <div className="flex items-center text-xs mb-4">
            <input type="checkbox" className="mr-2"/>
            <span>Li e concordo com os termos</span>
        </div>

        <button
            onClick={handleRegister}
            className="bg-[#FFC105] hover:bg-yellow-500 text-black font-semibold p-2 rounded-lg transition"
        >
            Cadastrar
        </button>

        <p className="text-xs text-center mt-3">
            Já tem uma conta? <span className="font-semibold">Faça login</span>
        </p>

        </div>

    </div>

    </div>
)
}