const specialtyLabels: Record<string, string> = {
  showman: "Showman",
  mixologista: "Mixologista",
  tradicional: "Tradicional",
  night_club: "Night Club",
}

export function formatSpecialty(value?: string | null) {
  if (!value) return "Especialidade não informada"

  const normalized = value.toLowerCase().trim()
  return specialtyLabels[normalized] ?? value.replace(/[_-]+/g, " ")
}

export function formatExperience(years?: number | string | null) {
  const value = Number(years)
  if (!Number.isFinite(value) || value <= 0) return null

  return `${value} ${value === 1 ? "ano" : "anos"} de experiência`
}

export function formatCurrency(value?: number | string | null) {
  const amount = Number(String(value ?? 0).replace(",", "."))

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0)
}
