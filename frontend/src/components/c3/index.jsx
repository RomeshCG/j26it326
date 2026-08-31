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
      onBack={() => navigate("/loan-officer/borrowers")}
      onComplete={() => navigate("/loan-officer")}
    />
  )
}

export function CollectionPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const stop = location.state?.stop ?? COLLECTION_ROUTE[0]

  return (
    <CollectionRecording
      stop={stop}
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
    />
  )
}
