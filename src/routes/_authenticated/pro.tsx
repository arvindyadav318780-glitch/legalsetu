import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { LayoutDashboard, UserCog, ClipboardList, CalendarDays, CreditCard, MessagesSquare, Coins, Store, Settings } from "lucide-react";
import { DashShell } from "@/components/dash/DashShell";
import { useAuth } from "@/hooks/use-auth";
import { EmptyState } from "@/components/site/bits";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/pro")({
  head: () => ({ meta: [{ title: "Professional Workspace — LegalSetu" }, { name: "robots", content: "noindex" }] }),
  component: ProLayout,
});

function ProLayout() {
  const { isPro, isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isPro && !isAdmin) return (
    <div className="container-page py-16"><EmptyState title="Professional workspace" body="This area is for registered professional accounts." action={<Button asChild><Link to="/dashboard">Go to my dashboard</Link></Button>} /></div>
  );
  return (
    <DashShell title="Professional workspace" nav={[
      { to: "/pro", label: "Overview", icon: LayoutDashboard, exact: true },
      { to: "/pro/profile", label: "Profile & Verification", icon: UserCog },
      { to: "/pro/requests", label: "Engagements", icon: ClipboardList },
      { to: "/pro/marketplace", label: "Marketplace overview", icon: Store },
      { to: "/pro/messages", label: "Client contacts", icon: MessagesSquare },
      { to: "/pro/credits", label: "Contact credits", icon: Coins },
      { to: "/pro/appointments", label: "Appointments", icon: CalendarDays },
      { to: "/pro/subscription", label: "Subscription", icon: CreditCard },
      { to: "/dashboard/settings", label: "Account settings", icon: Settings },
    ]}>
      <Outlet />
    </DashShell>
  );
}
