import { useNavigate, useParams, useLocation } from "react-router-dom"

import CollectionRecording from "./CollectionRecording"
import EwsAlertDetail from "./EwsAlertDetail"
import LoanApplicationForm from "./LoanApplicationForm"
import LoanOfficerDashboard from "./LoanOfficerDashboard"
import { COLLECTION_ROUTE } from "./mock-data"

export function LoanOfficerDashboardPage() {
  const navigate = useNavigate()

  return (
    <LoanOfficerDashboard
      onOpenAlert={(id) => navigate(`/loan-officer/alerts/${id}`)}
      onOpenCollection={(stop) =>
        navigate("/loan-officer/collection", { state: { stop } })
      }
    />
  )
}

export function LoanApplicationPage() {
  return <LoanApplicationForm />
}

export function CollectionPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const stop = location.state?.stop ?? COLLECTION_ROUTE[0]

  return (
    <CollectionRecording
      stop={stop}
      onBack={() => navigate("/loan-officer")}
    />
  )
}

export function EwsAlertPage() {
  const navigate = useNavigate()
  const { alertId } = useParams()

  return (
    <EwsAlertDetail
      alertId={alertId}
      onBack={() => navigate("/loan-officer")}
    />
  )
}
