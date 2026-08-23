import React, { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Building2, ShieldCheck, Clock, CheckCircle, ChevronDown, Eye, EyeOff } from "lucide-react"

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
  
  // Success state
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

  const handleSubmit = (e) => {
    e.preventDefault()
    
    // Simulate API call and set success
    setIsSuccess(true)
  }

  // Handle success progress bar
  useEffect(() => {
    if (isSuccess) {
      let currentProgress = 0
      const interval = setInterval(() => {
        currentProgress += 10 // make it slightly faster visually
        setProgress(currentProgress)
        if (currentProgress >= 100) {
          clearInterval(interval)
          setTimeout(() => {
            // Mock login as admin after signup
            localStorage.setItem("mf_auth_role", "Institution Admin")
            localStorage.setItem("mf_auth_token", "fake-jwt-token")
            navigate("/onboarding")
          }, 400)
        }
      }, 150)
      
      return () => clearInterval(interval)
    }
  }, [isSuccess, navigate])

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Left Panel - Branding (Same as Login) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-card border-r border-border">
        <div>
          <div className="flex items-center gap-3 text-foreground mb-20">
            <div className="w-8 h-8 rounded bg-blue-500 flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-white rounded-sm"></div>
            </div>
            <span className="text-xl font-bold tracking-tight">MicroFlow</span>
          </div>

          <div className="max-w-md">
            <h1 className="text-4xl font-bold text-foreground mb-4">Intelligent ERP for Microfinance.</h1>
            <p className="text-xl text-muted-foreground mb-12">Built for Sri Lankan MFIs. Powered by agentic AI.</p>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="mt-1 bg-muted/50 p-2 rounded-lg text-blue-400">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">AI agents that work while you sleep</h3>
                  <p className="text-sm text-muted-foreground">Automate approvals, reconciliation, and compliance reporting.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="mt-1 bg-muted/50 p-2 rounded-lg text-blue-400">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">Central Bank reporting — automated</h3>
                  <p className="text-sm text-muted-foreground">Generate CBSL-compliant reports instantly without manual Excel work.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="mt-1 bg-muted/50 p-2 rounded-lg text-blue-400">
                  <Clock size={20} />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">60-minute setup. No IT team needed.</h3>
                  <p className="text-sm text-muted-foreground">Self-serve onboarding wizard gets your institution running today.</p>
                </div>
              </div>
            </div>
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

          {isSuccess ? (
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
            <>
              <h2 className="text-2xl font-bold text-foreground mb-2">Claim your workspace</h2>
              <p className="text-muted-foreground text-sm mb-8">Quickly register your institution to get started.</p>

              <form onSubmit={handleSubmit} className="space-y-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground/80">Institution Name</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
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
                      className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
                      placeholder="e.g. LFC/123/2020"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2 relative">
                    <label className="text-sm font-medium text-foreground/80">Institution Type</label>
                    <div className="relative">
                      <select
                        name="type"
                        value={formData.type}
                        onChange={handleInputChange}
                        required
                        className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
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
                        className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
                      >
                        <option value="" disabled>Select district...</option>
                        {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-3 text-muted-foreground pointer-events-none" size={16} />
                    </div>
                  </div>
                </div>

                <hr className="border-border" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground/80">Admin Name</label>
                    <input
                      type="text"
                      name="adminName"
                      value={formData.adminName}
                      onChange={handleInputChange}
                      required
                      className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
                      placeholder="John Doe"
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
                      className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
                      placeholder="john@institution.lk"
                    />
                  </div>
                </div>

                <div className="space-y-2 relative">
                  <label className="text-sm font-medium text-foreground/80">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      required
                      className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
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
                  disabled={formData.password.length < 8}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors mt-4"
                >
                  Create Workspace
                </button>
              </form>

              <div className="mt-8 text-center text-sm text-muted-foreground">
                Already registered?{" "}
                <button onClick={() => navigate("/login")} className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
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
