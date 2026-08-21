import { useState } from "react"
import { ClipboardList, LayoutDashboard, Smartphone } from "lucide-react"

import CollectionRecording from "./CollectionRecording"
import EwsAlertDetail from "./EwsAlertDetail"
import LoanApplicationForm from "./LoanApplicationForm"
import LoanOfficerDashboard from "./LoanOfficerDashboard"
import { COLLECTION_ROUTE } from "./mock-data"

export default function C3App() {
  const [view, setView] = useState("dashboard")
  const [alertId, setAlertId] = useState("EWS-1042")
  const [stop, setStop] = useState(COLLECTION_ROUTE[1])

  function goDashboard() {
    setView("dashboard")
  }

  return (
    <div>
      {view !== "collection" ? (
        <div className="border-b border-border bg-card/40 px-4">
          <div className="mx-auto flex max-w-6xl flex-wrap gap-1 py-2">
            <button
              type="button"
              onClick={goDashboard}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                view === "dashboard" || view === "alert"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutDashboard className="size-3.5" />
              Officer dashboard
            </button>
            <button
              type="button"
              onClick={() => setView("application")}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                view === "application"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ClipboardList className="size-3.5" />
              Loan application
            </button>
            <button
              type="button"
              onClick={() => {
                setStop(COLLECTION_ROUTE[1])
                setView("collection")
              }}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                view === "collection"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Smartphone className="size-3.5" />
              Collection (mobile)
            </button>
          </div>
        </div>
      ) : null}

      {view === "dashboard" ? (
        <LoanOfficerDashboard
          onOpenAlert={(id) => {
            setAlertId(id)
            setView("alert")
          }}
          onOpenCollection={(nextStop) => {
            setStop(nextStop)
            setView("collection")
          }}
        />
      ) : null}

      {view === "alert" ? (
        <EwsAlertDetail alertId={alertId} onBack={goDashboard} />
      ) : null}

      {view === "collection" ? (
        <CollectionRecording stop={stop} onBack={goDashboard} />
      ) : null}

      {view === "application" ? <LoanApplicationForm /> : null}
    </div>
  )
}
