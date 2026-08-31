import { useState, useMemo } from "react"
import { useStore } from "@/store"
import { ChevronLeft, ChevronRight, Download } from "lucide-react"

export default function AttendanceOverviewTab() {
  const attendanceData = useStore((state) => state.attendanceData || [])

  const [currentDate, setCurrentDate] = useState(new Date())
  const [toastMessage, setToastMessage] = useState("")

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))
  }

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(""), 3000)
  }

  const handleDownload = () => {
    showToast("Preparing attendance report... Downloading.")
  }

  const { avgRate, perfectCount, lateCount, absentCount } = useMemo(() => {
    if (attendanceData.length === 0) return { avgRate: 0, perfectCount: 0, lateCount: 0, absentCount: 0 }

    let totalRate = 0
    let perfect = 0
    let late = 0
    let absent = 0

    attendanceData.forEach(d => {
      totalRate += d.attendanceRate
      if (d.attendanceRate === 100) perfect++
      late += d.late
      absent += d.absent
    })

    return {
      avgRate: Math.round(totalRate / attendanceData.length),
      perfectCount: perfect,
      lateCount: late,
      absentCount: absent
    }
  }, [attendanceData])

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Attendance Overview</h2>
          <p className="text-sm text-muted-foreground">Monthly attendance summary for all staff.</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center rounded-md border border-border bg-card">
            <button onClick={handlePrevMonth} className="p-2 text-muted-foreground hover:bg-muted transition-colors">
              <ChevronLeft size={18} />
            </button>
            <div className="w-32 text-center text-sm font-medium">{monthName}</div>
            <button onClick={handleNextMonth} className="p-2 text-muted-foreground hover:bg-muted transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            <Download size={16} /> Download Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-2 text-sm text-muted-foreground">Average Attendance Rate</div>
          <div className={`text-3xl font-bold ${avgRate >= 95 ? 'text-green-600 dark:text-green-400' : avgRate >= 80 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
            {avgRate}%
          </div>
        </div>
        <div className="flex flex-col rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-2 text-sm text-muted-foreground">Perfect Attendance</div>
          <div className="text-3xl font-bold text-foreground">{perfectCount}</div>
        </div>
        <div className="flex flex-col rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-2 text-sm text-muted-foreground">Late Arrivals</div>
          <div className="text-3xl font-bold text-foreground">{lateCount}</div>
        </div>
        <div className="flex flex-col rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-2 text-sm text-muted-foreground">Absent Days</div>
          <div className="text-3xl font-bold text-foreground">{absentCount}</div>
        </div>
      </div>

      <div className="rounded-md border border-border">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Staff Member</th>
              <th className="px-4 py-3 font-medium">Working Days</th>
              <th className="px-4 py-3 font-medium">Present</th>
              <th className="px-4 py-3 font-medium">Absent</th>
              <th className="px-4 py-3 font-medium">Late</th>
              <th className="px-4 py-3 font-medium">Attendance Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {attendanceData.map(d => (
              <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{d.staffName}</div>
                  <div className="text-xs text-muted-foreground">{d.role} • {d.branch}</div>
                </td>
                <td className="px-4 py-3">{d.workingDays}</td>
                <td className="px-4 py-3 text-green-600 dark:text-green-400 font-medium">{d.present}</td>
                <td className="px-4 py-3 text-red-600 dark:text-red-400 font-medium">{d.absent}</td>
                <td className="px-4 py-3 text-amber-600 dark:text-amber-400 font-medium">{d.late}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-24 rounded-full bg-secondary h-2 overflow-hidden">
                      <div
                        className={`h-full ${d.attendanceRate >= 95 ? 'bg-green-500' : d.attendanceRate >= 80 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${d.attendanceRate}%` }}
                      ></div>
                    </div>
                    <span className={`font-medium ${d.attendanceRate >= 95 ? 'text-green-600 dark:text-green-400' : d.attendanceRate >= 80 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                      {d.attendanceRate}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
            {attendanceData.length === 0 && (
              <tr>
                <td colSpan="6" className="px-4 py-8 text-center text-muted-foreground">
                  No attendance data available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg bg-muted/50 p-4 text-center text-sm text-muted-foreground">
        Attendance data is recorded by Field Officers and Branch Managers via the MicroFlow mobile interface. Last sync: today at 08:00 AM.
      </div>

      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-2 rounded-md bg-foreground px-4 py-3 text-sm text-background shadow-lg">
          {toastMessage}
        </div>
      )}
    </div>
  )
}
