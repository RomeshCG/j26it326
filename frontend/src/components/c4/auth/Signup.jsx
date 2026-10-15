import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { CheckCircle, ChevronDown, Eye, EyeOff, AlertCircle, Loader2, ArrowRight } from "lucide-react"
import { useStore } from "@/store"
import { registerInstitution } from "@/lib/api"
import { toBackendInstitutionType } from "@/lib/roles"

const DISTRICTS = [
  "Ampara", "Anuradhapura", "Badulla", "Batticaloa", "Colombo", "Galle", 
  "Gampaha", "Hambantota", "Jaffna", "Kalutara", "Kandy", "Kegalle", "Kilinochchi", 
  "Kurunegala", "Mannar", "Matale", "Matara", "Moneragala", "Mullaitivu", 
  "Nuwara Eliya", "Polonnaruwa", "Puttalam", "Ratnapura", "Trincomalee", "Vavuniya"
]

const INSTITUTION_TYPES = [
  "Licensed Finance Company",
  "Microfinance NGO",
  "Rural Development Bank",
  "Co-operative Society"
]

export default function Signup() {
  const navigate = useNavigate()
  const isMockAuth = import.meta.env.VITE_USE_MOCK_AUTH === "true"

  // Redirect if an active real session exists so logged-in users cannot register another institution
  useEffect(() => {
    const token = localStorage.getItem("mf_auth_token")
    if (!isMockAuth && token) {
      navigate("/dashboard", { replace: true })
    }
  }, [isMockAuth, navigate])
  
  const [formData, setFormData] = useState({
    name: "",
    regNumber: "",
    type: "",
    district: "",
    adminName: "",
    adminEmail: "",
    password: ""
  })

  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState("")
  const [isSuccess, setIsSuccess] = useState(false)
  const [progress, setProgress] = useState(0)

  // Password strength calculation
  const getPasswordStrength = () => {
    const pw = formData.password
    let strength = 0
    if (pw.length > 7) strength += 1
    if (pw.match(/[A-Z]/)) strength += 1
    if (pw.match(/[0-9]/)) strength += 1
    if (pw.match(/[^A-Za-z0-9]/)) strength += 1
    return strength // 0 to 4
  }

  const strength = getPasswordStrength()
  const strengthLabels = ["Very Weak", "Weak", "Fair", "Good", "Strong"]
  const strengthColors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-blue-500", "bg-green-500"]

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return
    setServerError("")
    setLoading(true)

    // Capture password for payload, then immediately clear from component state
    const submittedPassword = formData.password
    setFormData(prev => ({ ...prev, password: "" }))

    if (isMockAuth) {
      // Prototype Mock Auth Flow
      setIsSuccess(true)
      setLoading(false)
      return
    }

    try {
      await registerInstitution({
        institutionName: formData.name.trim(),
        licenseNumber: formData.regNumber.trim() || undefined,
        institutionType: toBackendInstitutionType(formData.type),
        district: formData.district || undefined,
        adminFullName: formData.adminName.trim(),
        adminEmail: formData.adminEmail.trim().toLowerCase(),
        adminPassword: submittedPassword,
        planName: "Starter",
        billingCycle: "monthly",
      })

      setIsSuccess(true)
    } catch (err) {
      if (err.isNetworkError) {
        setServerError(err.message || "Unable to reach the server. Please check your connection.")
      } else if (err.status === 429) {
        const retrySec = err.retryAfter || 60
        setServerError(`Too many requests. Please wait ${retrySec} seconds before retrying.`)
      } else if (err.status === 403) {
        setServerError(err.data?.error || "Registration is currently disabled on this server.")
      } else if (err.status === 503) {
        setServerError("Service temporarily busy. Please retry shortly.")
      } else if (err.status === 400) {
        if (err.data?.error === "Registration request could not be processed") {
          setServerError("Registration request could not be processed. This email or institution may already be registered.")
        } else {
          setServerError(err.data?.error || "Registration validation failed. Please check your inputs.")
        }
      } else {
        setServerError(err.data?.error || "Failed to create workspace. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  // Handle mock auth success progress bar
  useEffect(() => {
    if (isSuccess && isMockAuth) {
      let currentProgress = 0
      const interval = setInterval(() => {
        currentProgress += 10
        setProgress(currentProgress)
        if (currentProgress >= 100) {
          clearInterval(interval)
          setTimeout(() => {
            localStorage.setItem("mf_auth_role", "Institution Admin")
            localStorage.setItem("mf_auth_token", "fake-jwt-token")
            
            useStore.getState().setOnboardingComplete(false)
            useStore.getState().setOnboardingStartTime(Date.now())
            
            const names = formData.adminName.split(' ')
            useStore.getState().login({
              firstName: names[0] || "Admin",
              lastName: names.slice(1).join(' ') || "",
              email: formData.adminEmail,
              phone: "",
              role: "Institution Admin",
              memberSince: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
              language: "English"
            })
            
            navigate("/onboarding")
          }, 400)
        }
      }, 150)
      
      return () => clearInterval(interval)
    }
  }, [isSuccess, isMockAuth, navigate, formData.adminEmail, formData.adminName])

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-card border-r border-border">
        <div>
          <div className="flex items-center gap-3 text-foreground mb-20">
            <div className="w-8 h-8 rounded bg-blue-500 flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-white rounded-sm"></div>
            </div>
            <span className="text-xl font-bold tracking-tight">MicroFlow</span>
          </div>

          <div className="max-w-md">
            <h1 className="text-3xl font-extrabold text-foreground mb-4 tracking-tight leading-tight">
              Enterprise Resource Planning for Microfinance Institutions
            </h1>
            <p className="text-sm text-muted-foreground mb-12 leading-relaxed">
              A secure, cloud-based ERP platform designed for licensed microfinance institutions operating under the regulatory framework of the Central Bank of Sri Lanka.
            </p>

            <ul className="space-y-6 text-sm text-muted-foreground leading-relaxed border-t border-border pt-8">
              <li>
                <strong className="text-foreground font-semibold">Regulatory Compliance</strong> - Pre-configured for EPF, ETF, and CBSL reporting requirements
              </li>
              <li>
                <strong className="text-foreground font-semibold">Agentic Automation</strong> - Four embedded AI agents handle routine operational workflows autonomously
              </li>
              <li>
                <strong className="text-foreground font-semibold">Institutional Data Security</strong> - Multi-tenant architecture with row-level data isolation per institution
              </li>
              <li>
                <strong className="text-foreground font-semibold">Guided Onboarding</strong> - Operational in under 60 minutes without technical support
              </li>
            </ul>
          </div>
        </div>

        <div className="text-sm text-muted-foreground font-medium">
          Trusted by licensed microfinance institutions across Sri Lanka.
        </div>
      </div>

      {/* Right Panel - Signup Form or Success State */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 overflow-y-auto max-h-screen">
        <div className="w-full max-w-xl bg-muted border border-border rounded-2xl p-8 shadow-2xl my-8">
          
          <div className="flex items-center gap-3 text-foreground mb-8 lg:hidden">
            <div className="w-6 h-6 rounded bg-blue-500 flex items-center justify-center">
              <div className="w-3 h-3 border-2 border-white rounded-sm"></div>
            </div>
            <span className="text-lg font-bold tracking-tight">MicroFlow</span>
          </div>

          {/* Success State */}
          {isSuccess ? (
            isMockAuth ? (
              <div className="text-center py-12 px-6 flex flex-col items-center animate-in fade-in zoom-in duration-300">
                <div className="w-20 h-20 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle size={40} />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-4">Workspace Claimed</h2>
                <p className="text-muted-foreground mb-8">Creating your initial configuration. This takes about 3 seconds.</p>
                
                <div className="w-full max-w-sm">
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden mb-4">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-150 ease-linear"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="text-sm font-medium text-blue-400">
                    {progress >= 100 ? "Ready. Redirecting you to setup..." : "Configuring workspace..."}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 px-4 flex flex-col items-center animate-in fade-in zoom-in-95 duration-300 space-y-6">
                <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center">
                  <CheckCircle size={36} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-foreground">Workspace Provisioned!</h2>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Institution <span className="font-semibold text-foreground">{formData.name}</span> has been registered and provisioned in the Central Registry.
                  </p>
                </div>

                <div className="w-full bg-background border border-border p-4 rounded-xl text-left space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Next Step</div>
                  <p className="text-xs text-foreground leading-relaxed">
                    Log in with your administrator account (<span className="font-semibold text-blue-500">{formData.adminEmail}</span>) and the password you created to complete institution settings.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => navigate("/login?registered=true")}
                  className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-blue-500/10"
                >
                  <span>Proceed to Sign In</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            )
          ) : (
            <>
              <h2 className="text-2xl font-bold text-foreground mb-2">Claim your workspace</h2>
              <p className="text-muted-foreground text-sm mb-6">Quickly register your institution to get started.</p>

              {serverError && (
                <div className="mb-6 p-3.5 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-xs text-red-600 dark:text-red-400 animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{serverError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground/80">Institution Name</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      disabled={loading}
                      className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors disabled:opacity-50 text-sm"
                      placeholder="e.g. Apex Microfinance"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground/80">Registration Number</label>
                    <input
                      type="text"
                      name="regNumber"
                      value={formData.regNumber}
                      onChange={handleInputChange}
                      required
                      disabled={loading}
                      className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors disabled:opacity-50 text-sm"
                      placeholder="e.g. LFC/123/2020"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 relative">
                    <label className="text-sm font-medium text-foreground/80">Institution Type</label>
                    <div className="relative">
                      <select
                        name="type"
                        value={formData.type}
                        onChange={handleInputChange}
                        required
                        disabled={loading}
                        className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors disabled:opacity-50 text-sm"
                      >
                        <option value="" disabled>Select type...</option>
                        {INSTITUTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-3 text-muted-foreground pointer-events-none" size={16} />
                    </div>
                  </div>
                  <div className="space-y-2 relative">
                    <label className="text-sm font-medium text-foreground/80">District (HQ)</label>
                    <div className="relative">
                      <select
                        name="district"
                        value={formData.district}
                        onChange={handleInputChange}
                        required
                        disabled={loading}
                        className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors disabled:opacity-50 text-sm"
                      >
                        <option value="" disabled>Select district...</option>
                        {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-3 text-muted-foreground pointer-events-none" size={16} />
                    </div>
                  </div>
                </div>

                <hr className="border-border" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground/80">Admin Full Name</label>
                    <input
                      type="text"
                      name="adminName"
                      value={formData.adminName}
                      onChange={handleInputChange}
                      required
                      disabled={loading}
                      className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors disabled:opacity-50 text-sm"
                      placeholder="Amal Perera"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground/80">Admin Email</label>
                    <input
                      type="email"
                      name="adminEmail"
                      value={formData.adminEmail}
                      onChange={handleInputChange}
                      required
                      disabled={loading}
                      className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors disabled:opacity-50 text-sm"
                      placeholder="admin@institution.lk"
                    />
                  </div>
                </div>

                <div className="space-y-2 relative">
                  <label className="text-sm font-medium text-foreground/80">Admin Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      required
                      disabled={loading}
                      autoComplete="new-password"
                      className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors disabled:opacity-50 text-sm"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  
                  {/* Password Strength Indicator */}
                  {formData.password.length > 0 && (
                    <div className="pt-1">
                      <div className="flex gap-1 mb-1">
                        {[0, 1, 2, 3].map((i) => (
                          <div 
                            key={i} 
                            className={`h-1 w-full rounded-full ${i < strength ? strengthColors[strength] : "bg-muted"}`} 
                          />
                        ))}
                      </div>
                      <div className="text-xs text-muted-foreground text-right">{strengthLabels[strength]}</div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || formData.password.length < 8}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors mt-4 flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-blue-500/10 text-sm"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Provisioning Institution...</span>
                    </>
                  ) : (
                    <span>Create Workspace</span>
                  )}
                </button>
              </form>

              <div className="mt-8 text-center text-sm text-muted-foreground">
                Already registered?{" "}
                <button onClick={() => navigate("/login")} className="text-blue-400 hover:text-blue-300 font-medium transition-colors cursor-pointer">
                  Sign in here
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
