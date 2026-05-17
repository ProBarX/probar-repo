import type { CSSProperties } from "react"

export type ChatAlign = "left" | "right" | "center"

export const CHAT_CARD_WIDTH = "min(100%, 392px)"

export const chatCardShellStyle: CSSProperties = {
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  boxSizing: "border-box",
}

export function chatCardContainerStyle(align: ChatAlign = "right"): CSSProperties {
  return {
    alignSelf: align === "left" ? "flex-start" : align === "center" ? "center" : "flex-end",
    width: CHAT_CARD_WIDTH,
    maxWidth: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    display: "grid",
    gap: 8,
  }
}

export const chatCardBorder = "0.5px solid #eee"
export const probarYellow = "#F5C518"
export const probarYellowBorder = "#EF9F27"
export const probarBlack = "#21242C"
