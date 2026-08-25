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
  "/payroll": "Payroll",
  "/agent-log": "Agent Activity Log",
  "/tier-approval": "Tier Approvals",
  "/settings": "Settings",
  "/finance-manager": "Finance Manager Dashboard",
  "/loan-officer": "Loan Officer Dashboard",
  "/loan-officer/application": "Loan Application",
  "/loan-officer/collection": "Collection",
}

function getPageTitle(pathname) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  if (pathname.startsWith("/loan-officer/alerts/")) return "EWS Alert"
  return "MicroFlow"
}

export default function DashboardLayout() {
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
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
