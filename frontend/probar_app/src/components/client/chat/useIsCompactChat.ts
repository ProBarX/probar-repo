"use client"

import { useEffect, useState } from "react"

export function useIsCompactChat() {
  const [isCompact, setIsCompact] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 760 : false
  )

  useEffect(() => {
    const update = () => setIsCompact(window.innerWidth < 760)
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  return isCompact
}
