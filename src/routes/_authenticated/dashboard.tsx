import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LayoutDashboard, ClipboardList, FolderLock, CalendarDays, LifeBuoy, Receipt, Heart, Settings, MessagesSquare, Search, ShieldCheck } from "lucide-react";
import { DashShell } from "@/components/dash/DashShell";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "My Dashboard — LegalSetu" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <DashShell title="My account" nav={[
      { to: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
      { to: "/dashboard/requests", label: "My Requests", icon: ClipboardList },
      { to: "/professionals", label: "Find & compare professionals", icon: Search },
      { to: "/dashboard/messages", label: "Messages", icon: MessagesSquare },
      { to: "/dashboard/documents", label: "My Documents", icon: FolderLock },
      { to: "/dashboard/appointments", label: "Appointments", icon: CalendarDays },
      { to: "/dashboard/support", label: "Support Tickets", icon: LifeBuoy },
      { to: "/dashboard/billing", label: "Billing", icon: Receipt },
      { to: "/dashboard/saved", label: "Saved Professionals", icon: Heart },
      { to: "/dashboard/consents", label: "My consents", icon: ShieldCheck },
      { to: "/dashboard/settings", label: "Settings", icon: Settings },
    ]}>
      <Outlet />
    </DashShell>
  ),
});
