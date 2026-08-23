import React, { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Building2, ShieldCheck, Clock, Eye, EyeOff } from "lucide-react"

const DEMO_ACCOUNTS = [
  { role: "Institution Admin", email: "admin@microflow.lk", password: "demo-password" },
  { role: "Finance Officer", email: "finance@microflow.lk", password: "demo-password" },
  { role: "HR Officer", email: "hr@microflow.lk", password: "demo-password" },
  { role: "Branch Manager", email: "manager@microflow.lk", password: "demo-password" },
]

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)

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
    // Mock login logic
    const role = detectedRole || "Institution Admin" // fallback
    localStorage.setItem("mf_auth_role", role)
    localStorage.setItem("mf_auth_token", "fake-jwt-token")
    
    // Redirect based on role
    switch (role) {
      case "Institution Admin":
        // For demo, if admin, we can go to onboarding or dashboard. 
        // Let's assume onboarding for first-time setup or dashboard. We'll go to dashboard by default.
        navigate("/dashboard")
        break
      case "Finance Officer":
        navigate("/dashboard") // or /finance
        break
      case "HR Officer":
        navigate("/payroll")
        break
      case "Branch Manager":
        navigate("/dashboard") // or /branch-summary
        break
      case "Loan Officer":
        navigate("/dashboard") // or /loan-officer
        break
      case "Field Officer":
        navigate("/dashboard") // or /collection
        break
      default:
        navigate("/dashboard")
    }
  }

  const fillDemo = (acc) => {
    setEmail(acc.email)
    setPassword(acc.password)
  }

  return (
    <div className="flex min-h-screen bg-[#0A0A0A] text-slate-200">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-[#111111] border-r border-slate-800">
        <div>
          <div className="flex items-center gap-3 text-white mb-20">
            <div className="w-8 h-8 rounded bg-blue-500 flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-white rounded-sm"></div>
            </div>
            <span className="text-xl font-bold tracking-tight">MicroFlow</span>
          </div>

          <div className="max-w-md">
            <h1 className="text-4xl font-bold text-white mb-4">Intelligent ERP for Microfinance.</h1>
            <p className="text-xl text-slate-400 mb-12">Built for Sri Lankan MFIs. Powered by agentic AI.</p>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="mt-1 bg-slate-800/50 p-2 rounded-lg text-blue-400">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="font-medium text-slate-200">AI agents that work while you sleep</h3>
                  <p className="text-sm text-slate-500">Automate approvals, reconciliation, and compliance reporting.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="mt-1 bg-slate-800/50 p-2 rounded-lg text-blue-400">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="font-medium text-slate-200">Central Bank reporting — automated</h3>
                  <p className="text-sm text-slate-500">Generate CBSL-compliant reports instantly without manual Excel work.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="mt-1 bg-slate-800/50 p-2 rounded-lg text-blue-400">
                  <Clock size={20} />
                </div>
                <div>
                  <h3 className="font-medium text-slate-200">60-minute setup. No IT team needed.</h3>
                  <p className="text-sm text-slate-500">Self-serve onboarding wizard gets your institution running today.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="text-sm text-slate-600 font-medium">
          Trusted by licensed microfinance institutions across Sri Lanka.
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md bg-[#161616] border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center gap-3 text-white mb-8 lg:hidden">
            <div className="w-6 h-6 rounded bg-blue-500 flex items-center justify-center">
              <div className="w-3 h-3 border-2 border-white rounded-sm"></div>
            </div>
            <span className="text-lg font-bold tracking-tight">MicroFlow</span>
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">Sign in to your institution</h2>
          <p className="text-slate-400 text-sm mb-8">Enter your credentials to access your workspace.</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2 relative">
              <label className="text-sm font-medium text-slate-300">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-[#0A0A0A] border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
                placeholder="name@institution.lk"
              />
              {detectedRole && (
                <div className="absolute right-3 top-9 px-2 py-1 bg-blue-500/10 text-blue-400 text-xs font-medium rounded border border-blue-500/20">
                  {detectedRole}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-300">Password</label>
                <button type="button" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-[#0A0A0A] border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="remember"
                className="w-4 h-4 rounded border-slate-700 bg-[#0A0A0A] text-blue-500 focus:ring-blue-500 focus:ring-offset-[#161616]"
              />
              <label htmlFor="remember" className="text-sm text-slate-400 cursor-pointer">
                Remember me for 30 days
              </label>
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-lg transition-colors mt-2 cursor-pointer"
            >
              Sign In
            </button>
          </form>

          {/* Demo Accounts Panel */}
          <div className="mt-8 pt-6 border-t border-slate-800">
            <button
              onClick={() => setDemoOpen(!demoOpen)}
              className="w-full text-left text-sm text-slate-400 hover:text-slate-200 font-medium flex items-center justify-between cursor-pointer"
            >
              <span>Demo accounts — click to fill</span>
              <span className={`transform transition-transform ${demoOpen ? "rotate-180" : ""}`}>▼</span>
            </button>
            
            {demoOpen && (
              <div className="mt-4 space-y-2 animate-in slide-in-from-top-2 opacity-100">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.role}
                    onClick={() => fillDemo(acc)}
                    className="w-full flex items-center justify-between px-4 py-2 bg-[#0A0A0A] hover:bg-slate-800 border border-slate-800 rounded-lg text-left transition-colors group cursor-pointer"
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-200 group-hover:text-blue-400 transition-colors">{acc.role}</div>
                      <div className="text-xs text-slate-500">{acc.email}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8 text-center text-sm text-slate-400">
            New institution?{" "}
            <button onClick={() => navigate("/signup")} className="text-blue-400 hover:text-blue-300 font-medium transition-colors cursor-pointer">
              Register here
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
