import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"

import { ThemeProvider } from "@/components/theme-provider"
import {
  CollectionPage,
  EwsAlertPage,
  LoanApplicationPage,
  LoanOfficerDashboardPage,
} from "@/components/c3"
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
            <Route path="/loan-officer" element={<LoanOfficerDashboardPage />} />
            <Route
              path="/loan-officer/application"
              element={<LoanApplicationPage />}
            />
            <Route
              path="/loan-officer/collection"
              element={<CollectionPage />}
            />
            <Route
              path="/loan-officer/alerts/:alertId"
              element={<EwsAlertPage />}
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
