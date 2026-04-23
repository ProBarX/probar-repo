import { CompleteBartenderRegistrationForm } from "@/components/bartender/CompleteBartenderRegistrationForm"

export default function BartenderCompletePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-white p-8">
      <div className="w-full max-w-3xl rounded-[32px] bg-white p-8 shadow-xl">
        <CompleteBartenderRegistrationForm />
      </div>
    </main>
  )
}
