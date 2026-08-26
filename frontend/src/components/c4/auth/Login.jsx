import React, { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Eye, EyeOff } from "lucide-react"
import { useStore } from "@/store"

const DEMO_ACCOUNTS = [
  { role: "Admin", email: "admin@microflow.lk", password: "demo-password" },
  { role: "Finance", email: "finance@microflow.lk", password: "demo-password" },
  { role: "HR", email: "hr@microflow.lk", password: "demo-password" },
  { role: "Manager", email: "manager@microflow.lk", password: "demo-password" },
  { role: "Loan Officer", email: "loan@microflow.lk", password: "demo-password" },
]

export default function Login() {
  const navigate = useNavigate()
  const loginStore = useStore((state) => state.login)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  // Auto-detect role for prototype
  const detectedRole = React.useMemo(() => {
    if (!email) return null
    const e = email.toLowerCase()
    if (e.includes("admin")) return "Institution Admin"
    if (e.includes("finance")) return "Finance Officer"
    if (e.includes("hr")) return "HR Officer"
    if (e.includes("manager")) return "Branch Manager"
    if (e.includes("loan")) return "Loan Officer"
    if (e.includes("field")) return "Field Officer"
    return null
  }, [email])

  const handleLogin = (e) => {
    e.preventDefault()
    const role = detectedRole || "Institution Admin"
    localStorage.setItem("mf_auth_role", role)
    localStorage.setItem("mf_auth_token", "fake-jwt-token")
    
    // Set user in Zustand store
    const nameMap = {
      "Institution Admin": { first: "Jane", last: "Smith" },
      "Finance Officer": { first: "Saman", last: "Kumara" },
      "HR Officer": { first: "Ruwanthi", last: "de Silva" },
      "Branch Manager": { first: "Nimal", last: "Silva" },
      "Loan Officer": { first: "Nuwan", last: "Jayasuriya" },
      "Field Officer": { first: "Dinesh", last: "Ranatunga" }
    }
    const names = nameMap[role] || { first: "Demo", last: "User" }
    
    loginStore({
      firstName: names.first,
      lastName: names.last,
      email: email || "demo@microflow.lk",
      phone: "+94 77 123 4567",
      role: role,
      memberSince: "Jan 2024",
      language: "English"
    })
    
    switch (role) {
      case "Loan Officer":
      case "Field Officer":
        navigate("/loan-officer")
        break
      case "HR Officer":
        navigate("/payroll")
        break
      case "Institution Admin":
      case "Finance Officer":
      case "Branch Manager":
      default:
        navigate("/dashboard")
    }
  }

  const fillDemo = (acc) => {
    setEmail(acc.email)
    setPassword(acc.password)
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between p-6 md:p-8 select-none relative font-sans">
      {/* Subtle Background Accent */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,var(--color-blue-500)/0.03,transparent_100%)] pointer-events-none" />

      {/* Header Info */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/10">
            <div className="w-3 h-3 border-2 border-white rounded-xs transform rotate-45"></div>
          </div>
          <span className="text-sm font-bold tracking-tight text-foreground">MicroFlow</span>
        </div>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-[400px] mx-auto my-auto z-10">
        <div className="border border-border bg-card p-6 md:p-8 rounded-2xl shadow-sm relative">
          <div className="mb-6 space-y-1.5">
            <div className="text-[10px] text-muted-foreground tracking-wider uppercase font-bold">Security Gate</div>
            <h2 className="text-lg font-bold text-foreground tracking-tight">Authorization Required</h2>
            <p className="text-xs text-muted-foreground">Enter your credentials to access the institution workspace.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Identity / Email</label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-10 w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all"
                  placeholder="operator@microflow.lk"
                />
                {detectedRole && (
                  <div className="absolute right-3 top-2 px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[9px] font-bold rounded border border-blue-500/25">
                    {detectedRole}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Access Key</label>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-10 w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="h-10 w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-xs transition-all hover:shadow-lg hover:shadow-blue-500/10 cursor-pointer tracking-wider uppercase font-bold"
            >
              Authenticate
            </button>
          </form>

          <div className="mt-4 text-center text-xs text-muted-foreground">
            New institution?{" "}
            <button
              type="button"
              onClick={() => navigate("/signup")}
              className="text-blue-600 hover:underline font-semibold cursor-pointer"
            >
              Register here
            </button>
          </div>

          {/* Quick Demo Autofills */}
          <div className="mt-6 pt-5 border-t border-border space-y-2">
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Simulated Profiles</div>
            <div className="grid grid-cols-2 gap-1.5">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.role}
                  type="button"
                  onClick={() => fillDemo(acc)}
                  className="px-2.5 py-2 text-[10px] font-medium border border-border bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg text-left transition-colors cursor-pointer flex justify-between items-center"
                >
                  <span>{acc.role}</span>
                  <span className="text-muted-foreground">→</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="flex flex-col sm:flex-row items-center justify-between text-[9px] text-muted-foreground gap-2 border-t border-border pt-4 z-10 font-medium uppercase tracking-wider">
        <div>
          <span>Secure ERP - Environment: Production</span>
        </div>
        <div className="flex items-center gap-3">
          <span>ENC: AES-256</span>
          <span className="hidden sm:inline">•</span>
          <span>Compliance: CBSL / CBSL-MFI-R4</span>
        </div>
      </div>
    </div>
  )
}
