import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom"

import { ThemeProvider } from "@/components/theme-provider"
import {
  CollectionPage,
  DisbursementPage,
  EwsAlertInboxPage,
  EwsAlertPage,
  GroupLendingPage,
  LoanApplicationPage,
  LoanDetailPage,
  LoanOfficerDashboardPage,
  OverdueQueuePage,
  BranchPortfolioPage,
} from "@/components/c3"
import Login from "@/components/c4/auth/Login"
import Signup from "@/components/c4/auth/Signup"
import OnboardingWizard from "@/components/c4/onboarding-wizard"
import Payroll from "@/components/c4/payroll"
import HRManagement from "@/components/c4/hr-management"
import ExecutiveDashboard from "@/components/c4/executive-dashboard"
import DashboardLayout from "@/components/c4/DashboardLayout"
import AgentLog from "@/components/c4/agent-log"
import TierApproval from "@/components/c4/tier-approval"
import Settings from "@/components/c4/settings"
import RiskReportPage from "@/components/risk-report"
import TrustProfilePage from "@/components/trust-profile"
import AbExperimentPage from "@/components/ab-experiment"
import AgentPanel from "@/components/c4/AgentPanel"
import { useStore } from "@/store"

function ProtectedRoute({ children }) {
  const token = localStorage.getItem("mf_auth_token")
  if (!token) {
    return <Navigate to="/login" replace />
  }
  return children
}

function OnboardingRoute() {
  const token = localStorage.getItem("mf_auth_token")
  if (!token) {
    return <Navigate to="/login" replace />
  }
  
  const role = localStorage.getItem("mf_auth_role")
  if (role !== "Institution Admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <div className="w-full max-w-md bg-card border border-border rounded-xl p-8 text-center shadow-lg">
          <div className="mx-auto w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground text-sm mb-8">
            Onboarding configuration can only be accessed by the Institution Admin.
          </p>
          <Link 
            to="/dashboard"
            className="block w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg font-medium transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }
  
  const onboardingComplete = useStore((state) => state.onboardingComplete)

  if (onboardingComplete) {
    return (
      <DashboardLayout>
        <OnboardingWizard />
      </DashboardLayout>
    )
  }

  return <OnboardingWizard />
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/onboarding" element={<OnboardingRoute />} />
          <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<ExecutiveDashboard />} />
            <Route path="/hr" element={<HRManagement />} />
            <Route path="/payroll" element={<Payroll />} />
            <Route path="/agent-log" element={<AgentLog />} />
            <Route path="/tier-approval" element={<TierApproval />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/loan-officer" element={<LoanOfficerDashboardPage />} />
            <Route
              path="/loan-officer/application"
              element={<LoanApplicationPage />}
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
        <AgentPanel />
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
