import React, { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { 
  User, Building2, Bell, Cpu, Shield, 
  Lock, CheckCircle, Save, LogOut, X, Edit, Trash2, Plus, AlertTriangle, Info
} from "lucide-react"
import { useStore } from "@/store"

const TABS = [
  { id: "account", label: "Account Settings", icon: User },
  { id: "institution", label: "Institution Settings", icon: Building2, adminOnly: true },
  { id: "notifications", label: "Notification Preferences", icon: Bell },
  { id: "agents", label: "Agent Settings", icon: Cpu, adminOnly: true },
  { id: "privacy", label: "Data & Privacy", icon: Shield }
]

const SRI_LANKAN_DISTRICTS = [
  "Ampara", "Anuradhapura", "Badulla", "Batticaloa", "Colombo", 
  "Galle", "Gampaha", "Hambantota", "Jaffna", "Kalutara", 
  "Kandy", "Kegalle", "Kilinochchi", "Kurunegala", "Mannar", 
  "Matale", "Matara", "Moneragala", "Mullaitivu", "Nuwara Eliya", 
  "Polonnaruwa", "Puttalam", "Ratnapura", "Trincomalee", "Vavuniya"
]

export default function Settings() {
  const navigate = useNavigate()
  
  // Zustand State
  const { 
    currentUser, updateProfile, 
    institution, updateInstitution, branches, addBranch, updateBranch, removeBranch,
    loanProducts, toggleLoanProduct,
    notifications, updateNotification,
    agentSettings, updateAgentSensitivity, toggleAgent,
    resetDemoData, logout 
  } = useStore()
  
  const [activeTab, setActiveTab] = useState("account")
  const [showToast, setShowToast] = useState({ visible: false, message: "" })
  const [unsavedChanges, setUnsavedChanges] = useState(false)
  
  const isAdmin = currentUser?.role === "Institution Admin"

  // Local state for forms
  const [profileForm, setProfileForm] = useState(currentUser || {})
  const [instForm, setInstForm] = useState(institution || {})
  const [newBranchMode, setNewBranchMode] = useState(false)
  const [editingBranch, setEditingBranch] = useState(null)
  
  // Password state
  const [pwd, setPwd] = useState({ current: "", new: "", confirm: "" })
  const [pwdStrength, setPwdStrength] = useState({ label: "", color: "" })

  const triggerToast = (msg) => {
    setShowToast({ visible: true, message: msg })
    setTimeout(() => setShowToast({ visible: false, message: "" }), 3000)
    setUnsavedChanges(false)
  }

  // Effect for password strength
  useEffect(() => {
    const val = pwd.new
    if (!val) { setPwdStrength({ label: "", color: "" }); return }
    let score = 0
    if (val.length >= 8) score++
    if (/[A-Z]/.test(val)) score++
    if (/[0-9]/.test(val)) score++
    if (/[^A-Za-z0-9]/.test(val)) score++
    
    if (score <= 1) setPwdStrength({ label: "Weak", color: "bg-red-500" })
    else if (score === 2) setPwdStrength({ label: "Fair", color: "bg-amber-500" })
    else if (score === 3) setPwdStrength({ label: "Strong", color: "bg-green-500" })
    else setPwdStrength({ label: "Very Strong", color: "bg-blue-500" })
  }, [pwd.new])

  // Admin Check wrapper for tabs
  const renderTabContent = () => {
    const currentTabObj = TABS.find(t => t.id === activeTab)
    if (currentTabObj?.adminOnly && !isAdmin) {
      return (
        <div className="flex flex-col items-center justify-center h-96 text-slate-400">
          <Lock size={48} className="mb-4 text-slate-600" />
          <h2 className="text-xl font-bold text-white mb-2">Admin Access Required</h2>
          <p className="text-center max-w-md">Institution settings can only be modified by the Institution Admin. Contact your administrator to make changes.</p>
        </div>
      )
    }

    switch(activeTab) {
      case "account": return <TabAccount />
      case "institution": return <TabInstitution />
      case "notifications": return <TabNotifications />
      case "agents": return <TabAgents />
      case "privacy": return <TabPrivacy />
      default: return null
    }
  }

  // --- TAB SUBCOMPONENTS ---

  const TabAccount = () => {
    const getInitials = (f, l) => `${f?.[0] || ''}${l?.[0] || ''}`
    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        <div>
          <h2 className="text-xl font-bold text-white">Account Settings</h2>
          <p className="text-slate-400 text-sm">Update your personal information and security settings.</p>
        </div>

        {/* Profile Card */}
        <div className="bg-[#111111] border border-slate-800 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-xl font-bold text-white shadow-lg">
              {getInitials(currentUser?.firstName, currentUser?.lastName)}
            </div>
            <div>
              <div className="text-lg font-bold text-white">{currentUser?.firstName} {currentUser?.lastName}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="bg-slate-800 text-slate-300 text-xs px-2 py-0.5 rounded-full font-medium">{currentUser?.role}</span>
                <span className="text-slate-500 text-xs">• {institution?.name} • Member since {currentUser?.memberSince}</span>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">First Name</label>
                <input type="text" value={profileForm.firstName || ""} onChange={(e) => {setProfileForm({...profileForm, firstName: e.target.value}); setUnsavedChanges(true)}} className="w-full bg-[#161616] border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:border-blue-500 focus:outline-none transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Last Name</label>
                <input type="text" value={profileForm.lastName || ""} onChange={(e) => {setProfileForm({...profileForm, lastName: e.target.value}); setUnsavedChanges(true)}} className="w-full bg-[#161616] border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:border-blue-500 focus:outline-none transition-colors" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Email Address</label>
              <input type="email" value={profileForm.email || ""} onChange={(e) => {setProfileForm({...profileForm, email: e.target.value}); setUnsavedChanges(true)}} className="w-full bg-[#161616] border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:border-blue-500 focus:outline-none transition-colors" />
              <div className="text-[10px] text-slate-500 mt-1">Changing your email requires verification.</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Phone Number</label>
                <input type="text" value={profileForm.phone || ""} onChange={(e) => {setProfileForm({...profileForm, phone: e.target.value}); setUnsavedChanges(true)}} className="w-full bg-[#161616] border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:border-blue-500 focus:outline-none transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Language</label>
                <select value={profileForm.language || "English"} onChange={(e) => {setProfileForm({...profileForm, language: e.target.value}); setUnsavedChanges(true)}} className="w-full bg-[#161616] border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:border-blue-500 focus:outline-none transition-colors">
                  <option>English</option>
                  <option>Sinhala</option>
                  <option>Tamil</option>
                </select>
              </div>
            </div>
            <div className="pt-2">
              <button 
                onClick={() => { updateProfile(profileForm); triggerToast("Profile updated successfully.") }}
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-6 py-2 rounded-lg transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>

        {/* Password Card */}
        <div className="bg-[#111111] border border-slate-800 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-white mb-4">Password</h3>
          <div className="max-w-md space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Current Password</label>
              <input type="password" value={pwd.current} onChange={(e) => setPwd({...pwd, current: e.target.value})} className="w-full bg-[#161616] border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:border-blue-500 focus:outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">New Password</label>
              <input type="password" value={pwd.new} onChange={(e) => setPwd({...pwd, new: e.target.value})} className="w-full bg-[#161616] border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:border-blue-500 focus:outline-none transition-colors" />
              {pwd.new && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full ${pwdStrength.color} transition-all duration-300`} style={{width: pwdStrength.label === 'Weak' ? '25%' : pwdStrength.label === 'Fair' ? '50%' : pwdStrength.label === 'Strong' ? '75%' : '100%'}}></div>
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 w-16">{pwdStrength.label}</div>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Confirm New Password</label>
              <input type="password" value={pwd.confirm} onChange={(e) => setPwd({...pwd, confirm: e.target.value})} className="w-full bg-[#161616] border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:border-blue-500 focus:outline-none transition-colors" />
              {pwd.confirm && pwd.new !== pwd.confirm && <div className="text-red-400 text-xs mt-1">Passwords do not match</div>}
            </div>
            <div className="pt-2">
              <button 
                onClick={() => { setPwd({current: "", new: "", confirm: ""}); triggerToast("Password updated successfully.") }}
                disabled={!pwd.current || !pwd.new || pwd.new !== pwd.confirm}
                className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-sm font-medium px-6 py-2 rounded-lg transition-colors border border-slate-700"
              >
                Update Password
              </button>
            </div>
          </div>
        </div>

        {/* Sessions Card */}
        <div className="bg-[#111111] border border-slate-800 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-white mb-4">Active Sessions</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-[#161616] border border-slate-700 rounded-lg">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">This device</span>
                  <span className="bg-green-500/10 text-green-400 text-[10px] font-bold px-2 py-0.5 rounded-full">Active</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">Chrome on Windows • Last active: Just now</div>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-[#161616] border border-slate-700 rounded-lg">
              <div>
                <div className="text-sm font-bold text-white">Mobile device</div>
                <div className="text-xs text-slate-400 mt-1">Chrome on Android • Last active: 2 days ago</div>
              </div>
              <button onClick={() => triggerToast("Session revoked.")} className="text-red-400 hover:text-red-300 text-xs font-medium border border-red-500/30 bg-red-500/10 px-3 py-1.5 rounded transition-colors">
                Revoke
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const TabInstitution = () => {
    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        <div>
          <h2 className="text-xl font-bold text-white">Institution Settings</h2>
          <p className="text-slate-400 text-sm">Manage your institution profile and configuration.</p>
        </div>

        {/* Institution Profile */}
        <div className="bg-[#111111] border border-slate-800 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-white mb-4">Institution Profile</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Institution Name</label>
              <input type="text" value={instForm.name || ""} onChange={(e) => {setInstForm({...instForm, name: e.target.value}); setUnsavedChanges(true)}} className="w-full bg-[#161616] border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:border-blue-500 focus:outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Registration Number</label>
              <input type="text" value={instForm.registrationNumber || ""} onChange={(e) => {setInstForm({...instForm, registrationNumber: e.target.value}); setUnsavedChanges(true)}} className="w-full bg-[#161616] border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:border-blue-500 focus:outline-none transition-colors" />
              <div className="text-[10px] text-slate-500 mt-1">Issued by Central Bank of Sri Lanka.</div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Institution Type</label>
              <select value={instForm.type || ""} onChange={(e) => {setInstForm({...instForm, type: e.target.value}); setUnsavedChanges(true)}} className="w-full bg-[#161616] border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:border-blue-500 focus:outline-none transition-colors">
                <option>Licensed Finance Company</option>
                <option>Microfinance NGO</option>
                <option>Rural Development Bank</option>
                <option>Co-operative Society</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">District</label>
              <select value={instForm.district || ""} onChange={(e) => {setInstForm({...instForm, district: e.target.value}); setUnsavedChanges(true)}} className="w-full bg-[#161616] border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:border-blue-500 focus:outline-none transition-colors">
                {SRI_LANKAN_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Number of Branches</label>
              <input type="text" readOnly value={branches.length} className="w-full bg-[#161616] border border-slate-800 text-slate-500 rounded-lg p-2.5 text-sm cursor-not-allowed" />
            </div>
          </div>
          <div className="pt-6">
            <button 
              onClick={() => { updateInstitution(instForm); triggerToast("Institution profile updated.") }}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-6 py-2 rounded-lg transition-colors"
            >
              Save Institution Profile
            </button>
          </div>
        </div>

        {/* Branch Management */}
        <div className="bg-[#111111] border border-slate-800 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">Branch Management</h3>
            <button onClick={() => setNewBranchMode(true)} className="flex items-center gap-1 text-sm bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded transition-colors border border-slate-700"><Plus size={16}/> Add Branch</button>
          </div>
          <div className="space-y-3">
            {branches.map(b => (
              <div key={b.id} className="p-4 bg-[#161616] border border-slate-700 rounded-lg flex items-center justify-between group">
                <div>
                  <div className="text-sm font-bold text-white">{b.name}</div>
                  <div className="text-xs text-slate-400 mt-1">{b.location} • Manager: {b.manager}</div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded"><Edit size={16}/></button>
                  <button onClick={() => { if(confirm("Remove this branch?")) removeBranch(b.id) }} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded"><Trash2 size={16}/></button>
                </div>
              </div>
            ))}
            {newBranchMode && (
              <div className="p-4 bg-blue-500/5 border border-blue-500/30 rounded-lg animate-in fade-in">
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <input type="text" placeholder="Branch Name" id="n_bname" className="bg-[#0A0A0A] border border-slate-700 text-sm rounded p-2 text-white outline-none focus:border-blue-500" />
                  <input type="text" placeholder="Location" id="n_bloc" className="bg-[#0A0A0A] border border-slate-700 text-sm rounded p-2 text-white outline-none focus:border-blue-500" />
                  <input type="text" placeholder="Manager Name" id="n_bmgr" className="bg-[#0A0A0A] border border-slate-700 text-sm rounded p-2 text-white outline-none focus:border-blue-500" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => {
                    const name = document.getElementById("n_bname").value
                    const location = document.getElementById("n_bloc").value
                    const manager = document.getElementById("n_bmgr").value
                    if(name) addBranch({name, location, manager})
                    setNewBranchMode(false)
                  }} className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded">Save</button>
                  <button onClick={() => setNewBranchMode(false)} className="bg-slate-800 text-white text-xs px-3 py-1.5 rounded">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Loan Products */}
        <div className="bg-[#111111] border border-slate-800 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-white mb-4">Loan Products</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loanProducts.map(p => (
              <div key={p.id} className={`p-4 rounded-xl border flex justify-between items-center transition-colors ${p.active ? 'bg-[#161616] border-slate-700' : 'bg-[#0A0A0A] border-slate-800 opacity-60'}`}>
                <div>
                  <div className="text-sm font-bold text-white">{p.name}</div>
                  <div className="text-xs text-slate-400 mt-1">{p.range} • {p.cycle}</div>
                </div>
                <button 
                  onClick={() => { toggleLoanProduct(p.id); triggerToast("Product updated.") }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${p.active ? 'bg-blue-600' : 'bg-slate-700'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${p.active ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4 text-xs text-slate-500 flex items-center gap-1.5">
            <Info size={14} /> Loan product changes take effect on new applications only.
          </div>
        </div>
      </div>
    )
  }

  const TabNotifications = () => {
    const renderToggle = (type, key, label, desc, adminReq) => {
      const active = notifications[type][key]
      const disabled = adminReq && !isAdmin
      return (
        <div className={`flex items-center justify-between p-3 rounded-lg ${disabled ? 'opacity-50' : 'hover:bg-slate-800/30'} transition-colors`}>
          <div className="pr-4">
            <div className="text-sm font-medium text-white flex items-center gap-2">
              {label} {disabled && <Lock size={12} className="text-slate-500" />}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
          </div>
          <button 
            disabled={disabled}
            onClick={() => { updateNotification(type, key, !active); triggerToast("Preference saved.") }}
            className={`relative shrink-0 inline-flex h-5 w-9 items-center rounded-full transition-colors ${active ? 'bg-blue-600' : 'bg-slate-700'}`}
          >
            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${active ? 'translate-x-5' : 'translate-x-1'}`} />
          </button>
        </div>
      )
    }

    const emailCount = Object.values(notifications.email).filter(Boolean).length
    const inAppCount = Object.values(notifications.inApp).filter(Boolean).length

    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        <div>
          <h2 className="text-xl font-bold text-white">Notification Preferences</h2>
          <p className="text-slate-400 text-sm">Choose what you want to be notified about and how.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-[#111111] border border-slate-800 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-white mb-4 border-b border-slate-800 pb-2">Email Notifications</h3>
            <div className="space-y-1">
              {renderToggle('email', 'agentAnomaly', 'Agent anomaly alerts', 'Get notified when Agent 3 flags an unusual transaction')}
              {renderToggle('email', 'tier3Approval', 'Tier 3 approval requests', 'Get notified when an agent action requires your approval')}
              {renderToggle('email', 'payrollCompletion', 'Payroll completion', 'Get notified when monthly payroll has been processed')}
              {renderToggle('email', 'centralBankReport', 'Central Bank report ready', 'Get notified when Agent 1 has compiled the monthly report')}
              {renderToggle('email', 'newStaffAccounts', 'New staff accounts', 'Get notified when a new user account is created', true)}
              {renderToggle('email', 'budgetThreshold', 'Budget threshold alerts', 'Get notified when a branch exceeds its monthly budget')}
              {renderToggle('email', 'newDeviceLogin', 'Login from new device', 'Get notified when your account is accessed from an unrecognised device')}
            </div>
          </div>
          <div className="bg-[#111111] border border-slate-800 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-white mb-4 border-b border-slate-800 pb-2">In-App Notifications</h3>
            <div className="space-y-1">
              {renderToggle('inApp', 'agentAnomaly', 'Agent anomaly alerts', 'Get notified when Agent 3 flags an unusual transaction')}
              {renderToggle('inApp', 'tier3Approval', 'Tier 3 approval requests', 'Get notified when an agent action requires your approval')}
              {renderToggle('inApp', 'payrollCompletion', 'Payroll completion', 'Get notified when monthly payroll has been processed')}
              {renderToggle('inApp', 'centralBankReport', 'Central Bank report ready', 'Get notified when Agent 1 has compiled the monthly report')}
              {renderToggle('inApp', 'newStaffAccounts', 'New staff accounts', 'Get notified when a new user account is created', true)}
              {renderToggle('inApp', 'budgetThreshold', 'Budget threshold alerts', 'Get notified when a branch exceeds its monthly budget')}
              {renderToggle('inApp', 'newDeviceLogin', 'Login from new device', 'Get notified when your account is accessed from an unrecognised device')}
            </div>
          </div>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <Bell className="text-blue-400" size={20} />
            <div className="text-sm text-blue-100">
              You are currently receiving <span className="font-bold">{emailCount}</span> email notifications and <span className="font-bold">{inAppCount}</span> in-app notifications.
            </div>
          </div>
        </div>
      </div>
    )
  }

  const TabAgents = () => {
    const getAgentUI = (id) => {
      switch(id) {
        case "A1": return { name: "Agent 1", desc: "Compliance & Reporting", color: "purple" }
        case "A2": return { name: "Agent 2", desc: "Workflow Orchestrator", color: "blue" }
        case "A3": return { name: "Agent 3", desc: "Anomaly Detection", color: "red" }
        case "A4": return { name: "Agent 4", desc: "NLQ Interface", color: "teal" }
        default: return { name: "", desc: "", color: "slate" }
      }
    }

    const handleAgentToggle = (a) => {
      if(a.active) {
        if(confirm(`Disabling ${getAgentUI(a.id).name} will stop all autonomous actions. Are you sure?`)) {
          toggleAgent(a.id)
          triggerToast(`${getAgentUI(a.id).name} disabled. Manual processes will need to handle tasks until re-enabled.`)
        }
      } else {
        toggleAgent(a.id)
        triggerToast(`${getAgentUI(a.id).name} enabled.`)
      }
    }

    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        <div>
          <h2 className="text-xl font-bold text-white">Agent Settings</h2>
          <p className="text-slate-400 text-sm">Configure how MicroFlow's AI agents behave and what they are allowed to do autonomously.</p>
        </div>

        {/* Agent Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agentSettings.agents.map(a => {
            const ui = getAgentUI(a.id)
            return (
              <div key={a.id} className={`bg-[#111111] border rounded-xl p-5 shadow-sm transition-all ${a.active ? `border-${ui.color}-500/30 border-t-4 border-t-${ui.color}-500` : 'border-slate-800 opacity-70'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg bg-${ui.color}-500/10 flex items-center justify-center text-${ui.color}-500 font-bold text-lg`}>{a.id}</div>
                    <div>
                      <div className="font-bold text-white">{ui.name}</div>
                      <div className="text-xs text-slate-400">{ui.desc}</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleAgentToggle(a)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${a.active ? 'bg-green-500' : 'bg-slate-700'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${a.active ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-4 text-xs">
                  <span className={`bg-slate-800 text-white px-2 py-0.5 rounded font-medium border border-slate-700`}>{a.active ? 'Active' : 'Inactive'}</span>
                  <span className="text-slate-500">• 1,244 actions this month</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Sensitivity */}
        <div className="bg-[#111111] border border-slate-800 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-white mb-2">Agent 3 — Anomaly Detection Sensitivity</h3>
          <p className="text-sm text-slate-400 mb-6">Adjust the threshold at which transactions are flagged for review.</p>
          
          <div className="max-w-xl">
            <input 
              type="range" min="1" max="3" step="1" 
              value={agentSettings.sensitivity === "Low" ? 1 : agentSettings.sensitivity === "Medium" ? 2 : 3}
              onChange={(e) => {
                const val = e.target.value
                const str = val === "1" ? "Low" : val === "2" ? "Medium" : "High"
                updateAgentSensitivity(str)
                setUnsavedChanges(true)
              }}
              className="w-full accent-blue-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer mb-2"
            />
            <div className="flex justify-between text-xs font-bold text-slate-500 mb-4 px-1">
              <span>Low</span><span>Medium</span><span>High</span>
            </div>
            
            <div className="bg-[#161616] p-4 rounded-lg border border-slate-700 min-h-[80px]">
              {agentSettings.sensitivity === "Low" && <p className="text-sm text-slate-300">Agent 3 will only flag transactions that are extremely unusual. Fewer alerts, lower chance of false positives. Recommended for established institutions with stable transaction patterns.</p>}
              {agentSettings.sensitivity === "Medium" && <p className="text-sm text-slate-300">Balanced detection. Agent 3 flags moderately unusual patterns. Recommended for most institutions.</p>}
              {agentSettings.sensitivity === "High" && <p className="text-sm text-slate-300">Agent 3 will flag any transaction that deviates from baseline patterns. More alerts, higher chance of false positives. Recommended during periods of rapid growth or suspected fraud.</p>}
            </div>
            
            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs text-slate-500">Current sensitivity: {agentSettings.sensitivity}. Adjusted thresholds take effect on the next transaction cycle.</div>
              <button 
                onClick={() => triggerToast(`Anomaly sensitivity updated to ${agentSettings.sensitivity}.`)}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-4 py-2 rounded transition-colors"
              >
                Save Sensitivity
              </button>
            </div>
          </div>
        </div>

        {/* Tier Table */}
        <div className="bg-[#111111] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-800">
            <h3 className="text-lg font-bold text-white mb-1">Graduated Trust Architecture — Current Configuration</h3>
            <p className="text-sm text-slate-400">These tier assignments define how much autonomy each agent has. Contact MicroFlow support to modify tier assignments.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-300">
              <thead className="text-xs text-slate-500 uppercase bg-[#161616] border-b border-slate-800 font-bold">
                <tr>
                  <th className="px-6 py-3">Action Type</th>
                  <th className="px-6 py-3">Agent</th>
                  <th className="px-6 py-3">Current Tier</th>
                  <th className="px-6 py-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                <tr className="hover:bg-slate-800/20">
                  <td className="px-6 py-4 font-medium text-white">NLQ Query Response</td>
                  <td className="px-6 py-4">Agent 4</td>
                  <td className="px-6 py-4"><span className="bg-blue-600 text-white px-2.5 py-1 rounded text-xs font-bold whitespace-nowrap">Tier 1</span></td>
                  <td className="px-6 py-4">Executes automatically, no notification</td>
                </tr>
                <tr className="hover:bg-slate-800/20">
                  <td className="px-6 py-4 font-medium text-white">Payroll Journal Entry Posting</td>
                  <td className="px-6 py-4">Agent 2</td>
                  <td className="px-6 py-4"><span className="bg-blue-600 text-white px-2.5 py-1 rounded text-xs font-bold whitespace-nowrap">Tier 1</span></td>
                  <td className="px-6 py-4">Executes automatically, no notification</td>
                </tr>
                <tr className="hover:bg-slate-800/20">
                  <td className="px-6 py-4 font-medium text-white">Budget Threshold Alert</td>
                  <td className="px-6 py-4">Agent 2</td>
                  <td className="px-6 py-4"><span className="bg-green-600 text-white px-2.5 py-1 rounded text-xs font-bold whitespace-nowrap">Tier 2</span></td>
                  <td className="px-6 py-4">Executes automatically, manager notified</td>
                </tr>
                <tr className="hover:bg-slate-800/20">
                  <td className="px-6 py-4 font-medium text-white">Duplicate Payment Detection</td>
                  <td className="px-6 py-4">Agent 3</td>
                  <td className="px-6 py-4"><span className="bg-green-600 text-white px-2.5 py-1 rounded text-xs font-bold whitespace-nowrap">Tier 2</span></td>
                  <td className="px-6 py-4">Flags automatically, officer notified</td>
                </tr>
                <tr className="hover:bg-slate-800/20">
                  <td className="px-6 py-4 font-medium text-white">EPF/ETF Compliance Report</td>
                  <td className="px-6 py-4">Agent 1</td>
                  <td className="px-6 py-4"><span className="bg-green-600 text-white px-2.5 py-1 rounded text-xs font-bold whitespace-nowrap">Tier 2</span></td>
                  <td className="px-6 py-4">Generates automatically, HR notified</td>
                </tr>
                <tr className="hover:bg-slate-800/20">
                  <td className="px-6 py-4 font-medium text-white">Central Bank Regulatory Report</td>
                  <td className="px-6 py-4">Agent 1</td>
                  <td className="px-6 py-4"><span className="bg-amber-500 text-slate-900 px-2.5 py-1 rounded text-xs font-bold whitespace-nowrap">Tier 3</span></td>
                  <td className="px-6 py-4">Prepared by agent, Finance Manager must approve</td>
                </tr>
                <tr className="hover:bg-slate-800/20">
                  <td className="px-6 py-4 font-medium text-white">High-Value Transaction Anomaly</td>
                  <td className="px-6 py-4">Agent 3</td>
                  <td className="px-6 py-4"><span className="bg-amber-500 text-slate-900 px-2.5 py-1 rounded text-xs font-bold whitespace-nowrap">Tier 3</span></td>
                  <td className="px-6 py-4">Flagged by agent, Finance Officer must review</td>
                </tr>
                <tr className="hover:bg-slate-800/20">
                  <td className="px-6 py-4 font-medium text-white">Volume Spike Detection</td>
                  <td className="px-6 py-4">Agent 3</td>
                  <td className="px-6 py-4"><span className="bg-red-600 text-white px-2.5 py-1 rounded text-xs font-bold whitespace-nowrap">Tier 4</span></td>
                  <td className="px-6 py-4">Alert raised, human decides all next steps</td>
                </tr>
                <tr className="hover:bg-slate-800/20">
                  <td className="px-6 py-4 font-medium text-white">Cross-Branch Anomaly Pattern</td>
                  <td className="px-6 py-4">Agent 3</td>
                  <td className="px-6 py-4"><span className="bg-red-600 text-white px-2.5 py-1 rounded text-xs font-bold whitespace-nowrap">Tier 4</span></td>
                  <td className="px-6 py-4">Alert raised, human decides all next steps</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-[#161616] text-xs text-slate-500 border-t border-slate-800 flex items-center gap-1.5">
            <Info size={14} /> Tier assignments are set by MicroFlow's governance framework and reflect the risk level of each action type.
          </div>
        </div>
      </div>
    )
  }

  const TabPrivacy = () => {
    const handleExport = () => {
      triggerToast("Preparing export... Download will start shortly.")
      setTimeout(() => triggerToast("Export ready. Downloading."), 2500)
    }

    const [delConfirm, setDelConfirm] = useState("")
    const [showResetModal, setShowResetModal] = useState(false)
    const [showDelModal, setShowDelModal] = useState(false)

    const handleReset = () => {
      resetDemoData()
      setShowResetModal(false)
      triggerToast("Demo data reset successfully.")
    }

    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        <div>
          <h2 className="text-xl font-bold text-white">Data & Privacy</h2>
          <p className="text-slate-400 text-sm">Manage your institution's data and privacy settings.</p>
        </div>

        {/* Data Export */}
        <div className="bg-[#111111] border border-slate-800 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-white mb-4">Export Institution Data</h3>
          <div className="flex flex-wrap gap-4">
            <button onClick={handleExport} disabled={!isAdmin} className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors border border-slate-700 cursor-pointer">Export All Loan Data — CSV</button>
            <button onClick={handleExport} disabled={!isAdmin} className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors border border-slate-700 cursor-pointer">Export Staff & Payroll Data — CSV</button>
            <button onClick={handleExport} disabled={!isAdmin} className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors border border-slate-700 cursor-pointer">Export Agent Activity Log — CSV</button>
          </div>
          {!isAdmin && <p className="text-xs text-slate-500 mt-3">Exports are only available to Institution Admins.</p>}
        </div>

        {/* Retention Policy */}
        <div className="bg-[#111111] border border-slate-800 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2"><Shield size={18} className="text-blue-400"/> Data Retention Policy</h3>
          <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">MicroFlow retains transaction data for 7 years in compliance with Sri Lankan financial regulations. Agent activity logs are retained for 3 years. Personal staff data is retained for the duration of employment plus 5 years.</p>
        </div>

        {/* Danger Zone */}
        {isAdmin && (
          <div className="bg-[#111111] border border-slate-800 border-l-4 border-l-red-500 rounded-xl p-6 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-bl-full pointer-events-none"></div>
            <h3 className="text-lg font-bold text-red-500 mb-1 flex items-center gap-2"><AlertTriangle size={18} /> Danger Zone</h3>
            <p className="text-sm text-slate-400 mb-6">These actions are irreversible. Proceed with caution.</p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                onClick={() => setShowResetModal(true)}
                className="py-2.5 px-6 rounded-lg border-2 border-red-500/50 text-red-400 font-bold hover:bg-red-500/10 hover:border-red-500 transition-colors bg-[#0A0A0A]"
              >
                Reset Demo Data
              </button>
              <button 
                onClick={() => setShowDelModal(true)}
                className="py-2.5 px-6 rounded-lg bg-red-600 text-white font-bold hover:bg-red-500 transition-colors shadow-lg shadow-red-600/20"
              >
                Delete Institution
              </button>
            </div>
          </div>
        )}

        {/* Danger Modals */}
        {showResetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-[#111111] border border-red-500/30 rounded-2xl w-full max-w-md shadow-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-2">Reset Demo Data?</h2>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">This will reset all MicroFlow data to the original demo state. All custom configuration, staff accounts, and transaction history will be replaced with demo data. This is intended for prototype demonstration purposes only.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowResetModal(false)} className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors font-medium">Cancel</button>
                <button onClick={handleReset} className="flex-1 py-2.5 rounded-lg border-2 border-red-500/50 text-red-400 font-bold hover:bg-red-500/10 hover:border-red-500 transition-colors">Reset Demo Data</button>
              </div>
            </div>
          </div>
        )}

        {showDelModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-[#111111] border border-red-500 rounded-2xl w-full max-w-md shadow-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-2">Delete Institution?</h2>
              <p className="text-slate-400 text-sm mb-4 leading-relaxed">This will permanently delete your institution and all associated data. This action cannot be undone.</p>
              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-500 mb-2">Please type <span className="text-white select-none">{institution?.name}</span> to confirm.</label>
                <input type="text" value={delConfirm} onChange={e=>setDelConfirm(e.target.value)} className="w-full bg-[#161616] border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:border-red-500 focus:outline-none" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => {setShowDelModal(false); setDelConfirm("")}} className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors font-medium">Cancel</button>
                <button 
                  disabled={delConfirm !== institution?.name}
                  onClick={() => { setShowDelModal(false); setDelConfirm(""); triggerToast("This action is disabled in the demo environment.") }} 
                  className="flex-1 py-2.5 rounded-lg bg-red-600 text-white font-bold hover:bg-red-500 disabled:opacity-30 disabled:hover:bg-red-600 transition-colors shadow-lg shadow-red-600/20 disabled:shadow-none"
                >
                  Delete Permanently
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    )
  }

  return (
    <div className="flex-1 flex overflow-hidden bg-[#0A0A0A] text-slate-200 font-sans">
      
      {/* Top Banner for Unsaved Changes */}
      {unsavedChanges && (
        <div className="absolute top-0 left-0 right-0 h-10 bg-amber-500/10 border-b border-amber-500/20 text-amber-500 text-sm font-medium flex items-center justify-center gap-2 z-50 animate-in slide-in-from-top-10">
          <AlertTriangle size={16} /> You have unsaved changes in this section.
        </div>
      )}

      {/* Toast Notification */}
      {showToast.visible && (
        <div className="fixed bottom-6 right-6 bg-[#161616] border border-blue-500/30 text-white px-5 py-3 rounded-lg shadow-2xl flex items-center gap-3 z-50 animate-in slide-in-from-bottom-5">
          <CheckCircle className="text-green-400" size={20} />
          <div className="text-sm font-medium">{showToast.message}</div>
        </div>
      )}

      {/* Left Sidebar Tabs */}
      <div className="w-72 bg-[#0F0F0F] border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-8 pb-4">
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Settings</h1>
          <p className="text-slate-500 text-sm leading-relaxed">Manage your account, institution, and system preferences.</p>
        </div>
        <div className="px-4 py-4 space-y-1 overflow-y-auto custom-scrollbar flex-1">
          {TABS.map(t => {
            const isActive = activeTab === t.id
            const isDisabled = t.adminOnly && !isAdmin
            return (
              <button
                key={t.id}
                onClick={() => { if(!isDisabled) setActiveTab(t.id) }}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all relative ${
                  isActive 
                    ? "bg-blue-600/10 text-blue-400 font-medium" 
                    : isDisabled 
                      ? "text-slate-600 cursor-not-allowed" 
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 cursor-pointer"
                }`}
              >
                {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-r"></div>}
                <div className="flex items-center gap-3 ml-2">
                  <t.icon size={18} className={isActive ? "text-blue-400" : isDisabled ? "text-slate-600" : "text-slate-500"} />
                  {t.label}
                </div>
                <div className="flex items-center gap-2">
                  {unsavedChanges && isActive && <div className="w-2 h-2 rounded-full bg-amber-500"></div>}
                  {isDisabled && <Lock size={14} />}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Right Content Area */}
      <div className="flex-1 overflow-y-auto bg-[#0A0A0A] p-8 lg:p-12 custom-scrollbar mt-10 lg:mt-0 relative">
         <div className="max-w-5xl mx-auto">
            {renderTabContent()}
         </div>
      </div>

    </div>
  )
}
