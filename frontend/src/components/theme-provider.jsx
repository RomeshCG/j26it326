import { createContext, useContext, useEffect, useMemo, useState } from "react"

const STORAGE_KEY = "imfs-theme"
const MEDIA_QUERY = "(prefers-color-scheme: dark)"

const ThemeContext = createContext({
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => {},
  toggleTheme: () => {},
})

function getSystemTheme() {
  if (typeof window === "undefined") return "light"
  return window.matchMedia(MEDIA_QUERY).matches ? "dark" : "light"
}

function getStoredTheme() {
  if (typeof window === "undefined") return "system"
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored
  }
  return "system"
}

function applyThemeClass(resolved) {
  const root = document.documentElement
  root.classList.toggle("dark", resolved === "dark")
  root.style.colorScheme = resolved
}

function ThemeProvider({ children, defaultTheme = "system" }) {
  const [theme, setThemeState] = useState(() => getStoredTheme() || defaultTheme)
  const [systemTheme, setSystemTheme] = useState(getSystemTheme)

  const resolvedTheme = theme === "system" ? systemTheme : theme

  useEffect(() => {
    const media = window.matchMedia(MEDIA_QUERY)
    const onChange = () => setSystemTheme(media.matches ? "dark" : "light")
    onChange()
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [])

  useEffect(() => {
    applyThemeClass(resolvedTheme)
  }, [resolvedTheme])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme: setThemeState,
      toggleTheme: () => {
        setThemeState((current) => {
          if (current === "light") return "dark"
          if (current === "dark") return "system"
          return "light"
        })
      },
    }),
    [theme, resolvedTheme]
  )

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  )
}

function useTheme() {
  return useContext(ThemeContext)
}

export { ThemeProvider, useTheme }
