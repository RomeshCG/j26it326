const STORAGE_KEY = "mf_officer_explanation_style"

export const EXPLANATION_STYLES = [
  {
    id: "high-reliance",
    label: "High AI reliance",
    status: "OVER-RELIANT",
    description: "Emphasises uncertainty and independent verification",
  },
  {
    id: "balanced",
    label: "Balanced",
    status: "WELL-CALIBRATED",
    description: "Standard balanced assessment summary",
  },
  {
    id: "low-reliance",
    label: "Low AI reliance",
    status: "UNDER-RELIANT",
    description: "Highlights strongest supporting evidence",
  },
]

export function getExplanationStyleId() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && EXPLANATION_STYLES.some((style) => style.id === stored)) {
      return stored
    }
  } catch {
    // ignore
  }
  return "high-reliance"
}

export function setExplanationStyleId(styleId) {
  if (!EXPLANATION_STYLES.some((style) => style.id === styleId)) return
  localStorage.setItem(STORAGE_KEY, styleId)
}

export function getExplanationStyle(styleId = getExplanationStyleId()) {
  return EXPLANATION_STYLES.find((style) => style.id === styleId) ?? EXPLANATION_STYLES[0]
}

export function getTrustStatusFromStyle(styleId = getExplanationStyleId()) {
  return getExplanationStyle(styleId).status
}
