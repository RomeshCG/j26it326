import { useState } from "react"
import { Users, UserCheck, CalendarOff, Briefcase } from "lucide-react"
import { useStore } from "@/store"
import StaffDirectoryTab from "./StaffDirectoryTab"
import LeaveManagementTab from "./LeaveManagementTab"
import AttendanceOverviewTab from "./AttendanceOverviewTab"

export default function HRManagement() {
  const [activeTab, setActiveTab] = useState("directory")

  const staff = useStore((state) => state.staff) || []

  const totalStaff = staff.length
  const activeStaff = staff.filter(s => s.status === "Active").length
  const onLeaveStaff = staff.filter(s => s.status === "On Leave").length

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background text-foreground">
      <header className="z-10 flex flex-col gap-2 border-b border-border bg-background/80 px-8 py-6 backdrop-blur-md">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">
          Human Resources
        </h1>
        <p className="text-muted-foreground text-sm">
          Manage staff accounts, leave requests, and attendance.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Users size={24} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Staff</p>
              <h3 className="text-2xl font-bold">{totalStaff}</h3>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <UserCheck size={24} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active</p>
              <h3 className="text-2xl font-bold">{activeStaff}</h3>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <CalendarOff size={24} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">On Leave Today</p>
              <h3 className="text-2xl font-bold">{onLeaveStaff}</h3>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Briefcase size={24} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Vacant Positions</p>
              <h3 className="text-2xl font-bold">2</h3>
            </div>
          </div>
        </div>

        <div className="mb-6 flex space-x-1 rounded-xl bg-muted/50 p-1 lg:w-[600px]">
          <button
            onClick={() => setActiveTab("directory")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${activeTab === "directory"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/50"
              }`}
          >
            Staff Directory
          </button>
          <button
            onClick={() => setActiveTab("leave")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${activeTab === "leave"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/50"
              }`}
          >
            Leave Management
          </button>
          <button
            onClick={() => setActiveTab("attendance")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${activeTab === "attendance"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/50"
              }`}
          >
            Attendance Overview
          </button>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          {activeTab === "directory" && <StaffDirectoryTab />}
          {activeTab === "leave" && <LeaveManagementTab />}
          {activeTab === "attendance" && <AttendanceOverviewTab />}
        </div>
      </div>
    </div>
  )
}
