import { useState, useEffect, useCallback, useRef } from "react"
import { Link, useNavigate } from "react-router-dom"
import { 
  User, Building2, Bell, Cpu, Shield, 
  Lock, CheckCircle, Plus, AlertTriangle, Info
} from "lucide-react"
import { useStore } from "@/store"
import { fetchTenantBranches, fetchAgentPolicies } from "@/lib/api"

const TABS = [
  { id: "account", label: "Account Settings", icon: User },
  { id: "institution", label: "Institution Settings", icon: Building2, adminOnly: true },
  { id: "notifications", label: "Notification Preferences", icon: Bell },
  { id: "agents", label: "Agent Settings", icon: Cpu, adminOnly: true },
  { id: "privacy", label: "Data & Privacy", icon: Shield }
]

export default function Settings() {
  const navigate = useNavigate()
  
  // Zustand State
  const {
    currentUser,
    loanProducts,
    notifications,
    updateNotification,
    agentSettings,
  } = useStore()
  
  const [activeTab, setActiveTab] = useState("account")
  const [showToast, setShowToast] = useState({ visible: false, message: "" })
  const [unsavedChanges, setUnsavedChanges] = useState(false)
  
  const isAdmin = currentUser?.role === "Institution Admin"
  const hasAuthToken =
    typeof localStorage !== "undefined" &&
    Boolean(localStorage.getItem("mf_auth_token"))
  /** Real login session - hide demo-only danger controls. */
  const isAuthenticatedSession = Boolean(
    hasAuthToken ||
      currentUser?.institutionId ||
      currentUser?.backendRole ||
      currentUser?.institutionName
  )

  // Authenticated institution label - never demo Zustand institution.name / Apex.
  const institutionLabel =
    (typeof currentUser?.institutionName === "string" &&
      currentUser.institutionName.trim()) ||
    "Your institution"

  const displayFirstName =
    (typeof currentUser?.firstName === "string" && currentUser.firstName.trim()) ||
    ""
  const displayLastName =
    (typeof currentUser?.lastName === "string" && currentUser.lastName.trim()) ||
    ""
  const displayEmail =
    (typeof currentUser?.email === "string" && currentUser.email.trim()) || ""
  const displayRole =
    (typeof currentUser?.role === "string" && currentUser.role.trim()) || "User"

  // Live branches (Institution tab) - never fall back to demo store.branches
  const [liveBranches, setLiveBranches] = useState([])
  const [branchCount, setBranchCount] = useState(null)
  const [branchLoading, setBranchLoading] = useState(false)
  const [branchError, setBranchError] = useState(null)
  const branchReqIdRef = useRef(0)

  // Live agent policies (Agents tab) - read-only; do not call updateAgentPolicy here
  const [livePolicies, setLivePolicies] = useState([])
  const [policiesLoading, setPoliciesLoading] = useState(false)
  const [policiesError, setPoliciesError] = useState(null)
  const policiesReqIdRef = useRef(0)

  const userScopeKey =
    currentUser?.id ??
    currentUser?.userId ??
    currentUser?.institutionId ??
    "anon"

  const loadBranches = useCallback(async () => {
    const reqId = ++branchReqIdRef.current
    setBranchLoading(true)
    setBranchError(null)
    setLiveBranches([])
    setBranchCount(null)
    try {
      const res = await fetchTenantBranches()
      if (reqId !== branchReqIdRef.current) return
      const rows = Array.isArray(res?.data) ? res.data : []
      setLiveBranches(rows)
      setBranchCount(
        typeof res?.count === "number" ? res.count : rows.length
      )
    } catch (err) {
      if (reqId !== branchReqIdRef.current) return
      setLiveBranches([])
      setBranchCount(null)
      const status = err?.status
      if (status === 401) {
        setBranchError("Session expired. Sign in again to load branches.")
      } else if (status === 403) {
        setBranchError("You do not have permission to view branches.")
      } else {
        setBranchError(err?.message || "Failed to load branches.")
      }
    } finally {
      if (reqId === branchReqIdRef.current) {
        setBranchLoading(false)
      }
    }
  }, [])

  // Load when Institution tab is open; re-fetch on user/tenant switch.
  // loadBranches clears prior rows immediately so a user switch cannot show stale branches.
  useEffect(() => {
    if (activeTab !== "institution" || !isAdmin) return undefined
    void loadBranches()
  }, [activeTab, isAdmin, userScopeKey, loadBranches])

  const loadPolicies = useCallback(async () => {
    const reqId = ++policiesReqIdRef.current
    setPoliciesLoading(true)
    setPoliciesError(null)
    setLivePolicies([])
    try {
      const res = await fetchAgentPolicies()
      if (reqId !== policiesReqIdRef.current) return
      setLivePolicies(Array.isArray(res?.data) ? res.data : [])
    } catch (err) {
      if (reqId !== policiesReqIdRef.current) return
      setLivePolicies([])
      setPoliciesError(err?.message || "Failed to load agent policies.")
    } finally {
      if (reqId === policiesReqIdRef.current) {
        setPoliciesLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    if (activeTab !== "agents" || !isAdmin) return undefined
    void loadPolicies()
  }, [activeTab, isAdmin, userScopeKey, loadPolicies])

  const triggerToast = (msg) => {
    setShowToast({ visible: true, message: msg })
    setTimeout(() => setShowToast({ visible: false, message: "" }), 3000)
    setUnsavedChanges(false)
  }

  // Admin Check wrapper for tabs
  const renderTabContent = () => {
    const currentTabObj = TABS.find(t => t.id === activeTab)
    if (currentTabObj?.adminOnly && !isAdmin) {
      return (
        <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
          <Lock size={48} className="mb-4 text-muted-foreground" />
          <h2 className="text-xl font-bold text-foreground mb-2">Admin Access Required</h2>
          <p className="text-center max-w-md">Institution settings can only be modified by the Institution Admin. Contact your administrator to make changes.</p>
        </div>
      )
    }

    switch(activeTab) {
      case "account": return <TabAccount />
      case "institution": return <TabInstitution />
      case "notifications": return <TabNotifications />
      case "agents": return <TabAgents />
      case "privacy": return <TabPrivacy />
      default: return null
    }
  }

  // --- TAB SUBCOMPONENTS ---

  const TabAccount = () => {
    const getInitials = (f, l) => `${f?.[0] || ""}${l?.[0] || ""}` || "U"
    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        <div>
          <h2 className="text-xl font-bold text-foreground">Account Settings</h2>
          <p className="text-muted-foreground text-sm">
            Your authenticated profile. Edits are unavailable until account write APIs are connected.
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-xl font-bold text-white shadow-lg">
              {getInitials(displayFirstName, displayLastName)}
            </div>
            <div>
              <div className="text-lg font-bold text-foreground">
                {[displayFirstName, displayLastName].filter(Boolean).join(" ") || "User"}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="bg-muted text-foreground/80 text-xs px-2 py-0.5 rounded-full font-medium">
                  {displayRole}
                </span>
                <span className="text-muted-foreground text-xs">
                  • {institutionLabel}
                </span>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">First Name</label>
                <input
                  type="text"
                  readOnly
                  value={displayFirstName}
                  className="w-full bg-muted border border-border rounded-lg p-2.5 text-foreground text-sm cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">Last Name</label>
                <input
                  type="text"
                  readOnly
                  value={displayLastName}
                  className="w-full bg-muted border border-border rounded-lg p-2.5 text-foreground text-sm cursor-not-allowed"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1">Email Address</label>
              <input
                type="email"
                readOnly
                value={displayEmail}
                placeholder="Not available"
                className="w-full bg-muted border border-border rounded-lg p-2.5 text-foreground text-sm cursor-not-allowed placeholder:text-muted-foreground"
              />
            </div>
            <div className="pt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                disabled
                title="Profile updates are not connected to a backend API"
                className="bg-muted text-muted-foreground text-sm font-medium px-6 py-2 rounded-lg border border-border cursor-not-allowed opacity-70"
              >
                Save Changes
              </button>
              <span className="text-xs text-muted-foreground">
                Saving is unavailable - no profile write API is connected.
              </span>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-foreground mb-2">Password</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Password changes are not available here. No password-update API is connected
            to this Settings page.
          </p>
          <button
            type="button"
            disabled
            className="bg-muted text-muted-foreground text-sm font-medium px-6 py-2 rounded-lg border border-border cursor-not-allowed opacity-70"
          >
            Update Password
          </button>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-foreground mb-2">Active Sessions</h3>
          <p className="text-sm text-muted-foreground">
            Session listing and remote revoke are not connected. Only your current browser
            session is managed by local authentication.
          </p>
        </div>
      </div>
    )
  }

  const formatBranchPlace = (branch) => {
    const parts = [branch?.location, branch?.district]
      .map((p) => (typeof p === "string" ? p.trim() : ""))
      .filter(Boolean)
    return parts.length > 0 ? parts.join(" - ") : "No location on file"
  }

  const TabInstitution = () => {
    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        <div>
          <h2 className="text-xl font-bold text-foreground">Institution Settings</h2>
          <p className="text-muted-foreground text-sm">
            View your institution profile and live branch list. Profile edits are not
            available until write APIs are connected.
          </p>
        </div>

        {/* Onboarding - signed-in tenants are redirected away from /onboarding; wizard does not write tenant APIs */}
        <div className="bg-card border border-blue-500/20 rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-foreground mb-1">
              Review Onboarding Configuration
            </h3>
            <p className="text-sm text-muted-foreground">
              {isAuthenticatedSession
                ? "While signed in, the onboarding route returns you to the dashboard. The wizard does not update live institution or branch data through tenant APIs."
                : "The setup wizard mainly updates local demo state. It does not provide a durable tenant write path for institution settings."}
            </p>
          </div>
          <button
            type="button"
            disabled={isAuthenticatedSession}
            title={
              isAuthenticatedSession
                ? "Unavailable while signed in - /onboarding redirects to the dashboard"
                : undefined
            }
            onClick={() => {
              if (isAuthenticatedSession) return
              navigate("/onboarding")
            }}
            className={`shrink-0 text-sm font-medium px-6 py-2.5 rounded-lg transition-colors shadow-sm ${
              isAuthenticatedSession
                ? "bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-70"
                : "bg-blue-600 hover:bg-blue-500 text-white"
            }`}
          >
            Review Configuration
          </button>
        </div>

        {/* Institution Profile */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-foreground mb-4">Institution Profile</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1">Institution Name</label>
              <input
                type="text"
                readOnly
                value={institutionLabel}
                className="w-full bg-muted border border-border text-foreground rounded-lg p-2.5 text-sm cursor-not-allowed"
              />
              <div className="text-[10px] text-muted-foreground mt-1">
                From your authenticated session (login). Not editable here.
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1">Registration Number</label>
              <input
                type="text"
                readOnly
                value=""
                placeholder="Not available"
                className="w-full bg-muted border border-border text-muted-foreground rounded-lg p-2.5 text-sm cursor-not-allowed placeholder:text-muted-foreground"
              />
              <div className="text-[10px] text-muted-foreground mt-1">
                Not provided by the tenant API yet.
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1">Institution Type</label>
              <input
                type="text"
                readOnly
                value=""
                placeholder="Not available"
                className="w-full bg-muted border border-border text-muted-foreground rounded-lg p-2.5 text-sm cursor-not-allowed placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1">District</label>
              <input
                type="text"
                readOnly
                value=""
                placeholder="Not available"
                className="w-full bg-muted border border-border text-muted-foreground rounded-lg p-2.5 text-sm cursor-not-allowed placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1">Number of Branches</label>
              <input
                type="text"
                readOnly
                value={
                  branchLoading
                    ? "Loading..."
                    : branchError
                      ? "-"
                      : branchCount == null
                        ? "-"
                        : String(branchCount)
                }
                className="w-full bg-muted border border-border text-muted-foreground rounded-lg p-2.5 text-sm cursor-not-allowed"
              />
            </div>
          </div>
          <div className="pt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              disabled
              title="Institution profile updates are not connected to a backend API"
              className="bg-muted text-muted-foreground text-sm font-medium px-6 py-2 rounded-lg border border-border cursor-not-allowed opacity-70"
            >
              Save Institution Profile
            </button>
            <span className="text-xs text-muted-foreground">
              Saving is unavailable - no write API is connected.
            </span>
          </div>
        </div>

        {/* Branch Management */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <h3 className="text-lg font-bold text-foreground">Branch Management</h3>
            <button
              type="button"
              disabled
              title="Adding branches is not connected to a backend API"
              className="flex items-center gap-1 text-sm bg-muted text-muted-foreground px-3 py-1.5 rounded border border-border cursor-not-allowed opacity-70"
            >
              <Plus size={16} /> Add Branch
            </button>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Live branches from your tenant database. Add, edit, and delete are unavailable
            until write APIs exist. Manager is not returned by the API.
          </p>
          <div className="space-y-3">
            {branchLoading && (
              <div className="p-6 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                Loading branches...
              </div>
            )}
            {!branchLoading && branchError && (
              <div className="p-6 text-center border border-dashed border-border rounded-lg space-y-3">
                <p className="text-sm text-muted-foreground">{branchError}</p>
                <button
                  type="button"
                  onClick={loadBranches}
                  className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
                >
                  Retry
                </button>
              </div>
            )}
            {!branchLoading && !branchError && liveBranches.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                No active branches recorded for this tenant.
              </div>
            )}
            {!branchLoading &&
              !branchError &&
              liveBranches.map((b) => (
                <div
                  key={b.id}
                  className="p-4 bg-muted border border-border rounded-lg flex items-center justify-between"
                >
                  <div>
                    <div className="text-sm font-bold text-foreground">
                      {b.name || "-"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatBranchPlace(b)}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-foreground mb-2">Loan Products</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Product configuration is not connected on this page. Manage live products in the
            loan workspace - these Settings toggles do not update the server.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loanProducts.map((p) => (
              <div
                key={p.id}
                className="p-4 rounded-xl border flex justify-between items-center bg-background border-border opacity-70"
              >
                <div>
                  <div className="text-sm font-bold text-foreground">{p.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {p.range} • {p.cycle}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    Demo list only - not live M3 catalog
                  </div>
                </div>
                <button
                  type="button"
                  disabled
                  title="Loan product toggles are not connected in Settings"
                  className={`relative inline-flex h-6 w-11 items-center rounded-full cursor-not-allowed ${
                    p.active ? "bg-blue-600/50" : "bg-accent"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      p.active ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4 text-xs text-muted-foreground flex items-center gap-1.5">
            <Info size={14} /> Settings loan toggles are unavailable. M3 loan product APIs are unchanged.
          </div>
        </div>
      </div>
    )
  }

  const TabNotifications = () => {
    const renderToggle = (type, key, label, desc, adminReq) => {
      const active = notifications[type][key]
      const disabled = adminReq && !isAdmin
      return (
        <div className={`flex items-center justify-between p-3 rounded-lg ${disabled ? 'opacity-50' : 'hover:bg-muted/30'} transition-colors`}>
          <div className="pr-4">
            <div className="text-sm font-medium text-foreground flex items-center gap-2">
              {label}{" "}
              <span className="text-[10px] font-normal text-muted-foreground uppercase tracking-wide">
                Local only
              </span>
              {disabled && <Lock size={12} className="text-muted-foreground" />}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
          </div>
          <button 
            disabled={disabled}
            onClick={() => {
              updateNotification(type, key, !active)
              triggerToast("Saved in this browser only - not synced to the server.")
            }}
            className={`relative shrink-0 inline-flex h-5 w-9 items-center rounded-full transition-colors ${active ? 'bg-blue-600' : 'bg-accent'}`}
          >
            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${active ? 'translate-x-5' : 'translate-x-1'}`} />
          </button>
        </div>
      )
    }

    const emailCount = Object.values(notifications.email).filter(Boolean).length
    const inAppCount = Object.values(notifications.inApp).filter(Boolean).length

    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        <div>
          <h2 className="text-xl font-bold text-foreground">Notification Preferences</h2>
          <p className="text-muted-foreground text-sm">
            Browser-only preferences stored locally. They are not persisted by a notification API.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-foreground mb-4 border-b border-border pb-2">Email Notifications</h3>
            <div className="space-y-1">
              {renderToggle('email', 'agentAnomaly', 'Agent anomaly alerts', 'Get notified when Agent 3 flags an unusual transaction')}
              {renderToggle('email', 'tier3Approval', 'Tier 3 approval requests', 'Get notified when an agent action requires your approval')}
              {renderToggle('email', 'payrollCompletion', 'Payroll completion', 'Get notified when monthly payroll has been processed')}
              {renderToggle('email', 'centralBankReport', 'Central Bank report ready', 'Get notified when Agent 1 has compiled the monthly report')}
              {renderToggle('email', 'newStaffAccounts', 'New staff accounts', 'Get notified when a new user account is created', true)}
              {renderToggle('email', 'budgetThreshold', 'Budget threshold alerts', 'Get notified when a branch exceeds its monthly budget')}
              {renderToggle('email', 'newDeviceLogin', 'Login from new device', 'Get notified when your account is accessed from an unrecognised device')}
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-foreground mb-4 border-b border-border pb-2">In-App Notifications</h3>
            <div className="space-y-1">
              {renderToggle('inApp', 'agentAnomaly', 'Agent anomaly alerts', 'Get notified when Agent 3 flags an unusual transaction')}
              {renderToggle('inApp', 'tier3Approval', 'Tier 3 approval requests', 'Get notified when an agent action requires your approval')}
              {renderToggle('inApp', 'payrollCompletion', 'Payroll completion', 'Get notified when monthly payroll has been processed')}
              {renderToggle('inApp', 'centralBankReport', 'Central Bank report ready', 'Get notified when Agent 1 has compiled the monthly report')}
              {renderToggle('inApp', 'newStaffAccounts', 'New staff accounts', 'Get notified when a new user account is created', true)}
              {renderToggle('inApp', 'budgetThreshold', 'Budget threshold alerts', 'Get notified when a branch exceeds its monthly budget')}
              {renderToggle('inApp', 'newDeviceLogin', 'Login from new device', 'Get notified when your account is accessed from an unrecognised device')}
            </div>
          </div>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <Bell className="text-blue-400" size={20} />
            <div className="text-sm text-foreground">
              <span className="font-bold">{emailCount}</span> email and{" "}
              <span className="font-bold">{inAppCount}</span> in-app toggles are on in this
              browser only (not server-backed).
            </div>
          </div>
        </div>
      </div>
    )
  }

  const TabAgents = () => {
    const getAgentUI = (id) => {
      switch (id) {
        case "A1":
          return { name: "Agent 1", desc: "Compliance & Reporting", color: "purple" }
        case "A2":
          return { name: "Agent 2", desc: "Workflow Orchestrator", color: "blue" }
        case "A3":
          return { name: "Agent 3", desc: "Anomaly Detection", color: "red" }
        case "A4":
          return { name: "Agent 4", desc: "NLQ Interface", color: "teal" }
        default:
          return { name: "", desc: "", color: "slate" }
      }
    }

    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        <div>
          <h2 className="text-xl font-bold text-foreground">Agent Settings</h2>
          <p className="text-muted-foreground text-sm">
            Agent enablement and sensitivity are not configured from this page. Live tier
            policies below are read-only from the tenant API.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agentSettings.agents.map((a) => {
            const ui = getAgentUI(a.id)
            return (
              <div
                key={a.id}
                className="bg-card border border-border rounded-xl p-5 shadow-sm opacity-90"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-foreground font-bold text-lg">
                      {a.id}
                    </div>
                    <div>
                      <div className="font-bold text-foreground">{ui.name}</div>
                      <div className="text-xs text-muted-foreground">{ui.desc}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled
                    title="Agent enable/disable is not connected to the backend"
                    className="relative inline-flex h-6 w-11 items-center rounded-full bg-accent cursor-not-allowed opacity-70"
                  >
                    <span className="inline-block h-4 w-4 transform translate-x-1 rounded-full bg-white" />
                  </button>
                </div>
                <div className="text-xs text-muted-foreground">
                  Enable/disable unavailable - not persisted by Settings.
                </div>
              </div>
            )
          })}
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-foreground mb-2">
            Agent 3 - Anomaly Detection Sensitivity
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Sensitivity is not configurable here. No Settings write API updates Agent 3
            thresholds.
          </p>
          <button
            type="button"
            disabled
            className="bg-muted text-muted-foreground text-xs font-medium px-4 py-2 rounded border border-border cursor-not-allowed opacity-70"
          >
            Save Sensitivity
          </button>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-border">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-foreground mb-1">
                  Graduated Trust policies (read-only)
                </h3>
                <p className="text-sm text-muted-foreground">
                  Loaded from GET /api/tenant/agent-policies. Edit policies on the Graduated
                  Trust page - Settings does not modify them.
                </p>
              </div>
              <Link
                to="/graduated-trust"
                className="text-sm font-medium text-primary hover:underline"
              >
                Open Graduated Trust
              </Link>
            </div>
          </div>
          <div className="overflow-x-auto">
            {policiesLoading && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Loading policies...
              </div>
            )}
            {!policiesLoading && policiesError && (
              <div className="p-8 text-center space-y-3">
                <p className="text-sm text-muted-foreground">{policiesError}</p>
                <button
                  type="button"
                  onClick={loadPolicies}
                  className="text-sm font-medium text-blue-600 hover:text-blue-500"
                >
                  Retry
                </button>
              </div>
            )}
            {!policiesLoading && !policiesError && livePolicies.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No agent policies returned for this tenant.
              </div>
            )}
            {!policiesLoading && !policiesError && livePolicies.length > 0 && (
              <table className="w-full text-sm text-left text-foreground/80">
                <thead className="text-xs text-muted-foreground uppercase bg-muted border-b border-border font-bold">
                  <tr>
                    <th className="px-6 py-3">Action Type</th>
                    <th className="px-6 py-3">Agent</th>
                    <th className="px-6 py-3">Tier</th>
                    <th className="px-6 py-3">Active</th>
                    <th className="px-6 py-3">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {livePolicies.map((policy) => (
                    <tr key={policy.id} className="hover:bg-muted/20">
                      <td className="px-6 py-4 font-medium text-foreground font-mono text-xs">
                        {policy.actionType || "-"}
                      </td>
                      <td className="px-6 py-4 text-xs">
                        {policy.agentId || "-"}
                        {policy.agentName ? (
                          <span className="text-muted-foreground">
                            {" "}
                            · {policy.agentName}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-muted border border-border px-2.5 py-1 rounded text-xs font-bold whitespace-nowrap">
                          Tier {policy.tier ?? "-"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs">
                        {policy.isActive ? "Yes" : "No"}
                      </td>
                      <td className="px-6 py-4 text-xs text-muted-foreground max-w-xs">
                        {policy.description || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="p-4 bg-muted text-xs text-muted-foreground border-t border-border flex items-center gap-1.5">
            <Info size={14} /> Read-only view. Policy changes belong on Graduated Trust.
          </div>
        </div>
      </div>
    )
  }

  const TabPrivacy = () => {
    const [delConfirm, setDelConfirm] = useState("")
    const [showDelModal, setShowDelModal] = useState(false)

    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        <div>
          <h2 className="text-xl font-bold text-foreground">Data & Privacy</h2>
          <p className="text-muted-foreground text-sm">
            Export and destructive actions stay unavailable until authorized backend
            workflows exist.
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-foreground mb-2">Export Institution Data</h3>
          <p className="text-sm text-muted-foreground mb-4">
            CSV export is not connected - these buttons do not download files.
          </p>
          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              disabled
              className="bg-muted text-muted-foreground text-sm font-medium px-4 py-2.5 rounded-lg border border-border cursor-not-allowed opacity-70"
            >
              Export All Loan Data - CSV
            </button>
            <button
              type="button"
              disabled
              className="bg-muted text-muted-foreground text-sm font-medium px-4 py-2.5 rounded-lg border border-border cursor-not-allowed opacity-70"
            >
              Export Staff & Payroll Data - CSV
            </button>
            <button
              type="button"
              disabled
              className="bg-muted text-muted-foreground text-sm font-medium px-4 py-2.5 rounded-lg border border-border cursor-not-allowed opacity-70"
            >
              Export Agent Activity Log - CSV
            </button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-foreground mb-2 flex items-center gap-2">
            <Shield size={18} className="text-blue-400" /> Data Retention Policy
          </h3>
          <p className="text-sm text-foreground/80 leading-relaxed max-w-3xl">
            Automated data-retention periods and regulatory compliance for transactions,
            agent logs, and staff records are not configured or verified in this product
            build. Treat retention as not yet enforced until a documented retention
            workflow is implemented.
          </p>
        </div>

        {isAdmin && (
          <div className="bg-card border border-border border-l-4 border-l-red-500 rounded-xl p-6 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-bl-full pointer-events-none" />
            <h3 className="text-lg font-bold text-red-500 mb-1 flex items-center gap-2">
              <AlertTriangle size={18} /> Danger Zone
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Destructive actions require authorized backend workflows.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              {!isAuthenticatedSession && (
                <button
                  type="button"
                  disabled
                  className="py-2.5 px-6 rounded-lg border-2 border-red-500/30 text-red-400/70 font-bold cursor-not-allowed opacity-70 bg-background"
                >
                  Reset Demo Data
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowDelModal(true)}
                className="py-2.5 px-6 rounded-lg border-2 border-red-500/50 text-red-400 font-bold hover:bg-red-500/10 transition-colors bg-background"
              >
                Delete Institution
              </button>
            </div>
            {isAuthenticatedSession && (
              <p className="text-xs text-muted-foreground mt-3">
                Demo reset is hidden while you are signed into an institution session.
              </p>
            )}
          </div>
        )}

        {showDelModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-card border border-red-500 rounded-2xl w-full max-w-md shadow-2xl p-6">
              <h2 className="text-xl font-bold text-foreground mb-2">Delete Institution?</h2>
              <p className="text-muted-foreground text-sm mb-4 leading-relaxed">
                Institution deletion is not connected to an authorized backend workflow.
                Confirmation below cannot permanently delete your tenant.
              </p>
              <div className="mb-6">
                <label className="block text-xs font-bold text-muted-foreground mb-2">
                  Type <span className="text-foreground select-none">{institutionLabel}</span> to
                  acknowledge.
                </label>
                <input
                  type="text"
                  value={delConfirm}
                  onChange={(e) => setDelConfirm(e.target.value)}
                  className="w-full bg-muted border border-border rounded-lg p-2.5 text-foreground text-sm focus:border-red-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowDelModal(false)
                    setDelConfirm("")
                  }}
                  className="flex-1 py-2.5 rounded-lg border border-border text-foreground/80 hover:bg-muted transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={delConfirm !== institutionLabel}
                  onClick={() => {
                    setShowDelModal(false)
                    setDelConfirm("")
                    triggerToast(
                      "Institution deletion is unavailable - no authorized delete API."
                    )
                  }}
                  className="flex-1 py-2.5 rounded-lg bg-red-600 text-white font-bold hover:bg-red-500 disabled:opacity-30 disabled:hover:bg-red-600 transition-colors"
                >
                  Delete Permanently
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex-1 flex overflow-hidden bg-background text-foreground font-sans">
      
      {/* Top Banner for Unsaved Changes */}
      {unsavedChanges && (
        <div className="absolute top-0 left-0 right-0 h-10 bg-amber-500/10 border-b border-amber-500/20 text-amber-500 text-sm font-medium flex items-center justify-center gap-2 z-50 animate-in slide-in-from-top-10">
          <AlertTriangle size={16} /> You have unsaved changes in this section.
        </div>
      )}

      {/* Toast Notification */}
      {showToast.visible && (
        <div className="fixed bottom-6 right-6 bg-muted border border-blue-500/30 text-foreground px-5 py-3 rounded-lg shadow-2xl flex items-center gap-3 z-50 animate-in slide-in-from-bottom-5">
          <CheckCircle className="text-green-400" size={20} />
          <div className="text-sm font-medium">{showToast.message}</div>
        </div>
      )}

      {/* Left Sidebar Tabs */}
      <div className="w-72 bg-muted/40 border-r border-border flex flex-col shrink-0">
        <div className="p-8 pb-4">
          <h1 className="text-3xl font-bold text-foreground tracking-tight mb-2">Settings</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">Manage your account, institution, and system preferences.</p>
        </div>
        <div className="px-4 py-4 space-y-1 overflow-y-auto custom-scrollbar flex-1">
          {TABS.map(t => {
            const isActive = activeTab === t.id
            const isDisabled = t.adminOnly && !isAdmin
            return (
              <button
                key={t.id}
                onClick={() => {
                  if (isDisabled) return
                  if (t.id === "institution") {
                    setBranchLoading(true)
                    setBranchError(null)
                    setLiveBranches([])
                    setBranchCount(null)
                  }
                  setActiveTab(t.id)
                }}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all relative ${
                  isActive 
                    ? "bg-blue-600/10 text-blue-400 font-medium" 
                    : isDisabled 
                      ? "text-muted-foreground cursor-not-allowed" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer"
                }`}
              >
                {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-r"></div>}
                <div className="flex items-center gap-3 ml-2">
                  <t.icon size={18} className={isActive ? "text-blue-400" : isDisabled ? "text-muted-foreground" : "text-muted-foreground"} />
                  {t.label}
                </div>
                <div className="flex items-center gap-2">
                  {unsavedChanges && isActive && <div className="w-2 h-2 rounded-full bg-amber-500"></div>}
                  {isDisabled && <Lock size={14} />}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Right Content Area */}
      <div className="flex-1 overflow-y-auto bg-background p-8 lg:p-12 custom-scrollbar mt-10 lg:mt-0 relative">
         <div className="max-w-5xl mx-auto">
            {renderTabContent()}
         </div>
      </div>

    </div>
  )
}
