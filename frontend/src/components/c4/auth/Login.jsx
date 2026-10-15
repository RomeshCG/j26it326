import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Eye, EyeOff, AlertCircle, AlertTriangle, CheckCircle, Loader2 } from "lucide-react"
import { useStore } from "@/store"
import { loginUser } from "@/lib/api"
import { toDisplayRole, getRoleRedirect } from "@/lib/roles"

const MOCK_PROFILES = [
  { label: "Admin", role: "Institution Admin" },
  { label: "Finance", role: "Finance Officer" },
  { label: "HR", role: "HR Officer" },
  { label: "Manager", role: "Branch Manager" },
  { label: "Loan Officer", role: "Loan Officer" },
]

export default function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const loginStore = useStore((state) => state.login)
  
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const isMockAuth = import.meta.env.VITE_USE_MOCK_AUTH === "true"
  const isSessionExpired = searchParams.get("expired") === "true"
  const isRegistered = searchParams.get("registered") === "true"

  const handleLogin = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    if (isMockAuth) {
      // Prototype Mock Auth Mode (Opt-in via VITE_USE_MOCK_AUTH=true)
      const role = "Institution Admin"
      localStorage.setItem("mf_auth_role", role)
      localStorage.setItem("mf_auth_token", "fake-jwt-token")
      localStorage.setItem("mf_auth_branch", "Colombo Head Office")

      loginStore({
        firstName: "Mock",
        lastName: "User",
        name: "Mock User",
        email: email || "",
        phone: "",
        role: role,
        branch: "Colombo Head Office",
        memberSince: "Jan 2024",
        language: "English",
      })

      setLoading(false)
      const targetRoute = getRoleRedirect(role)
      navigate(targetRoute)
      return
    }

    // Real Authentication Mode (Default)
    try {
      const response = await loginUser(email, password)
      const user = response.user
      const displayRole = toDisplayRole(user.role)
      // Fallback if no branch provided
      const userBranch = user.branch || "Head Office"

      if (response?.token) {
        localStorage.setItem("mf_auth_token", response.token)
      }
      localStorage.setItem("mf_auth_role", displayRole)
      localStorage.setItem("mf_auth_branch", userBranch)

      const names = (user.fullName || "").trim().split(/\s+/)
      loginStore({
        id: user.id,
        firstName: names[0] || user.fullName || "User",
        lastName: names.slice(1).join(" ") || "",
        name: user.fullName || "User",
        email: user.email,
        phone: "",
        role: displayRole,
        backendRole: user.role,
        branch: userBranch,
        institutionId: user.institutionId,
        institutionName: user.institutionName,
        memberSince: "Oct 2026",
        language: "English",
      })

      // In real-auth mode: direct role-based navigation without onboarding hijacking
      const targetRoute = getRoleRedirect(user.role)
      navigate(targetRoute)
    } catch (err) {
      if (err.isNetworkError) {
        setError(err.message)
      } else if (err.status === 403 && (err.message === "Account is pending administrator approval" || err.data?.error === "Account is pending administrator approval")) {
        setError("Your account is waiting for an administrator to approve it")
      } else if (err.status === 429) {
        const retrySec = err.retryAfter || 60
        setError(`Too many failed login attempts. Please wait ${retrySec} seconds before trying again.`)
      } else {
        setError("Invalid email or password")
      }
    } finally {
      setLoading(false)
    }
  }

  const fillMockRole = (mockRole) => {
    if (!isMockAuth) return
    localStorage.setItem("mf_auth_role", mockRole)
    localStorage.setItem("mf_auth_token", "fake-jwt-token")
    localStorage.setItem("mf_auth_branch", "Head Office")

    loginStore({
      firstName: "Mock",
      lastName: mockRole,
      name: `Mock ${mockRole}`,
      email: "",
      phone: "",
      role: mockRole,
      branch: "Head Office",
      memberSince: "Jan 2024",
      language: "English",
    })

    const targetRoute = getRoleRedirect(mockRole)
    navigate(targetRoute)
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

          {/* Expired Session Notice */}
          {isSessionExpired && (
            <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Your session has expired. Please sign in again to continue.</span>
            </div>
          )}

          {/* Registration Success Notice */}
          {isRegistered && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5 text-xs text-emerald-700 dark:text-emerald-400">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Institution provisioned successfully! Please sign in with the administrator credentials you created.</span>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Identity / Email</label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-10 w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all disabled:opacity-50"
                  placeholder="Enter email address"
                />
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
                  disabled={loading}
                  className="h-10 w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all disabled:opacity-50"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="h-10 w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/60 text-white font-semibold rounded-lg text-xs transition-all hover:shadow-lg hover:shadow-blue-500/10 cursor-pointer tracking-wider uppercase font-bold flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                "Authenticate"
              )}
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

          {/* Quick Mock Role Switcher (Only visible in prototype mock-auth mode) */}
          {isMockAuth && (
            <div className="mt-6 pt-5 border-t border-border space-y-2">
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Simulated Profiles (Mock Mode)</div>
              <div className="grid grid-cols-2 gap-1.5">
                {MOCK_PROFILES.map((p) => (
                  <button
                    key={p.role}
                    type="button"
                    onClick={() => fillMockRole(p.role)}
                    className="px-2.5 py-2 text-[10px] font-medium border border-border bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg text-left transition-colors cursor-pointer flex justify-between items-center"
                  >
                    <span>{p.label}</span>
                    <span className="text-muted-foreground">→</span>
                  </button>
                ))}
              </div>
            </div>
          )}
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
