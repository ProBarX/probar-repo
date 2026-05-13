const DEFAULT_API_URL = "http://127.0.0.1:8000"

function getApiUrl() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL
  if (apiUrl) return apiUrl.replace(/\/$/, "")

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL
  if (apiBaseUrl) return apiBaseUrl.replace(/\/api\/v1\/?$/, "").replace(/\/$/, "")

  return DEFAULT_API_URL
}

export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null

  if (/^(https?:|data:|blob:)/.test(url)) {
    return url
  }

  if (url.startsWith("/media/")) {
    return `${getApiUrl()}${url}`
  }

  if (url.startsWith("media/")) {
    return `${getApiUrl()}/${url}`
  }

  return url
}
