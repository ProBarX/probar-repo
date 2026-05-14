type ApiErrorShape = {
  response?: {
    data?: unknown
  }
  message?: string
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(formatValue).join(", ")
  if (typeof value === "string") return value
  if (value === null || value === undefined) return ""
  return String(value)
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  const apiError = error as ApiErrorShape
  const data = apiError?.response?.data

  if (data && typeof data === "object" && !Array.isArray(data)) {
    const record = data as Record<string, unknown>

    if (typeof record.detail === "string") return record.detail
    if (typeof record.erro === "string") return record.erro

    const messages = Object.entries(record)
      .map(([field, value]) => {
        const message = formatValue(value)
        return message ? `${field}: ${message}` : ""
      })
      .filter(Boolean)

    if (messages.length > 0) return messages.join("\n")
  }

  if (typeof data === "string") return data
  if (apiError?.message) return apiError.message

  return fallback
}
