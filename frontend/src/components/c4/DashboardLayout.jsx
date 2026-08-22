import React from "react"
import { Link, useLocation, Outlet } from "react-router-dom"
import { 
  LayoutDashboard, 
  Wallet, 
  Activity, 
  CheckCircle, 
  Settings
} from "lucide-react"

const SIDEBAR_NAV = [
  { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { name: "Payroll", path: "/payroll", icon: Wallet },
  { name: "Agent Activity Log", path: "/agent-log", icon: Activity },
  { name: "Tier Approvals", path: "/tier-approval", icon: CheckCircle },
  { name: "Settings", path: "/settings", icon: Settings },
]

export default function DashboardLayout() {
  const location = useLocation()
  
  return (
    <div className="min-h-screen bg-[#0A0A0A] flex text-slate-200 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-[#111111] border-r border-slate-800 flex flex-col hidden md:flex flex-shrink-0">
        <div className="p-6">
          <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 tracking-tighter flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-white font-bold text-lg">M</div>
            MicroFlow
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-1">
          {SIDEBAR_NAV.map((item) => {
            const isActive = location.pathname === item.path || (location.pathname === '/' && item.path === '/dashboard')
            return (
              <Link 
                key={item.name} 
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive 
                    ? "bg-blue-600/10 text-blue-400 font-medium border border-blue-500/20" 
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                <item.icon size={20} className={isActive ? "text-blue-500" : "text-slate-500"} />
                {item.name}
              </Link>
            )
          })}
        </nav>
        
        <div className="p-6 border-t border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-300">
              JS
            </div>
            <div>
              <div className="text-sm font-medium text-white">Jane Smith</div>
              <div className="text-xs text-slate-500">Institution Admin</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#0A0A0A]">
        <Outlet />
      </div>
    </div>
  )
}
