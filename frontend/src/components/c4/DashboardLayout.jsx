import { Outlet, useLocation } from "react-router-dom"

import { AppSidebar } from "@/components/app-sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

const PAGE_TITLES = {
  "/dashboard": "Dashboard",
  "/borrowers": "Borrower Management",
  "/hr": "Human Resources",
  "/payroll": "Payroll",
  "/agent-log": "Agent Activity Log",
  "/tier-approval": "Tier Approvals",
  "/settings": "Settings",
  "/finance-manager": "Finance Manager Dashboard",
  "/alerts": "Mission Drift Alerts",
  "/pl-report": "P&L Report",
  "/social-performance": "Social Performance",
  "/onboarding": "Setup & Onboarding",
  "/loan-officer": "Loan Officer Dashboard",
  "/loan-officer/borrowers": "Borrower Management",
  "/loan-officer/applications/new": "New Application",
  "/loan-officer/disbursement": "Disbursement",
  "/loan-officer/collection": "Collection",
  "/loan-officer/overdue": "Overdue Queue",
  "/loan-officer/alerts": "EWS Alerts",
  "/loan-officer/branch": "Branch Portfolio",
  "/loan-officer/risk-report": "Risk Report",
  "/loan-officer/trust-profile": "My Trust Profile",
  "/research/ab-experiment": "A/B Experiment",
}

function getPageTitle(pathname) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  if (pathname.startsWith("/loan-officer/applications/new/")) return "Application Profile"
  if (pathname.startsWith("/loan-officer/applications/") && pathname.endsWith("/edit")) {
    return "Application Profile"
  }
  if (pathname.startsWith("/loan-officer/applications/")) return "Application Profile"
  if (pathname.startsWith("/loan-officer/alerts/")) return "EWS Alert"
  if (pathname.startsWith("/loan-officer/loans/")) return "Loan Detail"
  if (pathname.startsWith("/loan-officer/groups/")) return "Group Lending"
  return "MicroFlow"
}

export default function DashboardLayout({ children }) {
  const location = useLocation()
  const pageTitle = getPageTitle(location.pathname)

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>{pageTitle}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        <div className="flex flex-1 flex-col overflow-auto bg-background text-foreground">
          {children || <Outlet />}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
