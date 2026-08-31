import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import {
  ActivityIcon,
  AlertTriangleIcon,
  Building2Icon,
  CheckCircleIcon,
  ClockIcon,
  FlaskConicalIcon,
  LayoutDashboardIcon,
  SettingsIcon,
  SmartphoneIcon,
  ShieldCheckIcon,
  WalletIcon,
  PieChartIcon,
  UsersIcon,
  UsersRoundIcon,
  SparklesIcon,
  WrenchIcon,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useStore } from "@/store"
import { BORROWER_ACCESS_ROLES } from "@/components/borrower-management/mock-data"

const WORKSPACE_NAV = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: <LayoutDashboardIcon />,
    roles: ["all"],
  },
  {
    title: "Borrower Management",
    url: "/borrowers",
    icon: <UsersRoundIcon />,
    roles: BORROWER_ACCESS_ROLES.filter((role) => role !== "Loan Officer"),
  },
  {
    title: "HR Management",
    url: "/hr",
    icon: <UsersIcon />,
    roles: ["Institution Admin", "HR Officer"],
  },
  {
    title: "Payroll",
    url: "/payroll",
    icon: <WalletIcon />,
    roles: ["Institution Admin", "HR Officer"],
  },
  {
    title: "Finance Manager",
    url: "/finance-manager",
    icon: <PieChartIcon />,
    roles: ["Institution Admin", "Finance Officer"],
    items: [
      { title: "Finance dashboard", url: "/finance-manager" },
      { title: "Mission drift dashboard", url: "/alerts" },
      { title: "P&L report", url: "/pl-report" },
      { title: "Balance sheet", url: "/balance-sheet" },
      { title: "Cash flow", url: "/cash-flow" },
      { title: "Social performance", url: "/social-performance" },
    ],
  },
  {
    title: "Agent Activity Log",
    url: "/agent-log",
    icon: <ActivityIcon />,
    roles: ["Institution Admin"],
  },
  {
    title: "Tier Approvals",
    url: "/tier-approval",
    icon: <CheckCircleIcon />,
    roles: ["Institution Admin", "Finance Officer"],
  },
  {
    title: "Settings",
    url: "/settings",
    icon: <SettingsIcon />,
    roles: ["all"],
  },
  {
    title: "Setup & Onboarding",
    url: "/onboarding",
    icon: <WrenchIcon />,
    roles: ["Institution Admin"],
  },
  {
    title: "A/B Experiment",
    url: "/research/ab-experiment",
    icon: <FlaskConicalIcon />,
    roles: ["all"],
  },
]

const LOAN_OFFICER_NAV = [
  {
    title: "Dashboard",
    url: "/loan-officer",
    icon: <LayoutDashboardIcon />,
    match: (pathname) =>
      pathname === "/loan-officer" ||
      pathname.startsWith("/loan-officer/loans") ||
      pathname.startsWith("/loan-officer/groups"),
  },
  {
    title: "Borrower management",
    url: "/loan-officer/borrowers",
    icon: <UsersRoundIcon />,
    match: (pathname) =>
      pathname.startsWith("/loan-officer/borrowers") ||
      pathname.startsWith("/loan-officer/applications"),
  },
  {
    title: "Early warning",
    url: "/loan-officer/alerts",
    icon: <AlertTriangleIcon />,
    match: (pathname) => pathname.startsWith("/loan-officer/alerts"),
  },
  {
    title: "Overdue queue",
    url: "/loan-officer/overdue",
    icon: <ClockIcon />,
  },
  {
    title: "Collection",
    url: "/loan-officer/collection",
    icon: <SmartphoneIcon />,
  },
  {
    title: "Branch portfolio",
    url: "/loan-officer/branch",
    icon: <Building2Icon />,
  },
  {
    title: "My trust profile",
    url: "/loan-officer/trust-profile",
    icon: <ShieldCheckIcon />,
  },
]

export function AppSidebar({ ...props }) {
  const location = useLocation()
  const currentUser = useStore((state) => state.currentUser)
  const institution = useStore((state) => state.institution)
  const [tierCount, setTierCount] = React.useState(3)

  const isLoanOfficerArea = location.pathname.startsWith("/loan-officer")
  const role = currentUser?.role || "Institution Admin"

  React.useEffect(() => {
    const checkCount = () => {
      const count = localStorage.getItem("mf_tier3_count")
      if (count !== null) setTierCount(parseInt(count, 10))
    }
    checkCount()
    window.addEventListener("storage", checkCount)
    return () => window.removeEventListener("storage", checkCount)
  }, [])

  const user = {
    name: currentUser
      ? `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim()
      : "Jane Smith",
    email: currentUser?.email || currentUser?.role || "Institution Admin",
    avatar: currentUser?.avatar || "",
  }

  const navMain = isLoanOfficerArea
    ? LOAN_OFFICER_NAV
    : WORKSPACE_NAV.filter(
        (item) =>
          !item.roles ||
          item.roles.includes("all") ||
          item.roles.includes(role)
      ).map((item) =>
        item.title === "Tier Approvals"
          ? { ...item, badge: tierCount > 0 ? tierCount : undefined }
          : item
      )

  const homePath = isLoanOfficerArea ? "/loan-officer" : "/dashboard"

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link to={homePath} />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <span className="text-sm font-semibold">M</span>
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">MicroFlow</span>
                <span className="truncate text-xs">
                  {isLoanOfficerArea
                    ? "Loan Officer"
                    : institution?.name || "IMFS"}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain
          items={navMain}
          label={isLoanOfficerArea ? "Field operations" : "Workspace"}
        />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              size="lg" 
              onClick={() => useStore.getState().toggleAgentPanel()}
              className="bg-teal-500/10 text-teal-600 hover:bg-teal-500/20 hover:text-teal-700 dark:bg-teal-500/20 dark:text-teal-400 dark:hover:bg-teal-500/30 transition-all border border-teal-500/20 mb-2"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-teal-500 text-white shadow-sm">
                <SparklesIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Ask Agent 4</span>
                <span className="truncate text-[10px] opacity-80">Global NLQ Interface</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
