import { create } from "zustand"
import { persist } from "zustand/middleware"

const DEFAULT_DEMO_DATA = {
  onboardingComplete: true,
  currentWizardStep: 1,
  onboardingStartTime: null,
  currentUser: {
    firstName: "Amal",
    lastName: "Perera",
    email: "amal.perera@apexmicrofinance.lk",
    phone: "+94 77 123 4567",
    role: "Institution Admin",
    memberSince: "Jan 2024",
    language: "English"
  },
  institution: {
    name: "Apex Microfinance Ltd",
    registrationNumber: "MFC/2023/45",
    type: "Licensed Finance Company",
    district: "Colombo"
  },
  branches: [
    { id: 1, name: "Colombo Head Office", location: "Colombo 03", manager: "Nimal Silva" },
    { id: 2, name: "Kandy Branch", location: "Kandy City", manager: "Sunil Bandara" },
    { id: 3, name: "Galle Branch", location: "Galle Fort", manager: "Kumari Fernando" }
  ],
  loanProducts: [
    { id: 1, name: "Micro-Enterprise Loan", range: "LKR 50,000 - 500,000", cycle: "Weekly", active: true },
    { id: 2, name: "Agricultural Loan", range: "LKR 100,000 - 1,000,000", cycle: "Monthly", active: true },
    { id: 3, name: "Women Empowerment Loan", range: "LKR 25,000 - 200,000", cycle: "Weekly", active: false }
  ],
  notifications: {
    email: {
      agentAnomaly: true,
      tier3Approval: true,
      payrollCompletion: true,
      centralBankReport: true,
      newStaffAccounts: true,
      budgetThreshold: true,
      newDeviceLogin: true
    },
    inApp: {
      agentAnomaly: true,
      tier3Approval: true,
      payrollCompletion: true,
      centralBankReport: true,
      newStaffAccounts: true,
      budgetThreshold: true,
      newDeviceLogin: true
    }
  },
  agentSettings: {
    sensitivity: "Medium",
    agents: [
      { id: "A1", active: true },
      { id: "A2", active: true },
      { id: "A3", active: true },
      { id: "A4", active: true }
    ]
  },
  staff: [
    { id: 1, name: "Nimal Silva", email: "nimal@example.com", phone: "0771234567", role: "Branch Manager", branch: "Colombo Head Office", type: "Permanent", dateJoined: "2020-01-15", basicSalary: 72000, allowances: 5000, status: "Active" },
    { id: 2, name: "Sunil Bandara", email: "sunil@example.com", phone: "0712345678", role: "Branch Manager", branch: "Kandy Branch", type: "Permanent", dateJoined: "2019-11-01", basicSalary: 72000, allowances: 5000, status: "Active" },
    { id: 3, name: "Kumari Fernando", email: "kumari@example.com", phone: "0759876543", role: "Branch Manager", branch: "Galle Branch", type: "Permanent", dateJoined: "2021-03-10", basicSalary: 72000, allowances: 5000, status: "On Leave" },
    { id: 4, name: "Kamal Perera", email: "kamal@example.com", phone: "0771122334", role: "Institution Admin", branch: "Colombo Head Office", type: "Permanent", dateJoined: "2018-05-20", basicSalary: 85000, allowances: 10000, status: "Active" },
    { id: 5, name: "Saman Kumara", email: "saman@example.com", phone: "0712233445", role: "Finance Officer", branch: "Colombo Head Office", type: "Permanent", dateJoined: "2022-02-15", basicSalary: 65000, allowances: 2000, status: "Active" },
    { id: 6, name: "Ruwanthi de Silva", email: "ruwanthi@example.com", phone: "0773344556", role: "HR Officer", branch: "Colombo Head Office", type: "Permanent", dateJoined: "2023-01-10", basicSalary: 58000, allowances: 2000, status: "Active" },
    { id: 7, name: "Nuwan Jayasuriya", email: "nuwan@example.com", phone: "0714455667", role: "Loan Officer", branch: "Kandy Branch", type: "Probationary", dateJoined: "2024-05-01", basicSalary: 45000, allowances: 1000, status: "Probation" },
    { id: 8, name: "Chandana Weerasinghe", email: "chandana@example.com", phone: "0755566778", role: "Field Officer", branch: "Galle Branch", type: "Contract", dateJoined: "2024-01-20", basicSalary: 38000, allowances: 500, status: "Active" },
    { id: 9, name: "Dinesh Ranatunga", email: "dinesh@example.com", phone: "0776677889", role: "Field Officer", branch: "Colombo Head Office", type: "Contract", dateJoined: "2023-11-15", basicSalary: 38000, allowances: 500, status: "Inactive" },
    { id: 10, name: "Malkanthi Rathnayake", email: "malkanthi@example.com", phone: "0717788990", role: "Loan Officer", branch: "Galle Branch", type: "Permanent", dateJoined: "2020-08-05", basicSalary: 45000, allowances: 1000, status: "Active" }
  ],
  leaveRequests: [
    { id: 1, staffName: "Kumari Fernando", role: "Branch Manager", branch: "Galle Branch", type: "Annual Leave", fromDate: "2026-08-25", toDate: "2026-08-27", duration: 3, reason: "Family trip", status: "Approved", submittedOn: "2026-08-15" },
    { id: 2, staffName: "Saman Kumara", role: "Finance Officer", branch: "Colombo Head Office", type: "Casual Leave", fromDate: "2026-08-30", toDate: "2026-08-30", duration: 1, reason: "Personal work", status: "Pending", submittedOn: "2026-08-24" },
    { id: 3, staffName: "Nuwan Jayasuriya", role: "Loan Officer", branch: "Kandy Branch", type: "Medical Leave", fromDate: "2026-08-20", toDate: "2026-08-21", duration: 2, reason: "Fever", status: "Approved", submittedOn: "2026-08-20" },
    { id: 4, staffName: "Dinesh Ranatunga", role: "Field Officer", branch: "Colombo Head Office", type: "No Pay Leave", fromDate: "2026-08-10", toDate: "2026-08-15", duration: 6, reason: "Personal emergency", status: "Rejected", submittedOn: "2026-08-05" },
    { id: 5, staffName: "Chandana Weerasinghe", role: "Field Officer", branch: "Galle Branch", type: "Annual Leave", fromDate: "2026-09-01", toDate: "2026-09-05", duration: 5, reason: "Vacation", status: "Pending", submittedOn: "2026-08-22" },
    { id: 6, staffName: "Malkanthi Rathnayake", role: "Loan Officer", branch: "Galle Branch", type: "Casual Leave", fromDate: "2026-08-28", toDate: "2026-08-28", duration: 1, reason: "Bank visit", status: "Pending", submittedOn: "2026-08-25" }
  ],
  attendanceData: [
    { id: 1, staffName: "Nimal Silva", role: "Branch Manager", branch: "Colombo Head Office", workingDays: 20, present: 20, absent: 0, late: 0, attendanceRate: 100 },
    { id: 2, staffName: "Sunil Bandara", role: "Branch Manager", branch: "Kandy Branch", workingDays: 20, present: 19, absent: 1, late: 2, attendanceRate: 95 },
    { id: 3, staffName: "Kumari Fernando", role: "Branch Manager", branch: "Galle Branch", workingDays: 20, present: 17, absent: 3, late: 1, attendanceRate: 85 },
    { id: 4, staffName: "Kamal Perera", role: "Institution Admin", branch: "Colombo Head Office", workingDays: 20, present: 20, absent: 0, late: 0, attendanceRate: 100 },
    { id: 5, staffName: "Saman Kumara", role: "Finance Officer", branch: "Colombo Head Office", workingDays: 20, present: 18, absent: 2, late: 3, attendanceRate: 90 },
    { id: 6, staffName: "Ruwanthi de Silva", role: "HR Officer", branch: "Colombo Head Office", workingDays: 20, present: 20, absent: 0, late: 1, attendanceRate: 100 },
    { id: 7, staffName: "Nuwan Jayasuriya", role: "Loan Officer", branch: "Kandy Branch", workingDays: 20, present: 15, absent: 5, late: 4, attendanceRate: 75 },
    { id: 8, staffName: "Chandana Weerasinghe", role: "Field Officer", branch: "Galle Branch", workingDays: 20, present: 19, absent: 1, late: 0, attendanceRate: 95 },
    { id: 9, staffName: "Dinesh Ranatunga", role: "Field Officer", branch: "Colombo Head Office", workingDays: 20, present: 10, absent: 10, late: 0, attendanceRate: 50 },
    { id: 10, staffName: "Malkanthi Rathnayake", role: "Loan Officer", branch: "Galle Branch", workingDays: 20, present: 20, absent: 0, late: 0, attendanceRate: 100 }
  ]
}

export const useStore = create(
  persist(
    (set) => ({
      ...DEFAULT_DEMO_DATA,
      
      // Agent Panel NLQ
      agentPanelOpen: false,
      nlqChatHistory: [],
      nlqChatArchive: [],
      unreadAgentResponses: false,

      toggleAgentPanel: () => set((state) => ({ 
        agentPanelOpen: !state.agentPanelOpen,
        unreadAgentResponses: state.agentPanelOpen ? state.unreadAgentResponses : false
      })),
      addNlqMessage: (message) => set((state) => {
        const isAgent = message.type === "agent"
        return {
          nlqChatHistory: [...state.nlqChatHistory, message],
          unreadAgentResponses: isAgent && !state.agentPanelOpen ? true : state.unreadAgentResponses
        }
      }),
      archiveNlqChat: () => set((state) => {
        if (state.nlqChatHistory.length === 0) return state;
        const session = {
          sessionId: Date.now(),
          archivedAt: new Date().toISOString(),
          messages: state.nlqChatHistory
        }
        return {
          nlqChatArchive: [...state.nlqChatArchive, session],
          nlqChatHistory: []
        }
      }),
      markAgentResponsesRead: () => set({ unreadAgentResponses: false }),

      // Current User
      updateProfile: (profileUpdates) => set((state) => ({
        currentUser: { ...state.currentUser, ...profileUpdates }
      })),
      logout: () => set({ currentUser: null }),
      login: (user) => set({ currentUser: user }),

      // Onboarding
      setOnboardingComplete: (status) => set({ onboardingComplete: status }),
      setCurrentWizardStep: (step) => set({ currentWizardStep: step }),
      setOnboardingStartTime: (time) => set({ onboardingStartTime: time }),

      // Institution Profile
      updateInstitution: (updates) => set((state) => ({
        institution: { ...state.institution, ...updates }
      })),

      // Branches
      updateBranch: (id, updates) => set((state) => ({
        branches: state.branches.map(b => b.id === id ? { ...b, ...updates } : b)
      })),
      removeBranch: (id) => set((state) => ({
        branches: state.branches.filter(b => b.id !== id)
      })),
      addBranch: (newBranch) => set((state) => ({
        branches: [...state.branches, { id: Date.now(), ...newBranch }]
      })),

      // Loan Products
      toggleLoanProduct: (id) => set((state) => ({
        loanProducts: state.loanProducts.map(p => 
          p.id === id ? { ...p, active: !p.active } : p
        )
      })),

      // Notifications
      updateNotification: (type, key, value) => set((state) => ({
        notifications: {
          ...state.notifications,
          [type]: {
            ...state.notifications[type],
            [key]: value
          }
        }
      })),

      // Agents
      updateAgentSensitivity: (level) => set((state) => ({
        agentSettings: { ...state.agentSettings, sensitivity: level }
      })),
      toggleAgent: (id) => set((state) => ({
        agentSettings: {
          ...state.agentSettings,
          agents: state.agentSettings.agents.map(a => 
            a.id === id ? { ...a, active: !a.active } : a
          )
        }
      })),

      // HR Management (Staff)
      addStaffMember: (staff) => set((state) => ({
        staff: [...state.staff, { id: Date.now(), ...staff }]
      })),
      updateStaffMember: (id, updates) => set((state) => ({
        staff: state.staff.map(s => s.id === id ? { ...s, ...updates } : s)
      })),
      updateStaffStatus: (id, status) => set((state) => ({
        staff: state.staff.map(s => s.id === id ? { ...s, status } : s)
      })),

      // HR Management (Leave)
      approveLeave: (id) => set((state) => {
        const leave = state.leaveRequests.find(l => l.id === id);
        if (!leave) return state;
        
        // Update leave status
        const updatedLeaves = state.leaveRequests.map(l => 
          l.id === id ? { ...l, status: "Approved" } : l
        );

        // Update staff status to "On Leave" if the leave dates include today
        const today = new Date().toISOString().split("T")[0];
        let updatedStaff = state.staff;
        if (leave.fromDate <= today && leave.toDate >= today) {
          updatedStaff = state.staff.map(s => 
            s.name === leave.staffName ? { ...s, status: "On Leave" } : s
          );
        }

        return { leaveRequests: updatedLeaves, staff: updatedStaff };
      }),
      rejectLeave: (id) => set((state) => ({
        leaveRequests: state.leaveRequests.map(l => 
          l.id === id ? { ...l, status: "Rejected" } : l
        )
      })),
      applyLeave: (leave) => set((state) => ({
        leaveRequests: [{ id: Date.now(), ...leave, status: "Pending", submittedOn: new Date().toISOString().split("T")[0] }, ...state.leaveRequests]
      })),

      // System
      resetDemoData: () => set({ ...DEFAULT_DEMO_DATA })
    }),
    {
      name: "microflow-storage", // name of item in localStorage
    }
  )
)
