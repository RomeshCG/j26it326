import { useState, useEffect } from "react"
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from "react-router-dom"

import { ThemeProvider } from "@/components/theme-provider"
import {
  CollectionPage,
  DisbursementPage,
  EwsAlertInboxPage,
  EwsAlertPage,
  GroupLendingPage,
  LoanDetailPage,
  LoanOfficerDashboardPage,
  OverdueQueuePage,
  BranchPortfolioPage,
} from "@/components/c3"
import LoanTypeSelection from "@/components/application-profile/LoanTypeSelection"
import ApplicationWizard from "@/components/application-profile/ApplicationWizard"
import ApplicationView from "@/components/application-profile/ApplicationView"
import Login from "@/components/c4/auth/Login"
import Signup from "@/components/c4/auth/Signup"
import VerifyDomain from "@/components/c4/auth/VerifyDomain"
import OnboardingWizard from "@/components/c4/onboarding-wizard"
import Payroll from "@/components/c4/payroll"
import HRManagement from "@/components/c4/hr-management"
import ExecutiveDashboard from "@/components/c4/executive-dashboard"
import BranchManagerDashboard from "@/components/c4/branch-manager/BranchManagerDashboard"
import DashboardLayout from "@/components/c4/DashboardLayout"
import AgentLog from "@/components/c4/agent-log"
import GraduatedTrust from "@/components/c4/graduated-trust"
import TierApproval from "@/components/c4/tier-approval"
import Settings from "@/components/c4/settings"
import FinanceManagerDashboard from "@/components/c2/FinanceManagerDashboard"
import MissionDriftAlerts from "@/components/c2/MissionDriftAlerts"
import MissionDriftDetail from "@/components/c2/MissionDriftDetail"
import BalanceSheetReport from "@/components/c2/BalanceSheetReport"
import CashFlowReport from "@/components/c2/CashFlowReport"
import PAndLReport from "@/components/c2/PAndLReport"
import SocialPerformance from "@/components/c2/SocialPerformance"
import RiskReportPage from "@/components/risk-report"
import TrustProfilePage from "@/components/trust-profile"
import AbExperimentPage from "@/components/ab-experiment"
import AgentPanel from "@/components/c4/AgentPanel"
import BorrowerManagementPage from "@/components/borrower-management/page"
import { useStore } from "@/store"
import { verifySessionOnce, getCachedSession, isJwtExpired, endClientSession } from "@/lib/api"
import { getRoleRedirect, toDisplayRole } from "@/lib/roles"

function ProtectedRoute({ children }) {
  const location = useLocation()
  const token = localStorage.getItem("mf_auth_token")
  const cached = getCachedSession()
  const [checking, setChecking] = useState(!cached && !!token)
  const [authenticated, setAuthenticated] = useState(!!token)

  useEffect(() => {
    let isMounted = true
    if (!token) return

    // Verify session with /auth/me ONCE per page load and keep in memory
    verifySessionOnce()
      .then((user) => {
        if (!isMounted) return
        if (user) {
          const displayRole = toDisplayRole(user.role)
          const userBranch = user.branch || "Head Office"
          localStorage.setItem("mf_auth_role", displayRole)
          localStorage.setItem("mf_auth_branch", userBranch)

          const names = (user.fullName || "").trim().split(/\s+/)
          useStore.getState().login({
            id: user.userId || user.id,
            firstName: names[0] || user.fullName || "User",
            lastName: names.slice(1).join(" ") || "",
            name: user.fullName || "User",
            email: user.email,
            phone: "",
            role: displayRole,
            backendRole: user.role,
            branch: userBranch,
            institutionId: user.institutionId,
            memberSince: "Oct 2026",
            language: "English",
          })
          setAuthenticated(true)
        }
      })
      .catch(() => {
        if (!isMounted) return
        setAuthenticated(false)
      })
      .finally(() => {
        if (isMounted) setChecking(false)
      })

    return () => {
      isMounted = false
    }
  }, [token])

  // All hooks executed above. Conditional checks and returns follow:
  if (location.pathname && token && isJwtExpired(token)) {
    endClientSession()
    return <Navigate to="/login?expired=true" replace />
  }

  if (!token || !authenticated) {
    return <Navigate to="/login" replace />
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-muted-foreground font-medium">Validating secure session...</span>
        </div>
      </div>
    )
  }

  return children
}

/**
 * Route guard using strictly the verified backend role from in-memory session (getCachedSession).
 * If no session is cached, redirects to /login.
 */
function RequireRole({ allowedRoles, children }) {
  const cached = getCachedSession()

  if (!cached) {
    return <Navigate to="/login" replace />
  }

  const isAllowed = allowedRoles.includes(cached.role)

  if (!isAllowed) {
    const roleHome = getRoleRedirect(cached.role)
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6 text-foreground">
        <div className="w-full max-w-md bg-card border border-border rounded-xl p-8 text-center shadow-lg">
          <div className="mx-auto w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground text-xs mb-6">
            Your role does not have authorization to view this area.
          </p>
          <Link
            to={roleHome}
            className="block w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg font-medium text-xs transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return children
}

function OnboardingRoute() {
  const isMockAuth = import.meta.env.VITE_USE_MOCK_AUTH === "true"
  const token = localStorage.getItem("mf_auth_token")
  const cached = getCachedSession()
  // Hook must run unconditionally (before any early return)
  const onboardingComplete = useStore((state) => state.onboardingComplete)

  // Real auth mode: if an active session exists, redirect to dashboard so logged-in admins cannot register another institution
  if (!isMockAuth && (token || cached)) {
    return <Navigate to="/dashboard" replace />
  }

  // In mock auth mode: allow mock admin to view/re-run onboarding in layout if complete
  if (isMockAuth && onboardingComplete && cached) {
    return (
      <DashboardLayout>
        <OnboardingWizard />
      </DashboardLayout>
    )
  }

  // Otherwise public registration onboarding wizard for new institutions
  return <OnboardingWizard />
}

function App() {
  const currentUser = useStore((state) => state.currentUser)
  const agentPanelKey =
    currentUser?.id ?? currentUser?.userId ?? currentUser?.email ?? "signed-out"

  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/onboarding" element={<OnboardingRoute />} />
          <Route path="/verify-domain" element={<VerifyDomain />} />
          <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<ExecutiveDashboard />} />
            <Route
              path="/branch-manager"
              element={
                <RequireRole allowedRoles={["branch_manager"]}>
                  <BranchManagerDashboard />
                </RequireRole>
              }
            />
            <Route path="/borrowers" element={<BorrowerManagementPage />} />
            <Route path="/hr" element={<HRManagement />} />
            <Route path="/payroll" element={<Payroll />} />
            <Route
              path="/agent-log"
              element={
                <RequireRole allowedRoles={["admin", "executive", "branch_manager"]}>
                  <AgentLog />
                </RequireRole>
              }
            />
            <Route
              path="/graduated-trust"
              element={
                <RequireRole allowedRoles={["admin", "executive", "branch_manager"]}>
                  <GraduatedTrust />
                </RequireRole>
              }
            />
            <Route
              path="/tier-approval"
              element={
                <RequireRole allowedRoles={["admin", "executive", "branch_manager"]}>
                  <TierApproval />
                </RequireRole>
              }
            />
            <Route path="/settings" element={<Settings />} />
            <Route path="/finance-manager" element={<FinanceManagerDashboard />} />
            <Route path="/alerts" element={<MissionDriftAlerts />} />
            <Route path="/mission-drift/detail" element={<MissionDriftDetail />} />
            <Route path="/pl-report" element={<PAndLReport />} />
            <Route path="/balance-sheet" element={<BalanceSheetReport />} />
            <Route path="/cash-flow" element={<CashFlowReport />} />
            <Route path="/social-performance" element={<SocialPerformance />} />
            <Route path="/loan-officer" element={<LoanOfficerDashboardPage />} />
            <Route
              path="/loan-officer/borrowers"
              element={<BorrowerManagementPage />}
            />
            <Route
              path="/loan-officer/applications/new"
              element={<LoanTypeSelection />}
            />
            <Route
              path="/loan-officer/applications/new/:loanType"
              element={<ApplicationWizard />}
            />
            <Route
              path="/loan-officer/applications/:applicationId/edit"
              element={<ApplicationWizard />}
            />
            <Route
              path="/loan-officer/applications/:applicationId"
              element={<ApplicationView />}
            />
            <Route
              path="/loan-officer/disbursement"
              element={<DisbursementPage />}
            />
            <Route
              path="/loan-officer/collection"
              element={<CollectionPage />}
            />
            <Route
              path="/loan-officer/overdue"
              element={<OverdueQueuePage />}
            />
            <Route
              path="/loan-officer/branch"
              element={<BranchPortfolioPage />}
            />
            <Route
              path="/loan-officer/loans/:loanId"
              element={<LoanDetailPage />}
            />
            <Route
              path="/loan-officer/groups/:groupId"
              element={<GroupLendingPage />}
            />
            <Route
              path="/loan-officer/alerts"
              element={<EwsAlertInboxPage />}
            />
            <Route
              path="/loan-officer/alerts/:alertId"
              element={<EwsAlertPage />}
            />
            <Route
              path="/loan-officer/risk-report"
              element={<RiskReportPage />}
            />
            <Route
              path="/loan-officer/trust-profile"
              element={<TrustProfilePage />}
            />
            <Route
              path="/research/ab-experiment"
              element={<AbExperimentPage />}
            />
          </Route>
        </Routes>
        <AgentPanel key={agentPanelKey} />
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
