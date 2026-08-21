import { useState } from "react"
import { Loader2, Moon, Sun, LayoutDashboard, Sparkles, Radio } from "lucide-react"

import { ThemeProvider, useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import C3App from "@/components/c3"
import OnboardingWizard from "@/components/c4/onboarding-wizard"

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      aria-label="Toggle theme"
    >
      {theme === "dark" ? <Sun /> : <Moon />}
    </Button>
  )
}

function SmokeTestPage() {
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setMessage("")

    window.setTimeout(() => {
      setLoading(false)
      setMessage(name.trim() ? `Hello, ${name.trim()}. IMFS UI is working.` : "Enter a name, then try again.")
    }, 600)
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md rounded-xl border bg-card">
        <CardHeader className="gap-2">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                IMFS
              </p>
              <CardTitle className="text-2xl font-semibold tracking-tight">
                UI smoke test
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Tailwind CSS v4, shadcn/ui (base-nova / neutral), and theme tokens.
              </CardDescription>
            </div>
            <ThemeToggle />
          </div>
        </CardHeader>

        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Researcher name"
                autoComplete="off"
              />
            </div>

            {message ? (
              <p className="text-sm text-muted-foreground">{message}</p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="lg" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : null}
                Primary
              </Button>
              <Button type="button" variant="outline" size="lg">
                Outline
              </Button>
              <Button type="button" variant="secondary" size="default">
                Secondary
              </Button>
              <Button type="button" variant="ghost" size="default">
                Ghost
              </Button>
            </div>
          </form>
        </CardContent>

        <CardFooter className="text-sm text-muted-foreground">
          Theme key: <code className="ml-1">imfs-theme</code>
        </CardFooter>
      </Card>
    </div>
  )
}

function App() {
  const [activeTab, setActiveTab] = useState("c3")

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        {/* Navigation / Mode Toggle Bar */}
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">
              μF
            </div>
            <span className="font-semibold text-lg tracking-tight">MicroFlow</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-muted rounded-lg p-1">
              <button
                onClick={() => setActiveTab("onboarding")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "onboarding"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sparkles className="size-3.5" />
                Onboarding Wizard
              </button>
              <button
                onClick={() => setActiveTab("c3")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "c3"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Radio className="size-3.5" />
                Loan Officer (C3)
              </button>
              <button
                onClick={() => setActiveTab("smoke")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "smoke"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutDashboard className="size-3.5" />
                Smoke Test
              </button>
            </div>
            
            <ThemeToggle />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1">
          {activeTab === "onboarding" ? (
            <OnboardingWizard />
          ) : activeTab === "c3" ? (
            <C3App />
          ) : (
            <SmokeTestPage />
          )}
        </main>
      </div>
    </ThemeProvider>
  )
}

export default App

