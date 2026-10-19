import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, UserRound, Briefcase, BadgeCheck, ClipboardList, CalendarDays, LifeBuoy, ShieldAlert,
  Layers, CreditCard, Megaphone, Newspaper, ScrollText, UserCog, Settings, Coins, Wallet, ShieldCheck, Archive, Activity,
} from "lucide-react";
import { DashShell } from "@/components/dash/DashShell";
import { EmptyState } from "@/components/site/bits";
import { Button } from "@/components/ui/button";
import { getStaffAccess } from "@/lib/admin.functions";
import { useEffect } from "react";
import { logSecurityEvent } from "@/lib/security-events";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — LegalSetu" }, { name: "robots", content: "noindex" }] }),
  // Verified on the server for every visit; database rules still guard each read and write.
  beforeLoad: async () => {
    try {
      return { access: await getStaffAccess() };
    } catch {
      return { access: { isAdmin: false, isStaff: false } };
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { access } = Route.useRouteContext();
  useEffect(() => { if (!access.isStaff) void logSecurityEvent("permission_denied", "Admin console", "Non-staff account opened the admin area"); }, [access.isStaff]);
  if (!access.isStaff) return <div className="container-page py-16"><EmptyState title="Access restricted" body="This area is only for authorised LegalSetu staff." action={<Button asChild><Link to="/dashboard">My dashboard</Link></Button>} /></div>;
  return (
    <DashShell title="Admin console" nav={[
      { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
      { to: "/admin/customers", label: "Customers", icon: UserRound },
      { to: "/admin/professionals", label: "Professionals", icon: Briefcase },
      { to: "/admin/verification", label: "Verification queue", icon: BadgeCheck },
      { to: "/admin/requests", label: "Requests", icon: ClipboardList },
      { to: "/admin/appointments", label: "Appointments", icon: CalendarDays },
      { to: "/admin/tickets", label: "Support tickets", icon: LifeBuoy },
      { to: "/admin/complaints", label: "Complaints & disputes", icon: ShieldAlert },
      { to: "/admin/catalog", label: "Services & fees", icon: Layers },
      { to: "/admin/marketplace", label: "Contact credits", icon: Coins },
      { to: "/admin/trust", label: "Trust & safety", icon: ShieldCheck },
      ...(access.isAdmin ? [{ to: "/admin/security", label: "Security & health", icon: Activity }] : []),
      { to: "/admin/retention", label: "Backups & retention", icon: Archive },
      ...(access.isAdmin ? [{ to: "/admin/finance", label: "Finance (read-only)", icon: Wallet }] : []),
      { to: "/admin/payments", label: "Payments & refunds", icon: CreditCard },
      { to: "/admin/notifications", label: "Notifications", icon: Megaphone },
      { to: "/admin/content", label: "Content", icon: Newspaper },
      { to: "/admin/audit", label: "Audit log", icon: ScrollText },
      { to: "/admin/users", label: "Roles", icon: Users },
      { to: "/admin/profile", label: "My admin profile", icon: UserCog },
      { to: "/admin/settings", label: "Platform settings", icon: Settings },
    ]}>
      <Outlet />
    </DashShell>
  );
}
