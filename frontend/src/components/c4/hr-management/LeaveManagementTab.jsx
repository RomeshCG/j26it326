import { useState } from "react"
import { useStore } from "@/store"
import { Check, X as XIcon, Plus } from "lucide-react"

export default function LeaveManagementTab() {
  const leaveRequests = useStore((state) => state.leaveRequests || [])
  const approveLeave = useStore((state) => state.approveLeave)
  const rejectLeave = useStore((state) => state.rejectLeave)
  const applyLeave = useStore((state) => state.applyLeave)
  const currentUser = useStore((state) => state.currentUser)

  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false)
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false)
  const [selectedLeave, setSelectedLeave] = useState(null)
  const [rejectReason, setRejectReason] = useState("")

  const [toastMessage, setToastMessage] = useState("")

  const pendingRequests = leaveRequests.filter(l => l.status === "Pending").length
  const approvedThisMonth = leaveRequests.filter(l => l.status === "Approved").length
  const rejectedThisMonth = leaveRequests.filter(l => l.status === "Rejected").length
  const staffOnLeave = leaveRequests.filter(l => l.status === "Approved" && l.fromDate <= new Date().toISOString().split("T")[0] && l.toDate >= new Date().toISOString().split("T")[0]).length

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(""), 3000)
  }

  const handleApprove = () => {
    if (selectedLeave) {
      approveLeave(selectedLeave.id)
      showToast(`Leave approved. ${selectedLeave.staffName} has been notified.`)
      setIsApproveModalOpen(false)
      setSelectedLeave(null)
    }
  }

  const handleReject = (e) => {
    e.preventDefault()
    if (selectedLeave && rejectReason.trim()) {
      rejectLeave(selectedLeave.id)
      showToast(`Leave request rejected. ${selectedLeave.staffName} has been notified.`)
      setIsRejectModalOpen(false)
      setSelectedLeave(null)
      setRejectReason("")
    }
  }

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Leave Requests</h2>
          <p className="text-sm text-muted-foreground">Review and manage staff leave applications.</p>
        </div>
        <button
          onClick={() => setIsApplyModalOpen(true)}
          className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} /> Apply Leave
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-2 text-sm text-muted-foreground flex items-center justify-between">
            Pending Requests
            {pendingRequests > 0 && (
              <span className="flex h-5 items-center justify-center rounded-full bg-amber-500/10 px-2 text-[10px] font-bold text-amber-600 border border-amber-500/20">
                {pendingRequests} NEW
              </span>
            )}
          </div>
          <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">{pendingRequests}</div>
        </div>
        <div className="flex flex-col rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-2 text-sm text-muted-foreground">Approved This Month</div>
          <div className="text-3xl font-bold text-green-600 dark:text-green-400">{approvedThisMonth}</div>
        </div>
        <div className="flex flex-col rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-2 text-sm text-muted-foreground">Rejected This Month</div>
          <div className="text-3xl font-bold text-red-600 dark:text-red-400">{rejectedThisMonth}</div>
        </div>
        <div className="flex flex-col rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-2 text-sm text-muted-foreground">Staff Currently On Leave</div>
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{staffOnLeave}</div>
        </div>
      </div>

      <div className="rounded-md border border-border">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Staff Member</th>
              <th className="px-4 py-3 font-medium">Leave Type</th>
              <th className="px-4 py-3 font-medium">Duration</th>
              <th className="px-4 py-3 font-medium">Reason</th>
              <th className="px-4 py-3 font-medium">Submitted</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {leaveRequests.map(l => (
              <tr key={l.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{l.staffName}</div>
                  <div className="text-xs text-muted-foreground">{l.role} • {l.branch}</div>
                </td>
                <td className="px-4 py-3 font-medium">{l.type}</td>
                <td className="px-4 py-3">
                  <div className="text-foreground">{l.duration} day{l.duration > 1 ? 's' : ''}</div>
                  <div className="text-xs text-muted-foreground">{l.fromDate} to {l.toDate}</div>
                </td>
                <td className="px-4 py-3 max-w-[200px] truncate text-muted-foreground" title={l.reason}>
                  {l.reason}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{l.submittedOn}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${l.status === "Approved" ? "bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20" :
                      l.status === "Rejected" ? "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20" :
                        "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                    }`}>
                    {l.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {l.status === "Pending" ? (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => { setSelectedLeave(l); setIsApproveModalOpen(true); }}
                        className="rounded border border-green-600/30 bg-green-500/10 p-1 text-green-700 hover:bg-green-500/20 transition-colors" title="Approve"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={() => { setSelectedLeave(l); setIsRejectModalOpen(true); }}
                        className="rounded border border-red-600/30 bg-red-500/10 p-1 text-red-700 hover:bg-red-500/20 transition-colors" title="Reject"
                      >
                        <XIcon size={16} />
                      </button>
                    </div>
                  ) : (
                    <button className="text-xs text-blue-600 hover:underline">View Details</button>
                  )}
                </td>
              </tr>
            ))}
            {leaveRequests.length === 0 && (
              <tr>
                <td colSpan="7" className="px-4 py-8 text-center text-muted-foreground">
                  No leave requests found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Approve Modal */}
      {isApproveModalOpen && selectedLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold text-foreground">Approve Leave Request</h3>
            <p className="mb-6 text-sm text-foreground">
              Approve <strong>{selectedLeave.duration} days</strong> of <strong>{selectedLeave.type}</strong> for <strong>{selectedLeave.staffName}</strong>?<br />
              <span className="text-muted-foreground">From {selectedLeave.fromDate} to {selectedLeave.toDate}.</span>
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setIsApproveModalOpen(false); setSelectedLeave(null); }}
                className="rounded-md px-4 py-2 text-sm font-medium border border-input hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                Confirm Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {isRejectModalOpen && selectedLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Reject Leave Request</h3>
              <button onClick={() => { setIsRejectModalOpen(false); setSelectedLeave(null); }} className="text-muted-foreground hover:text-foreground">
                <XIcon size={20} />
              </button>
            </div>
            <form onSubmit={handleReject}>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Provide a reason for rejecting {selectedLeave.staffName}&apos;s leave request.
                </p>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Reason <span className="text-red-500">*</span></label>
                  <textarea
                    required
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    rows="3"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => { setIsRejectModalOpen(false); setSelectedLeave(null); }}
                  className="rounded-md px-4 py-2 text-sm font-medium border border-input hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  Submit Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Apply Leave Modal */}
      {isApplyModalOpen && (
        <ApplyLeaveModal
          isOpen={isApplyModalOpen}
          onClose={() => setIsApplyModalOpen(false)}
          onSubmit={(data) => {
            applyLeave({
              ...data,
              staffName: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "Current User",
              role: currentUser?.role || "Staff",
              branch: "Head Office"
            })
            showToast("Leave application submitted successfully.")
            setIsApplyModalOpen(false)
          }}
        />
      )}

      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-2 rounded-md bg-foreground px-4 py-3 text-sm text-background shadow-lg">
          {toastMessage}
        </div>
      )}
    </div>
  )
}

function ApplyLeaveModal({ onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    type: "Annual Leave",
    fromDate: new Date().toISOString().split("T")[0],
    toDate: new Date().toISOString().split("T")[0],
    reason: ""
  })

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const calculateDuration = () => {
    const start = new Date(formData.fromDate)
    const end = new Date(formData.toDate)
    if (isNaN(start) || isNaN(end) || end < start) return 0
    const diffTime = Math.abs(end - start)
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit({
      ...formData,
      duration: calculateDuration()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm py-8 overflow-y-auto">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl my-auto">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Apply for Leave</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <XIcon size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Leave Type</label>
            <select name="type" value={formData.type} onChange={handleChange} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="Annual Leave">Annual Leave</option>
              <option value="Casual Leave">Casual Leave</option>
              <option value="Medical Leave">Medical Leave</option>
              <option value="Maternity Leave">Maternity Leave</option>
              <option value="No Pay Leave">No Pay Leave</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">From Date</label>
              <input required type="date" name="fromDate" value={formData.fromDate} onChange={handleChange} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">To Date</label>
              <input required type="date" name="toDate" value={formData.toDate} onChange={handleChange} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>

          <div className="rounded-md bg-muted/50 p-3 text-sm text-center">
            Duration: <span className="font-bold">{calculateDuration()} days</span>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Reason</label>
            <textarea name="reason" value={formData.reason} onChange={handleChange} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" rows="3" required></textarea>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
            <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm font-medium border border-input hover:bg-muted transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={calculateDuration() <= 0} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50">
              Submit Application
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
