import { create } from "zustand"
import { persist } from "zustand/middleware"

const DEFAULT_DEMO_DATA = {
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
  }
}

export const useStore = create(
  persist(
    (set) => ({
      ...DEFAULT_DEMO_DATA,
      
      // Current User
      updateProfile: (profileUpdates) => set((state) => ({
        currentUser: { ...state.currentUser, ...profileUpdates }
      })),
      logout: () => set({ currentUser: null }),
      login: (user) => set({ currentUser: user }),

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

      // System
      resetDemoData: () => set({ ...DEFAULT_DEMO_DATA })
    }),
    {
      name: "microflow-storage", // name of item in localStorage
    }
  )
)
