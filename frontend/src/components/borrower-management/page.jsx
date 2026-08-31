import { Navigate, useNavigate } from "react-router-dom"

import { useStore } from "@/store"

import BorrowerManagement from "./index"
import { BORROWER_ACCESS_ROLES } from "./mock-data"

export default function BorrowerManagementPage() {
  const navigate = useNavigate()
  const role =
    useStore((state) => state.currentUser?.role) ||
    localStorage.getItem("mf_auth_role") ||
    "Institution Admin"

  if (!BORROWER_ACCESS_ROLES.includes(role)) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <BorrowerManagement
      onOpenRiskReport={(borrower) =>
        navigate("/loan-officer/risk-report", {
          state: {
            applicationId: borrower.applicationId,
            applicant: {
              name: borrower.name,
              nic: borrower.nic,
              date: new Date().toISOString().slice(0, 10),
            },
            riskScore: borrower.riskScore,
            product: borrower.product,
          },
        })
      }
      onOpenLoan={(loanId) => navigate(`/loan-officer/loans/${loanId}`)}
      onOpenAlert={(alertId) => navigate(`/loan-officer/alerts/${alertId}`)}
      onNewApplication={() => navigate("/loan-officer/applications/new")}
      onViewApplication={(applicationId) =>
        navigate(`/loan-officer/applications/${applicationId}`)
      }
      onContinueApplication={(applicationId) =>
        navigate(`/loan-officer/applications/${applicationId}/edit`)
      }
    />
  )
}
