import React, { useState } from "react"
import { Link, useLocation, Outlet, useNavigate } from "react-router-dom"
import { 
  LayoutDashboard, 
  Wallet, 
  Activity, 
  CheckCircle, 
  Settings,
  LogOut
} from "lucide-react"
import { useStore } from "@/store"

const SIDEBAR_NAV = [
  { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { name: "Payroll", path: "/payroll", icon: Wallet },
  { name: "Agent Activity Log", path: "/agent-log", icon: Activity },
  { name: "Tier Approvals", path: "/tier-approval", icon: CheckCircle },
  { name: "Settings", path: "/settings", icon: Settings },
]

export default function DashboardLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { currentUser, logout } = useStore()
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [tierCount, setTierCount] = React.useState(3)

  React.useEffect(() => {
    const checkCount = () => {
      const count = localStorage.getItem("mf_tier3_count")
      if (count !== null) setTierCount(parseInt(count, 10))
    }
    checkCount()
    window.addEventListener("storage", checkCount)
    return () => window.removeEventListener("storage", checkCount)
  }, [])
  
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
                className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
                  isActive 
                    ? "bg-blue-600/10 text-blue-400 font-medium border border-blue-500/20" 
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon size={20} className={isActive ? "text-blue-400" : "text-slate-500"} />
                  {item.name}
                </div>
                {item.name === "Tier Approvals" && tierCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                    {tierCount}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
        
        <div className="p-4 border-t border-slate-800">
          <div className="flex flex-col gap-2 relative">
            {/* User Profile */}
            <div className="flex items-center justify-between p-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-300">
                  {currentUser?.firstName?.[0] || "J"}{currentUser?.lastName?.[0] || "S"}
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{currentUser?.firstName || "Jane"} {currentUser?.lastName || "Smith"}</div>
                  <div className="text-xs text-slate-500">{currentUser?.role || "Institution Admin"}</div>
                </div>
              </div>
            </div>
            
            {/* Logout Button */}
            <button 
              onClick={() => setShowLogoutConfirm(!showLogoutConfirm)}
              className="flex items-center justify-between w-full px-3 py-2 text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-lg transition-colors mt-2"
            >
              <div className="flex items-center gap-3">
                <LogOut size={18} className="text-slate-500" />
                Sign out
              </div>
            </button>

            {/* Logout Popover */}
            {showLogoutConfirm && (
              <div className="absolute bottom-full left-0 w-full mb-2 bg-[#161616] border border-slate-700 p-4 rounded-xl shadow-xl z-50">
                <div className="text-sm font-bold text-white mb-3">Sign out of MicroFlow?</div>
                <div className="flex gap-2">
                  <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-1.5 rounded transition-colors">Cancel</button>
                  <button onClick={() => { logout(); navigate("/login") }} className="flex-1 bg-red-600 hover:bg-red-500 text-white text-xs font-bold py-1.5 rounded transition-colors">Sign Out</button>
                </div>
              </div>
            )}
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
