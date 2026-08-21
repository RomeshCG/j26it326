import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { ThemeProvider } from "@/components/theme-provider"
import Login from "@/components/c4/auth/Login"
import Signup from "@/components/c4/auth/Signup"
import OnboardingWizard from "@/components/c4/onboarding-wizard"
import Payroll from "@/components/c4/payroll"
import { Dashboard, AgentLog, TierApproval } from "@/components/c4/Placeholders"

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
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/payroll" 
            element={
              <ProtectedRoute>
                <Payroll />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/agent-log" 
            element={
              <ProtectedRoute>
                <AgentLog />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/tier-approval" 
            element={
              <ProtectedRoute>
                <TierApproval />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App

