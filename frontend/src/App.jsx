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
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { ThemeProvider } from "@/components/theme-provider"
import Login from "@/components/c4/auth/Login"
import Signup from "@/components/c4/auth/Signup"
import OnboardingWizard from "@/components/c4/onboarding-wizard"
import Payroll from "@/components/c4/payroll"
import ExecutiveDashboard from "@/components/c4/executive-dashboard"
import DashboardLayout from "@/components/c4/DashboardLayout"
import AgentLog from "@/components/c4/agent-log"
import TierApproval from "@/components/c4/tier-approval"
import Settings from "@/components/c4/settings"

function ProtectedRoute({ children }) {
  const token = localStorage.getItem("mf_auth_token")
  if (!token) {
    return <Navigate to="/login" replace />
  }
  return children
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
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route 
            path="/onboarding" 
            element={
              <ProtectedRoute>
                <OnboardingWizard />
              </ProtectedRoute>
            } 
          />
          <Route 
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<ExecutiveDashboard />} />
            <Route path="/payroll" element={<Payroll />} />
            <Route path="/agent-log" element={<AgentLog />} />
            <Route path="/tier-approval" element={<TierApproval />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App

