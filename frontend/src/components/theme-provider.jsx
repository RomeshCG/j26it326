import { createContext, useContext, useEffect, useState } from "react"

const ThemeContext = createContext({
  theme: "light",
  setTheme: () => {},
  toggleTheme: () => {},
})

function getInitialTheme() {
  if (typeof window === "undefined") return "light"

  const stored = localStorage.getItem("imfs-theme")
  if (stored === "light" || stored === "dark") return stored

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle("dark", theme === "dark")
    localStorage.setItem("imfs-theme", theme)
  }, [theme])

  function setTheme(next) {
    setThemeState(next)
  }

  function toggleTheme() {
    setThemeState((current) => (current === "dark" ? "light" : "dark"))
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

function useTheme() {
  return useContext(ThemeContext)
}

export { ThemeProvider, useTheme }
