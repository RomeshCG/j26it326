import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import {
  ActivityIcon,
  CheckCircleIcon,
  ClipboardListIcon,
  FlaskConicalIcon,
  LayoutDashboardIcon,
  SettingsIcon,
  SmartphoneIcon,
  ShieldCheckIcon,
  WalletIcon,
  UsersIcon,
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

const WORKSPACE_NAV = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: <LayoutDashboardIcon />,
    roles: ["all"],
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
      pathname === "/loan-officer" || pathname.startsWith("/loan-officer/alerts"),
  },
  {
    title: "Loan application",
    url: "/loan-officer/application",
    icon: <ClipboardListIcon />,
  },
  {
    title: "Collection",
    url: "/loan-officer/collection",
    icon: <SmartphoneIcon />,
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
    : WORKSPACE_NAV
        .filter((item) => item.roles.includes("all") || item.roles.includes(role))
        .map((item) =>
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
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
