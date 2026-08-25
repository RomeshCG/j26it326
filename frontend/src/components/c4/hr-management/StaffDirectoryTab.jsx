import { useState, useMemo } from "react"
import { useStore } from "@/store"
import { Search, Plus, Edit2, Eye, ToggleLeft, ToggleRight, X } from "lucide-react"

export default function StaffDirectoryTab() {
  const staff = useStore((state) => state.staff || [])
  const branches = useStore((state) => state.branches) || []
  const addStaffMember = useStore((state) => state.addStaffMember)
  const updateStaffMember = useStore((state) => state.updateStaffMember)
  const updateStaffStatus = useStore((state) => state.updateStaffStatus)
  const currentUser = useStore((state) => state.currentUser)

  const [search, setSearch] = useState("")
  const [branchFilter, setBranchFilter] = useState("All Branches")
  const [roleFilter, setRoleFilter] = useState("All Roles")
  const [statusFilter, setStatusFilter] = useState("All")

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState(null)

  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false)
  const [deactivatingStaff, setDeactivatingStaff] = useState(null)

  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false)
  const [viewingStaff, setViewingStaff] = useState(null)

  const [toastMessage, setToastMessage] = useState("")

  const ROLES = ["Institution Admin", "Finance Officer", "HR Officer", "Branch Manager", "Loan Officer", "Field Officer"]

  const filteredStaff = useMemo(() => {
    return staff.filter((s) => {
      const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase()) ||
        s.role.toLowerCase().includes(search.toLowerCase())
      const matchBranch = branchFilter === "All Branches" || s.branch === branchFilter
      const matchRole = roleFilter === "All Roles" || s.role === roleFilter
      const matchStatus = statusFilter === "All" || s.status === statusFilter
      return matchSearch && matchBranch && matchRole && matchStatus
    })
  }, [staff, search, branchFilter, roleFilter, statusFilter])

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(""), 3000)
  }

  const handleDeactivate = () => {
    if (deactivatingStaff) {
      updateStaffStatus(deactivatingStaff.id, "Inactive")
      showToast(`${deactivatingStaff.name} has been deactivated.`)
      setIsDeactivateModalOpen(false)
    }
  }

  const handleActivate = (staffMember) => {
    updateStaffStatus(staffMember.id, "Active")
    showToast(`${staffMember.name} has been activated.`)
  }

  return (
    <div className="space-y-4 relative">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search staff..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background pl-8 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option>All Branches</option>
            {branches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
          </select>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option>All Roles</option>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option>All</option>
            <option>Active</option>
            <option>Inactive</option>
            <option>On Leave</option>
            <option>Probation</option>
          </select>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} /> Add New Staff
        </button>
      </div>

      {/* Table */}
      <div className="rounded-md border border-border">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Branch</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredStaff.length > 0 ? (
              filteredStaff.map((s) => (
                <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-blue-700 dark:text-blue-400 font-semibold text-xs">
                        {s.name.split(" ").map(n => n[0]).join("").substring(0, 2)}
                      </div>
                      <div>
                        <div className="font-medium text-foreground">{s.name}</div>
                        <div className="text-xs text-muted-foreground">Joined {s.dateJoined}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground border border-border/50">
                      {s.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{s.branch}</td>
                  <td className="px-4 py-3">
                    <div className="text-foreground">{s.email}</div>
                    <div className="text-xs text-muted-foreground">{s.phone}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${s.status === "Active" ? "bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20" :
                        s.status === "Inactive" ? "bg-gray-500/10 text-gray-700 dark:text-gray-400 border border-gray-500/20" :
                          s.status === "On Leave" ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20" :
                            "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20"
                      }`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => { setViewingStaff(s); setIsProfileDrawerOpen(true); }}
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors" title="View Profile"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => { setEditingStaff(s); setIsEditModalOpen(true); }}
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors" title="Edit"
                      >
                        <Edit2 size={16} />
                      </button>
                      {s.status === "Inactive" ? (
                        <button
                          onClick={() => handleActivate(s)}
                          className="p-1 text-muted-foreground hover:text-green-600 transition-colors" title="Activate"
                        >
                          <ToggleLeft size={16} />
                        </button>
                      ) : (
                        <button
                          onClick={() => { setDeactivatingStaff(s); setIsDeactivateModalOpen(true); }}
                          className="p-1 text-muted-foreground hover:text-red-600 transition-colors" title="Deactivate"
                        >
                          <ToggleRight size={16} className="text-green-600" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="px-4 py-8 text-center text-muted-foreground">
                  No staff members found matching your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Staff Modal */}
      {isAddModalOpen && (
        <StaffFormModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          branches={branches}
          roles={ROLES}
          onSubmit={(data) => {
            addStaffMember({ ...data, status: "Active" })
            showToast(`Staff member added successfully. Login credentials sent to ${data.email}.`)
            setIsAddModalOpen(false)
          }}
        />
      )}

      {/* Edit Staff Modal */}
      {isEditModalOpen && editingStaff && (
        <StaffFormModal
          isOpen={isEditModalOpen}
          onClose={() => { setIsEditModalOpen(false); setEditingStaff(null) }}
          branches={branches}
          roles={ROLES}
          initialData={editingStaff}
          onSubmit={(data) => {
            updateStaffMember(editingStaff.id, data)
            showToast("Staff profile updated.")
            setIsEditModalOpen(false)
            setEditingStaff(null)
          }}
        />
      )}

      {/* Deactivate Confirmation Modal */}
      {isDeactivateModalOpen && deactivatingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold text-foreground">Deactivate {deactivatingStaff.name}?</h3>
            <p className="mb-6 text-sm text-muted-foreground">
              This will revoke their system access immediately. Their data and history will be preserved.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsDeactivateModalOpen(false)}
                className="rounded-md px-4 py-2 text-sm font-medium border border-input hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleDeactivate}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Drawer */}
      {isProfileDrawerOpen && viewingStaff && (
        <>
          <div
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
            onClick={() => setIsProfileDrawerOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm border-l border-border bg-card p-6 shadow-xl transition-transform overflow-y-auto duration-300 translate-x-0">
            <button
              onClick={() => setIsProfileDrawerOpen(false)}
              className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100"
            >
              <X size={20} />
            </button>

            <div className="mt-6 flex flex-col items-center">
              <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-blue-500/20 text-blue-700 dark:text-blue-400 font-bold text-3xl">
                {viewingStaff.name.split(" ").map(n => n[0]).join("").substring(0, 2)}
              </div>
              <h2 className="text-xl font-bold">{viewingStaff.name}</h2>
              <div className="mt-2 flex gap-2">
                <span className="inline-flex rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
                  {viewingStaff.role}
                </span>
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${viewingStaff.status === "Active" ? "bg-green-500/10 text-green-700" :
                    viewingStaff.status === "Inactive" ? "bg-gray-500/10 text-gray-700" :
                      viewingStaff.status === "On Leave" ? "bg-amber-500/10 text-amber-700" :
                        "bg-blue-500/10 text-blue-700"
                  }`}>
                  {viewingStaff.status}
                </span>
              </div>
            </div>

            <div className="mt-8 space-y-6">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-foreground/80">Contact Details</h3>
                <div className="rounded-lg border border-border p-3 text-sm">
                  <div className="mb-1 text-muted-foreground">Email: <span className="text-foreground">{viewingStaff.email}</span></div>
                  <div className="text-muted-foreground">Phone: <span className="text-foreground">{viewingStaff.phone}</span></div>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-foreground/80">Employment Information</h3>
                <div className="rounded-lg border border-border p-3 text-sm">
                  <div className="mb-2 flex justify-between"><span className="text-muted-foreground">Branch</span> <span className="font-medium text-foreground">{viewingStaff.branch}</span></div>
                  <div className="mb-2 flex justify-between"><span className="text-muted-foreground">Type</span> <span className="font-medium text-foreground">{viewingStaff.type}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Date Joined</span> <span className="font-medium text-foreground">{viewingStaff.dateJoined}</span></div>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-foreground/80">Compensation</h3>
                <div className="rounded-lg border border-border p-3 text-sm">
                  {["Institution Admin", "HR Officer"].includes(currentUser?.role || "Institution Admin") ? (
                    <>
                      <div className="mb-2 flex justify-between"><span className="text-muted-foreground">Basic Salary</span> <span className="font-medium text-foreground">LKR {viewingStaff.basicSalary?.toLocaleString() || 0}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Allowances</span> <span className="font-medium text-foreground">LKR {viewingStaff.allowances?.toLocaleString() || 0}</span></div>
                    </>
                  ) : (
                    <div className="text-muted-foreground italic text-center py-2">Confidential</div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-foreground/80">Leave Balance</h3>
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="rounded-lg border border-border p-2">
                    <div className="text-lg font-bold">14</div>
                    <div className="text-[10px] text-muted-foreground">Annual</div>
                  </div>
                  <div className="rounded-lg border border-border p-2">
                    <div className="text-lg font-bold">7</div>
                    <div className="text-[10px] text-muted-foreground">Casual</div>
                  </div>
                  <div className="rounded-lg border border-border p-2">
                    <div className="text-lg font-bold">14</div>
                    <div className="text-[10px] text-muted-foreground">Medical</div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <h3 className="mb-3 text-sm font-semibold text-foreground/80">Quick Actions</h3>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => { setIsProfileDrawerOpen(false); setEditingStaff(viewingStaff); setIsEditModalOpen(true); }}
                    className="w-full rounded-md bg-secondary py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
                  >
                    Edit Profile
                  </button>
                  <button className="w-full rounded-md border border-input bg-transparent py-2 text-sm font-medium hover:bg-muted text-muted-foreground">
                    View Payroll History
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Simple Toast */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-2 rounded-md bg-foreground px-4 py-3 text-sm text-background shadow-lg">
          {toastMessage}
        </div>
      )}
    </div>
  )
}

function StaffFormModal({ onClose, onSubmit, initialData = null, branches, roles }) {
  const [formData, setFormData] = useState(initialData || {
    name: "",
    email: "",
    phone: "",
    role: "Loan Officer",
    branch: branches[0]?.name || "",
    type: "Permanent",
    dateJoined: new Date().toISOString().split("T")[0],
    basicSalary: 45000,
    allowances: 0
  })

  const roleSalaryDefaults = {
    "Institution Admin": 85000,
    "Finance Officer": 65000,
    "HR Officer": 58000,
    "Branch Manager": 72000,
    "Loan Officer": 45000,
    "Field Officer": 38000
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    const updates = { [name]: value }

    if (name === "role" && !initialData) {
      updates.basicSalary = roleSalaryDefaults[value] || 0
    }

    setFormData(prev => ({ ...prev, ...updates }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit({
      ...formData,
      basicSalary: Number(formData.basicSalary),
      allowances: Number(formData.allowances)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm overflow-y-auto py-8">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl my-auto">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{initialData ? "Edit Staff Member" : "Add New Staff"}</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 col-span-1 sm:col-span-2">
              <label className="text-sm font-medium">Full Name <span className="text-red-500">*</span></label>
              <input required type="text" name="name" value={formData.name} onChange={handleChange} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Email Address <span className="text-red-500">*</span></label>
              <input required type="email" name="email" value={formData.email} onChange={handleChange} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Phone Number</label>
              <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Role</label>
              <select name="role" value={formData.role} onChange={handleChange} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                {roles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Branch</label>
              <select name="branch" value={formData.branch} onChange={handleChange} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                {branches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Employment Type</label>
              <select name="type" value={formData.type} onChange={handleChange} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="Permanent">Permanent</option>
                <option value="Contract">Contract</option>
                <option value="Probationary">Probationary</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Date Joined</label>
              <input type="date" name="dateJoined" value={formData.dateJoined} onChange={handleChange} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Basic Salary (LKR)</label>
              <input type="number" name="basicSalary" value={formData.basicSalary} onChange={handleChange} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Allowances (LKR)</label>
              <input type="number" name="allowances" value={formData.allowances} onChange={handleChange} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>

          {!initialData && (
            <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground mt-4">
              A system-generated password will be emailed to the staff member. They will be prompted to change it on first login.
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
            <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm font-medium border border-input hover:bg-muted transition-colors">
              Cancel
            </button>
            <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
              {initialData ? "Save Changes" : "Add Staff Member"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
