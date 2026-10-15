import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { CheckCircle2, AlertCircle, AlertTriangle, Clock, Loader2, ArrowRight } from "lucide-react"
import { verifyDomainToken } from "@/lib/api"

export default function VerifyDomain() {
  const navigate = useNavigate()
  const hasRequestedRef = useRef(false)

  const [status, setStatus] = useState("verifying") // "verifying" | "success" | "conflict" | "error" | "rate_limited" | "missing_token"
  const [domainName, setDomainName] = useState(null)
  const [errorMessage, setErrorMessage] = useState("")
  const [retryAfter, setRetryAfter] = useState(null)

  useEffect(() => {
    // Strictly execute verification once, guarding against React 19 StrictMode double-mounting
    if (hasRequestedRef.current) return
    hasRequestedRef.current = true

    // 1. Read token parameter from URL
    const searchParams = new URLSearchParams(window.location.search)
    const token = searchParams.get("token")

    // 2. Strip token immediately from the browser URL without page reload (security hygiene)
    window.history.replaceState({}, document.title, window.location.pathname)

    // 3. Validate token presence without logging it
    if (!token || typeof token !== "string" || !token.trim()) {
      setStatus("missing_token")
      return
    }

    // 4. Dispatch verification request
    const runVerification = async () => {
      try {
        const response = await verifyDomainToken(token.trim())
        if (response?.domain) {
          setDomainName(response.domain)
        }
        setStatus("success")
      } catch (err) {
        if (err.isNetworkError) {
          setStatus("error")
          setErrorMessage(err.message || "Unable to reach verification server.")
        } else if (err.status === 409) {
          setStatus("conflict")
          setErrorMessage(
            err.data?.error || "This domain has already been claimed and verified by another institution."
          )
        } else if (err.status === 429) {
          setStatus("rate_limited")
          setRetryAfter(err.retryAfter || 60)
          setErrorMessage(
            err.data?.error || `Too many requests. Please try again later.`
          )
        } else if (err.status === 400) {
          setStatus("error")
          setErrorMessage(
            err.data?.error || "Invalid or expired verification token."
          )
        } else {
          setStatus("error")
          setErrorMessage(
            err.data?.error || "Internal verification error"
          )
        }
      }
    }

    runVerification()
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between p-6 md:p-8 select-none relative font-sans">
      {/* Background Accent */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,var(--color-blue-500)/0.03,transparent_100%)] pointer-events-none" />

      {/* Header Branding */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/10">
            <div className="w-3 h-3 border-2 border-white rounded-xs transform rotate-45"></div>
          </div>
          <span className="text-sm font-bold tracking-tight text-foreground">MicroFlow</span>
        </div>
      </div>

      {/* Main Verification Card */}
      <div className="w-full max-w-[440px] mx-auto my-auto z-10">
        <div className="border border-border bg-card p-6 md:p-8 rounded-2xl shadow-sm text-center relative animate-in fade-in zoom-in-95 duration-200">
          
          {/* STATE: Verifying */}
          {status === "verifying" && (
            <div className="py-8 space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Verifying Domain</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Contacting Central Directory to validate your institution domain token...
              </p>
            </div>
          )}

          {/* STATE: Success (200) */}
          {status === "success" && (
            <div className="py-4 space-y-5">
              <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <CheckCircle2 className="w-8 h-8 stroke-[2.2px]" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-lg font-bold text-foreground">Domain Verified!</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {domainName ? (
                    <>
                      Ownership of <span className="font-semibold text-foreground">@{domainName}</span> has been confirmed.
                    </>
                  ) : (
                    "Institutional domain ownership has been successfully confirmed."
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="w-full h-10 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Proceed to Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STATE: Conflict (409) */}
          {status === "conflict" && (
            <div className="py-4 space-y-5">
              <div className="mx-auto w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                <AlertTriangle className="w-8 h-8 stroke-[2.2px]" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-lg font-bold text-foreground">Domain Already Claimed</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {errorMessage}
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="w-full h-10 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-lg text-xs transition-colors cursor-pointer"
              >
                Return to Login
              </button>
            </div>
          )}

          {/* STATE: Rate Limited (429) */}
          {status === "rate_limited" && (
            <div className="py-4 space-y-5">
              <div className="mx-auto w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                <Clock className="w-8 h-8 stroke-[2.2px]" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-lg font-bold text-foreground">Rate Limit Reached</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {errorMessage}
                </p>
                {retryAfter && (
                  <p className="text-xs text-muted-foreground">
                    Retry available in {retryAfter} seconds.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="w-full h-10 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-lg text-xs transition-colors cursor-pointer"
              >
                Back to Sign In
              </button>
            </div>
          )}

          {/* STATE: Error (400 / 500 / Network) */}
          {status === "error" && (
            <div className="py-4 space-y-5">
              <div className="mx-auto w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                <AlertCircle className="w-8 h-8 stroke-[2.2px]" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-lg font-bold text-foreground">Verification Failed</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {errorMessage || "Invalid or expired verification token."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="w-full h-10 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-lg text-xs transition-colors cursor-pointer"
              >
                Back to Sign In
              </button>
            </div>
          )}

          {/* STATE: Missing Token */}
          {status === "missing_token" && (
            <div className="py-4 space-y-5">
              <div className="mx-auto w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                <AlertCircle className="w-8 h-8 stroke-[2.2px]" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-lg font-bold text-foreground">Missing Token</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  No verification token was detected in the URL query string.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="w-full h-10 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-lg text-xs transition-colors cursor-pointer"
              >
                Return to Login
              </button>
            </div>
          )}

        </div>
      </div>

      {/* Footer Info */}
      <div className="text-center z-10">
        <p className="text-[11px] text-muted-foreground">
          MicroFlow ERP Platform • Secure Multi-Tenant Governance
        </p>
      </div>
    </div>
  )
}
