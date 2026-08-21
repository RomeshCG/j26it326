import React, { useState, useMemo } from "react"
import { 
  ChevronDown, 
  Search, 
  CheckCircle, 
  AlertTriangle, 
  Download, 
  Info,
  Loader2,
  FileText
} from "lucide-react"

// Formatting helper
const formatLKR = (amount) => {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

// Dummy Data
const DUMMY_STAFF = [
  { id: 1, name: "Nimal Perera", role: "Branch Manager", branch: "Colombo HQ", basic: 95000, allowances: 15000 },
  { id: 2, name: "Kasun Silva", role: "Loan Officer", branch: "Colombo HQ", basic: 55000, allowances: 8000 },
  { id: 3, name: "Chamari Fernando", role: "Finance Officer", branch: "Colombo HQ", basic: 75000, allowances: 10000 },
  { id: 4, name: "Saman Kumara", role: "Field Officer", branch: "Gampaha", basic: 45000, allowances: 12000 },
  { id: 5, name: "Ruwanthi Rajapaksha", role: "Field Officer", branch: "Gampaha", basic: 45000, allowances: 12000 },
  { id: 6, name: "Dinesh Jayasuriya", role: "Branch Manager", branch: "Kandy", basic: 90000, allowances: 12000 },
  { id: 7, name: "Amila Bandara", role: "Loan Officer", branch: "Kandy", basic: 55000, allowances: 8000 },
  { id: 8, name: "Malini Senanayake", role: "HR Officer", branch: "Colombo HQ", basic: 70000, allowances: 10000 },
]

export default function Payroll() {
  const [payrollStatus, setPayrollStatus] = useState("Not Run") // Not Run, Processing, Completed
  const [selectedBranch, setSelectedBranch] = useState("All Branches")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortConfig, setSortConfig] = useState({ key: "name", direction: "asc" })
  
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showInfoPanel, setShowInfoPanel] = useState(false)
  
  // Data processing
  const staffData = useMemo(() => {
    return DUMMY_STAFF.map(staff => {
      const gross = staff.basic + staff.allowances
      const epfEmployee = gross * 0.08
      const epfEmployer = gross * 0.12
      const etfEmployer = gross * 0.03
      const net = gross - epfEmployee
      
      let status = "Pending"
      if (payrollStatus === "Completed") status = "Processed"
      // Randomly set someone on leave if not run for realism? No, keep it simple or hardcode.
      if (payrollStatus === "Not Run" && staff.id === 5) status = "On Leave"

      return {
        ...staff,
        gross,
        epfEmployee,
        epfEmployer,
        etfEmployer,
        net,
        status
      }
    })
  }, [payrollStatus])

  // Filtering & Sorting
  const filteredData = useMemo(() => {
    let data = staffData

    if (selectedBranch !== "All Branches") {
      data = data.filter(s => s.branch === selectedBranch)
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      data = data.filter(s => s.name.toLowerCase().includes(q))
    }

    data.sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === "asc" ? -1 : 1
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === "asc" ? 1 : -1
      }
      return 0
    })

    return data
  }, [staffData, selectedBranch, searchQuery, sortConfig])

  // Aggregations
  const totals = useMemo(() => {
    return filteredData.reduce((acc, curr) => ({
      gross: acc.gross + curr.gross,
      epfEmployee: acc.epfEmployee + curr.epfEmployee,
      epfEmployer: acc.epfEmployer + curr.epfEmployer,
      etfEmployer: acc.etfEmployer + curr.etfEmployer,
      net: acc.net + curr.net
    }), { gross: 0, epfEmployee: 0, epfEmployer: 0, etfEmployer: 0, net: 0 })
  }, [filteredData])

  const branches = ["All Branches", ...new Set(DUMMY_STAFF.map(s => s.branch))]

  const handleSort = (key) => {
    let direction = "asc"
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc"
    }
    setSortConfig({ key, direction })
  }

  const runPayroll = () => {
    setPayrollStatus("Processing")
    setShowConfirmModal(false)
    setTimeout(() => {
      setPayrollStatus("Completed")
    }, 2000)
  }

  const handleDownload = (format) => {
    alert(`Downloading payroll report as ${format}...`)
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-slate-200 p-6 lg:p-10 font-sans">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">Payroll Management</h1>
          <span className="text-slate-400 text-lg">December 2024</span>
          
          <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${
            payrollStatus === "Completed" ? "bg-green-500/10 text-green-400 border-green-500/20" :
            payrollStatus === "Processing" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
            "bg-slate-800 text-slate-300 border-slate-700"
          }`}>
            {payrollStatus}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="appearance-none bg-[#161616] border border-slate-800 text-slate-200 text-sm rounded-lg pl-4 pr-10 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer"
            >
              {branches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-2.5 text-slate-500 pointer-events-none" size={16} />
          </div>

          {payrollStatus === "Completed" && (
            <div className="relative group">
              <button className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors border border-slate-700 cursor-pointer">
                <Download size={16} />
                Download Report
              </button>
              <div className="absolute right-0 top-full mt-2 w-48 bg-[#161616] border border-slate-800 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                <button onClick={() => handleDownload('PDF')} className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white first:rounded-t-lg transition-colors cursor-pointer">
                  Download as PDF
                </button>
                <button onClick={() => handleDownload('CSV')} className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white last:rounded-b-lg transition-colors cursor-pointer">
                  Download as CSV
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-[#111111] border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-slate-400 text-sm font-medium mb-1">Total Gross Salary</div>
          <div className="text-2xl font-bold text-white mb-2">{formatLKR(totals.gross)}</div>
          <div className="text-xs text-slate-500">Sum of all staff basic + allowances</div>
        </div>
        <div className="bg-[#111111] border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-slate-400 text-sm font-medium mb-1">Total EPF (Employee 8%)</div>
          <div className="text-2xl font-bold text-white mb-2">{formatLKR(totals.epfEmployee)}</div>
          <div className="text-xs text-slate-500">Deducted from employee salaries</div>
        </div>
        <div className="bg-[#111111] border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-slate-400 text-sm font-medium mb-1">Total ETF (Employer 3%)</div>
          <div className="text-2xl font-bold text-white mb-2">{formatLKR(totals.etfEmployer)}</div>
          <div className="text-xs text-slate-500">Paid by employer contribution</div>
        </div>
        <div className="bg-[#111111] border border-slate-800 rounded-xl p-5 shadow-sm ring-1 ring-blue-500/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 rounded-bl-full pointer-events-none"></div>
          <div className="text-blue-400 text-sm font-medium mb-1">Total Net Payable</div>
          <div className="text-3xl font-bold text-blue-50 mb-2">{formatLKR(totals.net)}</div>
          <div className="text-xs text-slate-500">Gross minus employee EPF deductions</div>
        </div>
      </div>

      {/* Controls: Search & Info */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
          <input 
            type="text" 
            placeholder="Search by name..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#111111] border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-600 transition-colors"
          />
        </div>
        <button 
          onClick={() => setShowInfoPanel(!showInfoPanel)}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        >
          <Info size={16} />
          {showInfoPanel ? "Hide EPF/ETF Rates" : "View EPF/ETF Rates"}
        </button>
      </div>

      {/* EPF/ETF Info Panel */}
      {showInfoPanel && (
        <div className="bg-[#111111] border border-slate-800 rounded-lg p-4 mb-6 text-sm animate-in slide-in-from-top-2">
          <h4 className="font-semibold text-white mb-2">Statutory EPF/ETF Rates</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
            <div className="bg-[#161616] p-3 rounded border border-slate-800/50">
              <div className="text-slate-400 mb-1">EPF Employee Contribution</div>
              <div className="text-lg font-medium text-white">8%</div>
            </div>
            <div className="bg-[#161616] p-3 rounded border border-slate-800/50">
              <div className="text-slate-400 mb-1">EPF Employer Contribution</div>
              <div className="text-lg font-medium text-white">12%</div>
            </div>
            <div className="bg-[#161616] p-3 rounded border border-slate-800/50">
              <div className="text-slate-400 mb-1">ETF Employer Contribution</div>
              <div className="text-lg font-medium text-white">3%</div>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Rates set per the Employees Provident Fund Act and Employees Trust Fund Act of Sri Lanka. Pre-configured by MicroFlow.
          </p>
        </div>
      )}

      {/* Table */}
      <div className="bg-[#111111] border border-slate-800 rounded-xl overflow-hidden mb-8 overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm whitespace-nowrap">
          <thead>
            <tr className="bg-[#161616] border-b border-slate-800">
              <th className="p-4 font-medium text-slate-400 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort("name")}>
                Employee Name {sortConfig.key === "name" && (sortConfig.direction === "asc" ? "↑" : "↓")}
              </th>
              <th className="p-4 font-medium text-slate-400">Role</th>
              <th className="p-4 font-medium text-slate-400 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort("branch")}>
                Branch {sortConfig.key === "branch" && (sortConfig.direction === "asc" ? "↑" : "↓")}
              </th>
              <th className="p-4 font-medium text-slate-400 text-right">Basic (LKR)</th>
              <th className="p-4 font-medium text-slate-400 text-right">Allowances (LKR)</th>
              <th className="p-4 font-medium text-slate-400 text-right">Gross (LKR)</th>
              <th className="p-4 font-medium text-slate-400 text-right">EPF Emp 8%</th>
              <th className="p-4 font-medium text-slate-400 text-right">EPF Emplr 12%</th>
              <th className="p-4 font-medium text-slate-400 text-right">ETF Emplr 3%</th>
              <th className="p-4 font-medium text-blue-400 text-right">Net Salary (LKR)</th>
              <th className="p-4 font-medium text-slate-400 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {filteredData.map((staff, idx) => (
              <tr key={staff.id} className={`${idx % 2 === 0 ? "bg-[#0A0A0A]" : "bg-[#0F0F0F]"} hover:bg-slate-800/30 transition-colors`}>
                <td className="p-4 font-medium text-white">{staff.name}</td>
                <td className="p-4 text-slate-300">{staff.role}</td>
                <td className="p-4 text-slate-300">{staff.branch}</td>
                <td className="p-4 text-slate-400 text-right">{staff.basic.toLocaleString('en-LK')}</td>
                <td className="p-4 text-slate-400 text-right">{staff.allowances.toLocaleString('en-LK')}</td>
                <td className="p-4 font-medium text-slate-200 text-right">{staff.gross.toLocaleString('en-LK')}</td>
                <td className="p-4 text-orange-400/80 text-right">-{staff.epfEmployee.toLocaleString('en-LK')}</td>
                <td className="p-4 text-slate-500 text-right">{staff.epfEmployer.toLocaleString('en-LK')}</td>
                <td className="p-4 text-slate-500 text-right">{staff.etfEmployer.toLocaleString('en-LK')}</td>
                <td className="p-4 font-bold text-blue-100 text-right">{staff.net.toLocaleString('en-LK')}</td>
                <td className="p-4 text-center">
                  <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${
                    staff.status === "Processed" ? "bg-green-500/10 text-green-400 border-green-500/20" :
                    staff.status === "On Leave" ? "bg-slate-700/50 text-slate-400 border-slate-600" :
                    "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                  }`}>
                    {staff.status}
                  </span>
                </td>
              </tr>
            ))}
            {filteredData.length === 0 && (
              <tr>
                <td colSpan="11" className="p-8 text-center text-slate-500">No staff found matching your criteria.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Main Action Area */}
      <div className="flex flex-col items-center justify-center py-8">
        {payrollStatus === "Completed" ? (
          <div className="flex items-center gap-3 text-green-400 bg-green-500/10 px-6 py-4 rounded-xl border border-green-500/20 animate-in zoom-in">
            <CheckCircle size={24} />
            <div>
              <div className="font-semibold text-lg">Payroll Completed — December 2024</div>
              <div className="text-sm text-green-500/80">Journal entries posted to Finance automatically. Finance Officer has been notified.</div>
            </div>
          </div>
        ) : payrollStatus === "Processing" ? (
          <div className="flex items-center gap-4 text-blue-400 px-6 py-4">
            <Loader2 className="animate-spin" size={24} />
            <span className="font-medium text-lg">Agent 2 processing payroll journal entries...</span>
          </div>
        ) : (
          <button
            onClick={() => setShowConfirmModal(true)}
            className="w-full max-w-md bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] transition-all cursor-pointer transform hover:-translate-y-1"
          >
            Run Payroll for December 2024
          </button>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#111111] border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-6 border-b border-slate-800">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <AlertTriangle className="text-yellow-500" size={24} />
                Confirm Payroll Run
              </h2>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="flex justify-between items-center bg-[#161616] p-4 rounded-lg border border-slate-800">
                <div>
                  <div className="text-slate-400 text-sm">Total Staff</div>
                  <div className="text-white font-medium text-lg">{filteredData.length} Employees</div>
                </div>
                <div className="text-right">
                  <div className="text-slate-400 text-sm">Total Net Payable</div>
                  <div className="text-blue-400 font-bold text-xl">{formatLKR(totals.net)}</div>
                </div>
              </div>

              {/* Agent 2 Notice */}
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl overflow-hidden">
                <div className="bg-blue-500/10 p-4 border-b border-blue-500/20 flex items-start gap-3">
                  <div className="p-1.5 bg-blue-500/20 rounded-md text-blue-400 mt-0.5">
                    <FileText size={16} />
                  </div>
                  <div>
                    <div className="font-semibold text-blue-300">Agent 2 — Workflow Orchestrator</div>
                    <div className="text-sm text-blue-200/80 mt-1">
                      Will automatically post the following journal entries to the Finance module upon confirmation:
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <table className="w-full text-sm text-left">
                    <thead className="text-slate-400 border-b border-slate-700/50">
                      <tr>
                        <th className="pb-2 font-medium">Account</th>
                        <th className="pb-2 font-medium text-right">Debit (LKR)</th>
                        <th className="pb-2 font-medium text-right">Credit (LKR)</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-300 divide-y divide-slate-800/50">
                      <tr>
                        <td className="py-2">Salaries Expense</td>
                        <td className="py-2 text-right">{totals.gross.toLocaleString('en-LK')}</td>
                        <td className="py-2 text-right">-</td>
                      </tr>
                      <tr>
                        <td className="py-2">Employer EPF Expense (12%)</td>
                        <td className="py-2 text-right">{totals.epfEmployer.toLocaleString('en-LK')}</td>
                        <td className="py-2 text-right">-</td>
                      </tr>
                      <tr>
                        <td className="py-2">Employer ETF Expense (3%)</td>
                        <td className="py-2 text-right">{totals.etfEmployer.toLocaleString('en-LK')}</td>
                        <td className="py-2 text-right">-</td>
                      </tr>
                      <tr>
                        <td className="py-2">EPF Payable (8% + 12%)</td>
                        <td className="py-2 text-right">-</td>
                        <td className="py-2 text-right">{(totals.epfEmployee + totals.epfEmployer).toLocaleString('en-LK')}</td>
                      </tr>
                      <tr>
                        <td className="py-2">ETF Payable (3%)</td>
                        <td className="py-2 text-right">-</td>
                        <td className="py-2 text-right">{totals.etfEmployer.toLocaleString('en-LK')}</td>
                      </tr>
                      <tr>
                        <td className="py-2 font-medium text-white">Salaries Payable</td>
                        <td className="py-2 text-right">-</td>
                        <td className="py-2 text-right font-medium text-white">{totals.net.toLocaleString('en-LK')}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="text-sm text-red-400/80 flex items-center justify-center gap-2">
                <AlertTriangle size={14} />
                This action cannot be undone for the current month.
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 flex justify-end gap-3 bg-[#161616]">
              <button 
                onClick={() => setShowConfirmModal(false)}
                className="px-6 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={runPayroll}
                className="px-6 py-2.5 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors cursor-pointer shadow-lg shadow-blue-500/20"
              >
                Confirm & Run Payroll
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
