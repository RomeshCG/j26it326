import { useNavigate, useParams, useLocation } from "react-router-dom"

import BranchPortfolio from "./BranchPortfolio"
import CollectionRecording from "./CollectionRecording"
import DisbursementConfirm from "./DisbursementConfirm"
import EwsAlertDetail from "./EwsAlertDetail"
import EwsAlertInbox from "./EwsAlertInbox"
import GroupLending from "./GroupLending"
import LoanDetail from "./LoanDetail"
import LoanOfficerDashboard from "./LoanOfficerDashboard"
import OverdueQueue from "./OverdueQueue"
import { COLLECTION_ROUTE } from "./mock-data"

export function LoanOfficerDashboardPage() {
  const navigate = useNavigate()

  return (
    <LoanOfficerDashboard
      onOpenLoan={(id) => navigate(`/loan-officer/loans/${id}`)}
      onOpenOverdue={() => navigate("/loan-officer/overdue")}
      onOpenEwsInbox={() => navigate("/loan-officer/alerts")}
      onOpenBranch={() => navigate("/loan-officer/branch")}
      onOpenAlert={(id) => navigate(`/loan-officer/alerts/${id}`)}
      onOpenCollection={(stop) =>
        navigate("/loan-officer/collection", { state: { stop } })
      }
    />
  )
}

export function DisbursementPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const application = location.state?.application

  return (
    <DisbursementConfirm
      application={application}
      onBack={() =>
        application?.applicationId
          ? navigate(`/loan-officer/applications/${application.applicationId}`)
          : navigate("/loan-officer/borrowers")
      }
      onComplete={() => navigate("/loan-officer")}
    />
  )
}

export function CollectionPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const stopId = location.state?.stop?.id
  const stopIndex = COLLECTION_ROUTE.findIndex((item) => item.id === stopId)
  const stop = stopIndex >= 0 ? COLLECTION_ROUTE[stopIndex] : COLLECTION_ROUTE[0]

  return (
    <CollectionRecording
      stop={stop}
      stopIndex={stopIndex >= 0 ? stopIndex : 0}
      routeTotal={COLLECTION_ROUTE.length}
      routeStops={COLLECTION_ROUTE}
      onSelectStop={(nextStop) =>
        navigate("/loan-officer/collection", { state: { stop: nextStop }, replace: true })
      }
      onBack={() => navigate("/loan-officer")}
      onComplete={() => navigate("/loan-officer")}
    />
  )
}

export function EwsAlertInboxPage() {
  const navigate = useNavigate()

  return (
    <EwsAlertInbox
      onBack={() => navigate("/loan-officer")}
      onOpenAlert={(id) => navigate(`/loan-officer/alerts/${id}`)}
    />
  )
}

export function EwsAlertPage() {
  const navigate = useNavigate()
  const { alertId } = useParams()

  return (
    <EwsAlertDetail
      alertId={alertId}
      onBack={() => navigate("/loan-officer/alerts")}
    />
  )
}

export function LoanDetailPage() {
  const navigate = useNavigate()
  const { loanId } = useParams()

  return (
    <LoanDetail
      loanId={loanId}
      onBack={() => navigate("/loan-officer")}
      onOpenAlert={(id) => navigate(`/loan-officer/alerts/${id}`)}
      onOpenGroup={(id) => navigate(`/loan-officer/groups/${id}`)}
      onOpenCollection={(stop) =>
        navigate("/loan-officer/collection", { state: { stop } })
      }
    />
  )
}

export function OverdueQueuePage() {
  const navigate = useNavigate()

  return (
    <OverdueQueue
      onBack={() => navigate("/loan-officer")}
      onOpenLoan={(id) => navigate(`/loan-officer/loans/${id}`)}
      onOpenAlert={(id) => navigate(`/loan-officer/alerts/${id}`)}
      onOpenCollection={(stop) =>
        navigate("/loan-officer/collection", { state: { stop } })
      }
    />
  )
}

export function GroupLendingPage() {
  const navigate = useNavigate()
  const { groupId } = useParams()

  return (
    <GroupLending
      groupId={groupId}
      onBack={() => navigate(-1)}
      onOpenLoan={(id) => navigate(`/loan-officer/loans/${id}`)}
    />
  )
}

export function BranchPortfolioPage() {
  const navigate = useNavigate()

  return (
    <BranchPortfolio
      onBack={() => navigate("/loan-officer")}
      onOpenAlert={(id) => navigate(`/loan-officer/alerts/${id}`)}
      onOpenEarlyWarning={() => navigate("/loan-officer/alerts")}
    />
  )
}
