import React, { useState, useEffect } from "react"
import { Check, ArrowRight, ArrowLeft, Building2, Landmark, Coins, Users, Play, CheckCircle2, ShieldCheck, FileSpreadsheet, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { useStore } from "@/store"
import { useNavigate } from "react-router-dom"

import Step1Institution from "./Step1Institution"
import Step2Branches from "./Step2Branches"
import Step3Products from "./Step3Products"
import Step4Users from "./Step4Users"
import Step5Review from "./Step5Review"

const STEPS = [
  "Institution Details",
  "Branch Setup",
  "Loan Products",
  "User Accounts & Roles",
  "Review & Launch"
]

export default function OnboardingWizard() {
  const isReRun = useStore((state) => state.onboardingComplete)
  const currentWizardStep = useStore((state) => state.currentWizardStep)
  const setOnboardingComplete = useStore((state) => state.setOnboardingComplete)
  const setCurrentWizardStep = useStore((state) => state.setCurrentWizardStep)
  const navigate = useNavigate()
  const store = useStore()

  // Wizard state loaded from localStorage if exists
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    // Step 1: Institution Details
    institutionName: "",
    registrationNumber: "",
    district: "",
    institutionType: "",
    numBranches: "1",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    // Step 2: Branch Setup
    branches: [{ name: "", location: "", manager: "" }],
    // Step 3: Loan Products
    selectedProducts: [],
    hasCustomProduct: false,
    customProduct: { name: "", sizeRange: "", repaymentCycle: "" },
    // Step 4: User Accounts & Roles
    users: []
  })

  const [startTime, setStartTime] = useState(null)
  const [errors, setErrors] = useState({})
  const [isLaunched, setIsLaunched] = useState(false)
  const [confetti, setConfetti] = useState([])
  const [setupDurationText, setSetupDurationText] = useState("")

  // Load state on mount
  useEffect(() => {
    if (isReRun) {
      setFormData({
        institutionName: store.institution?.name || "",
        registrationNumber: store.institution?.registrationNumber || "",
        district: store.institution?.district || "",
        institutionType: store.institution?.type || "",
        numBranches: store.branches?.length?.toString() || "1",
        contactName: store.currentUser?.firstName + " " + store.currentUser?.lastName || "",
        contactEmail: store.currentUser?.email || "",
        contactPhone: store.currentUser?.phone || "",
        branches: store.branches?.length > 0 ? store.branches.map(b => ({name: b.name, location: b.location, manager: b.manager})) : [{ name: "", location: "", manager: "" }],
        selectedProducts: store.loanProducts?.filter(p => p.active).map(p => p.id) || [],
        hasCustomProduct: false,
        customProduct: { name: "", sizeRange: "", repaymentCycle: "" },
        users: store.staff?.map(s => ({name: s.name, email: s.email, role: s.role, branch: s.branch})) || []
      })
      setCurrentStep(1)
    } else {
      const savedData = localStorage.getItem("microflow-onboarding-data")
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData)
          if (!parsed.branches || !Array.isArray(parsed.branches)) parsed.branches = [{ name: "", location: "", manager: "" }]
          if (!parsed.selectedProducts || !Array.isArray(parsed.selectedProducts)) parsed.selectedProducts = []
          if (parsed.hasCustomProduct === undefined) parsed.hasCustomProduct = false
          if (!parsed.customProduct) parsed.customProduct = { name: "", sizeRange: "", repaymentCycle: "" }
          if (!parsed.users || !Array.isArray(parsed.users)) parsed.users = []
          setFormData(parsed)
        } catch (e) {
          console.error("Failed to parse onboarding data from localStorage")
        }
      }
      
      if (currentWizardStep > 1) {
        setCurrentStep(currentWizardStep)
      } else {
        const savedStep = localStorage.getItem("microflow-onboarding-step")
        if (savedStep) {
          const stepNum = Number(savedStep)
          if (stepNum > STEPS.length) setIsLaunched(true)
          else setCurrentStep(stepNum)
        }
      }
      
      const savedTime = localStorage.getItem("microflow-onboarding-start-time")
      if (savedTime) setStartTime(Number(savedTime))
      else {
        const now = Date.now()
        setStartTime(now)
        localStorage.setItem("microflow-onboarding-start-time", now.toString())
      }
    }
  }, [isReRun])

  // Dynamic syncing of primary admin from Step 1 into users[0]
  useEffect(() => {
    if (formData.contactName || formData.contactEmail) {
      setFormData(prev => {
        const currentUsers = [...prev.users]
        const defaultBranch = prev.branches[0]?.name || "All Branches"
        
        if (currentUsers.length === 0) {
          currentUsers.push({
            name: prev.contactName,
            email: prev.contactEmail,
            role: "Institution Admin",
            branch: defaultBranch
          })
        } else {
          currentUsers[0] = {
            ...currentUsers[0],
            name: prev.contactName,
            email: prev.contactEmail,
            role: "Institution Admin"
          }
          if (!currentUsers[0].branch) {
            currentUsers[0].branch = defaultBranch
          }
        }
        return { ...prev, users: currentUsers }
      })
    }
  }, [formData.contactName, formData.contactEmail, formData.branches])

  // Calculate setup duration text when reaching Step 5
  useEffect(() => {
    if (currentStep === 5 && startTime) {
      const seconds = Math.floor((Date.now() - startTime) / 1000)
      const minutes = Math.floor(seconds / 60)
      if (minutes === 0) {
        setSetupDurationText(`${seconds} seconds`)
      } else {
        const remainingSecs = seconds % 60
        setSetupDurationText(`${minutes} minute${minutes > 1 ? "s" : ""} and ${remainingSecs} second${remainingSecs !== 1 ? "s" : ""}`)
      }
    }
  }, [currentStep, startTime])

  // Save state helper
  const saveState = (updatedData, updatedStep) => {
    localStorage.setItem("microflow-onboarding-data", JSON.stringify(updatedData))
    localStorage.setItem("microflow-onboarding-step", updatedStep.toString())
    if (!isReRun) {
      setCurrentWizardStep(updatedStep)
    }
  }

  const handleInputChange = (field, value) => {
    const updatedData = { ...formData, [field]: value }
    setFormData(updatedData)
    saveState(updatedData, currentStep)
    
    // Clear error for field
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  // Branch Setup Helpers
  const handleAddBranch = () => {
    const updatedBranches = [...formData.branches, { name: "", location: "", manager: "" }]
    const updatedData = { ...formData, branches: updatedBranches }
    setFormData(updatedData)
    saveState(updatedData, currentStep)
  }

  const handleRemoveBranch = (index) => {
    if (formData.branches.length <= 1) return
    const updatedBranches = formData.branches.filter((_, i) => i !== index)
    const updatedData = { ...formData, branches: updatedBranches }
    setFormData(updatedData)
    saveState(updatedData, currentStep)
  }

  const handleBranchChange = (index, field, value) => {
    const updatedBranches = formData.branches.map((branch, i) => {
      if (i === index) {
        return { ...branch, [field]: value }
      }
      return branch
    })
    const updatedData = { ...formData, branches: updatedBranches }
    setFormData(updatedData)
    saveState(updatedData, currentStep)
  }

  // Loan Products Helpers
  const toggleProductSelection = (productId) => {
    let updatedSelected = []
    if (formData.selectedProducts.includes(productId)) {
      updatedSelected = formData.selectedProducts.filter(id => id !== productId)
    } else {
      updatedSelected = [...formData.selectedProducts, productId]
    }
    const updatedData = { ...formData, selectedProducts: updatedSelected }
    setFormData(updatedData)
    saveState(updatedData, currentStep)
  }

  const toggleCustomProduct = () => {
    const updatedData = { ...formData, hasCustomProduct: !formData.hasCustomProduct }
    setFormData(updatedData)
    saveState(updatedData, currentStep)
  }

  const handleCustomProductChange = (field, value) => {
    const updatedCustom = { ...formData.customProduct, [field]: value }
    const updatedData = { ...formData, customProduct: updatedCustom }
    setFormData(updatedData)
    saveState(updatedData, currentStep)
  }

  // User Accounts & Roles Helpers
  const handleAddUser = () => {
    const defaultBranch = formData.branches[0]?.name || "All Branches"
    const updatedUsers = [...formData.users, { name: "", email: "", role: "Loan Officer", branch: defaultBranch }]
    const updatedData = { ...formData, users: updatedUsers }
    setFormData(updatedData)
    saveState(updatedData, currentStep)
  }

  const handleRemoveUser = (index) => {
    if (index === 0) return
    const updatedUsers = formData.users.filter((_, i) => i !== index)
    const updatedData = { ...formData, users: updatedUsers }
    setFormData(updatedData)
    saveState(updatedData, currentStep)
  }

  const handleUserChange = (index, field, value) => {
    const updatedUsers = formData.users.map((user, i) => {
      if (i === index) {
        return { ...user, [field]: value }
      }
      return user
    })
    const updatedData = { ...formData, users: updatedUsers }
    setFormData(updatedData)
    saveState(updatedData, currentStep)
  }

  // Validate Step 1
  const validateStep1 = () => {
    const newErrors = {}
    if (!formData.institutionName.trim()) newErrors.institutionName = "Institution name is required"
    if (!formData.registrationNumber.trim()) newErrors.registrationNumber = "Registration number is required"
    if (!formData.district) newErrors.district = "Please select a district"
    if (!formData.institutionType) newErrors.institutionType = "Please select an institution type"
    
    const branchCount = parseInt(formData.numBranches, 10)
    if (!formData.numBranches || isNaN(branchCount) || branchCount < 1) {
      newErrors.numBranches = "At least 1 branch is required"
    }

    if (!formData.contactName.trim()) newErrors.contactName = "Contact name is required"
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!formData.contactEmail.trim()) {
      newErrors.contactEmail = "Email address is required"
    } else if (!emailRegex.test(formData.contactEmail.trim())) {
      newErrors.contactEmail = "Please enter a valid email address"
    }

    const phoneRegex = /^(?:\+94|94|0)?(?:7\d{8}|[1-9]\d{8})$/
    if (!formData.contactPhone.trim()) {
      newErrors.contactPhone = "Phone number is required"
    } else if (!phoneRegex.test(formData.contactPhone.trim().replace(/[\s-]/g, ""))) {
      newErrors.contactPhone = "Enter a valid Sri Lankan phone number (e.g. 0771234567)"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Validate Step 2: Branch Setup
  const validateStep2 = () => {
    const branchErrors = {}
    let isValid = true

    if (!formData.branches || formData.branches.length === 0) {
      setErrors({ global: "At least one branch is required to proceed" })
      return false
    }

    formData.branches.forEach((branch, idx) => {
      const rowErrors = {}
      if (!branch.name.trim()) {
        rowErrors.name = "Branch name is required"
        isValid = false
      }
      if (!branch.location.trim()) {
        rowErrors.location = "Branch address is required"
        isValid = false
      }
      if (!branch.manager.trim()) {
        rowErrors.manager = "Branch manager is required"
        isValid = false
      }
      if (Object.keys(rowErrors).length > 0) {
        branchErrors[idx] = rowErrors
      }
    })

    setErrors(prev => ({ ...prev, branches: branchErrors }))
    return isValid
  }

  // Validate Step 3: Loan Products
  const validateStep3 = () => {
    let isValid = true
    const customProductErrors = {}

    if (formData.selectedProducts.length === 0 && !formData.hasCustomProduct) {
      setErrors(prev => ({ ...prev, products: "Please select at least one loan product to proceed" }))
      return false
    }

    if (formData.hasCustomProduct) {
      if (!formData.customProduct.name.trim()) {
        customProductErrors.name = "Product name is required"
        isValid = false
      }
      if (!formData.customProduct.sizeRange.trim()) {
        customProductErrors.sizeRange = "Loan size range is required"
        isValid = false
      }
      if (!formData.customProduct.repaymentCycle) {
        customProductErrors.repaymentCycle = "Repayment cycle is required"
        isValid = false
      }
    }

    if (Object.keys(customProductErrors).length > 0) {
      setErrors(prev => ({ ...prev, customProduct: customProductErrors }))
    }

    return isValid
  }

  // Validate Step 4: User Accounts & Roles
  const validateStep4 = () => {
    const userErrors = {}
    let isValid = true
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    formData.users.forEach((user, idx) => {
      const rowErrors = {}
      if (idx > 0) {
        if (!user.name.trim()) {
          rowErrors.name = "Full name is required"
          isValid = false
        }
        if (!user.email.trim()) {
          rowErrors.email = "Email is required"
          isValid = false
        } else if (!emailRegex.test(user.email.trim())) {
          rowErrors.email = "Enter a valid email"
          isValid = false
        }
      }

      if (!user.role) {
        rowErrors.role = "Please assign a role"
        isValid = false
      }
      if (!user.branch) {
        rowErrors.branch = "Please assign a branch"
        isValid = false
      }

      if (Object.keys(rowErrors).length > 0) {
        userErrors[idx] = rowErrors
      }
    })

    setErrors(prev => ({ ...prev, users: userErrors }))
    return isValid
  }

  const handleNext = () => {
    if (currentStep === 1) {
      if (validateStep1()) {
        const nextStep = currentStep + 1
        setCurrentStep(nextStep)
        saveState(formData, nextStep)
      }
    } else if (currentStep === 2) {
      if (validateStep2()) {
        const nextStep = currentStep + 1
        setCurrentStep(nextStep)
        saveState(formData, nextStep)
      }
    } else if (currentStep === 3) {
      if (validateStep3()) {
        const nextStep = currentStep + 1
        setCurrentStep(nextStep)
        saveState(formData, nextStep)
      }
    } else if (currentStep === 4) {
      if (validateStep4()) {
        const nextStep = currentStep + 1
        setCurrentStep(nextStep)
        saveState(formData, nextStep)
      }
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      const prevStep = currentStep - 1
      setCurrentStep(prevStep)
      saveState(formData, prevStep)
    }
  }

  const handleLaunch = () => {
    if (isReRun) {
      store.updateInstitution({
        name: formData.institutionName,
        registrationNumber: formData.registrationNumber,
        district: formData.district,
        type: formData.institutionType
      })
      
      const toast = document.createElement("div")
      toast.className = "fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-in fade-in"
      toast.innerText = "Configuration updated successfully"
      document.body.appendChild(toast)
      setTimeout(() => {
        if (document.body.contains(toast)) document.body.removeChild(toast)
      }, 3000)
      
      navigate("/settings")
      return
    }

    // Generate floating confetti coordinates
    const particles = Array.from({ length: 120 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100, // Left %
      color: ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"][Math.floor(Math.random() * 6)],
      size: Math.random() * 8 + 6,
      delay: Math.random() * 3,
      duration: Math.random() * 2 + 2.5
    }))
    store.updateInstitution({
      name: formData.institutionName || store.institution?.name,
      registrationNumber: formData.registrationNumber || store.institution?.registrationNumber,
      district: formData.district || store.institution?.district,
      type: formData.institutionType || store.institution?.type
    })
    setConfetti(particles)
    setIsLaunched(true)
    setOnboardingComplete(true)
    setCurrentWizardStep(1)
    // Save to step = 6 (completed/launched)
    saveState(formData, STEPS.length + 1)
  }

  const handleReset = () => {
    localStorage.removeItem("microflow-onboarding-data")
    localStorage.removeItem("microflow-onboarding-step")
    localStorage.removeItem("microflow-onboarding-start-time")
    setIsLaunched(false)
    setCurrentStep(1)
    setStartTime(Date.now())
    setFormData({
      institutionName: "",
      registrationNumber: "",
      district: "",
      institutionType: "",
      numBranches: "1",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      branches: [{ name: "", location: "", manager: "" }],
      selectedProducts: [],
      hasCustomProduct: false,
      customProduct: { name: "", sizeRange: "", repaymentCycle: "" },
      users: []
    })
  }

  // Dynamic Header Icons
  const getHeaderIcon = () => {
    switch (currentStep) {
      case 1:
        return <Building2 className="size-6" />
      case 2:
        return <Landmark className="size-6" />
      case 3:
        return <Coins className="size-6" />
      case 4:
        return <Users className="size-6" />
      case 5:
        return <Play className="size-6 text-primary" />
      default:
        return <Landmark className="size-6" />
    }
  }

  const getHeaderTitle = () => {
    switch (currentStep) {
      case 1:
        return "Institution Profile Setup"
      case 2:
        return "Branch Infrastructure Setup"
      case 3:
        return "Configure Loan Offerings"
      case 4:
        return "User Accounts & Access Control"
      case 5:
        return "Review Configuration & Launch"
      default:
        return `Step ${currentStep}`
    }
  }

  const getHeaderDescription = () => {
    switch (currentStep) {
      case 1:
        return "Configure your core microfinance institution details to generate compliance settings."
      case 2:
        return "Add the physical/regional branches currently operated by your institution."
      case 3:
        return "Select the standard loan templates offered by your MFI, or define a custom product."
      case 4:
        return "Provision employee credentials and assign roles (6 roles supported) for microfinance staff."
      case 5:
        return "Audit your onboarding parameters and launch the MicroFlow ERP backend."
      default:
        return ""
    }
  }

  // Confetti Animation Keyframes Injection
  const injectConfettiStyles = () => (
    <style>{`
      @keyframes fall {
        0% { transform: translateY(-50px) rotate(0deg); opacity: 1; }
        100% { transform: translateY(110vh) rotate(360deg); opacity: 0; }
      }
      .confetti-particle {
        animation: fall linear forwards;
      }
    `}</style>
  )

  // Success screen after launch
  if (isLaunched) {
    return (
      <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background px-4 py-12 text-foreground">
        {injectConfettiStyles()}
        
        {/* Floating Confetti Elements */}
        {confetti.map((c) => (
          <div
            key={c.id}
            className="confetti-particle absolute top-0 z-50 pointer-events-none rounded-sm"
            style={{
              left: `${c.x}%`,
              width: `${c.size}px`,
              height: `${c.size * 1.5}px`,
              backgroundColor: c.color,
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.duration}s`
            }}
          />
        ))}

        <Card className="w-full max-w-lg rounded-xl border bg-card shadow-2xl text-center p-8 space-y-6 relative z-10 scale-in-center animate-in fade-in duration-300">
          <div className="flex justify-center">
            <div className="p-4 bg-emerald-500/10 text-emerald-500 rounded-full animate-bounce">
              <CheckCircle2 className="size-16 stroke-[2px]" />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              MicroFlow ERP is Live!
            </h2>
            <p className="text-sm text-muted-foreground">
              Microfinance backbone successfully initialized for <span className="font-semibold text-foreground">{formData.institutionName || "your MFI"}</span>.
            </p>
          </div>

          <div className="p-4 bg-muted rounded-lg space-y-3 text-left">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="size-4 text-emerald-500 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Sri Lankan Payroll compliance:</span> EPF/ETF contributions automated for all employees.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <FileSpreadsheet className="size-4 text-emerald-500 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Regulatory compliance:</span> CBSL monthly reporting agent templates initialized.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <Calendar className="size-4 text-emerald-500 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Initial Setup completed:</span> All data validated and secured with row-level policies.
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <Button
              onClick={() => {
                navigate("/dashboard")
              }}
              size="lg"
              className="w-full cursor-pointer bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
            >
              Continue to Dashboard
            </Button>
            
            <p className="text-[10px] text-muted-foreground">
              MicroFlow ERP Backbone System • Component 4
            </p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className={`w-full bg-background text-foreground ${isReRun ? "py-2" : "min-h-svh"}`}>
      <div className="mx-auto w-full max-w-4xl px-4 py-6">
      {isReRun && (
        <div className="mb-6 border-l-4 border-l-amber-500 bg-amber-500/10 text-amber-600 p-4 rounded-r-lg">
          <p className="font-medium text-sm">Reviewing existing configuration — Changes saved here will update your live institution settings.</p>
        </div>
      )}
      {/* Reset button wrapper */}
      <div className="mb-4 flex justify-end">
        <button 
          onClick={handleReset}
          className="cursor-pointer text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
        >
          Reset Wizard
        </button>
      </div>

      {/* Progress Header */}
      <div className="mb-10">
        <div className="relative flex justify-between items-center w-full">
          {/* Connector Line Background */}
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-border -z-10" />
          
          {/* Active Progress Fill */}
          <div 
            className="absolute top-5 left-0 h-0.5 bg-primary transition-all duration-300 -z-10"
            style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
          />

          {STEPS.map((stepLabel, idx) => {
            const stepNum = idx + 1
            const isActive = currentStep === stepNum
            const isCompleted = currentStep > stepNum

            return (
              <div key={stepLabel} className="flex flex-col items-center flex-1">
                <div 
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 text-sm font-medium transition-all duration-300
                    ${isCompleted 
                      ? "bg-primary border-primary text-primary-foreground" 
                      : isActive 
                        ? "bg-background border-primary text-primary ring-4 ring-primary/20" 
                        : "bg-background border-border text-muted-foreground"
                    }
                  `}
                >
                  {isCompleted ? (
                    <Check className="size-5 stroke-[3px]" />
                  ) : (
                    <span>{stepNum}</span>
                  )}
                </div>
                <span 
                  className={`mt-3 text-xs font-medium text-center max-w-[120px] transition-colors duration-300 hidden md:block
                    ${isActive ? "text-foreground font-semibold" : "text-muted-foreground"}
                  `}
                >
                  {stepLabel}
                </span>
              </div>
            )
          })}
        </div>
        {/* Mobile active step indicator label */}
        <div className="mt-4 text-center md:hidden">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            Step {currentStep} of {STEPS.length}
          </p>
          <p className="text-sm font-semibold text-foreground">
            {STEPS[currentStep - 1]}
          </p>
        </div>
      </div>

      {/* Wizard Content Card */}
      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader className="border-b border-border/50 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              {getHeaderIcon()}
            </div>
            <div>
              <CardTitle className="text-xl font-semibold tracking-tight">{getHeaderTitle()}</CardTitle>
              <CardDescription>{getHeaderDescription()}</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {currentStep === 1 && (
            <Step1Institution 
              formData={formData} 
              errors={errors} 
              handleInputChange={handleInputChange} 
            />
          )}

          {currentStep === 2 && (
            <Step2Branches 
              formData={formData} 
              errors={errors} 
              handleAddBranch={handleAddBranch} 
              handleRemoveBranch={handleRemoveBranch} 
              handleBranchChange={handleBranchChange} 
            />
          )}

          {currentStep === 3 && (
            <Step3Products 
              formData={formData} 
              errors={errors} 
              toggleProductSelection={toggleProductSelection} 
              toggleCustomProduct={toggleCustomProduct} 
              handleCustomProductChange={handleCustomProductChange} 
            />
          )}

          {currentStep === 4 && (
            <Step4Users 
              formData={formData} 
              errors={errors} 
              handleAddUser={handleAddUser} 
              handleRemoveUser={handleRemoveUser} 
              handleUserChange={handleUserChange} 
            />
          )}

          {currentStep === 5 && (
            <Step5Review 
              formData={formData} 
              setupDurationText={isReRun ? null : setupDurationText}
            />
          )}
        </CardContent>

        <CardFooter className="flex items-center justify-between border-t border-border/50 pt-5">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleBack}
            disabled={currentStep === 1}
            className="cursor-pointer"
          >
            <ArrowLeft className="mr-2 size-4" />
            Back
          </Button>

          {currentStep === 5 ? (
            <Button
              type="button"
              size="lg"
              onClick={handleLaunch}
              className="flex cursor-pointer items-center bg-emerald-600 text-white hover:border-emerald-500 hover:bg-emerald-500"
            >
              {isReRun ? "Save Changes" : "Launch MicroFlow"}
              {!isReRun && <Play className="ml-2 size-4 fill-white" />}
            </Button>
          ) : (
            <Button
              type="button"
              size="lg"
              onClick={handleNext}
              className="cursor-pointer"
            >
              Next
              <ArrowRight className="ml-2 size-4" />
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
    </div>
  )
}
