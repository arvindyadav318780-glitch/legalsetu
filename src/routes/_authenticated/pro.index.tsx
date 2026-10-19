import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Inbox, Briefcase, CalendarDays, FileWarning } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DashHeader, Stat } from "@/components/dash/DashShell";
import { StatusPill } from "@/components/site/bits";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/pro/")({ component: ProOverview });

function ProOverview() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["pro-overview", user?.id], enabled: !!user,
    queryFn: async () => {
      const [r, a, p] = await Promise.all([
        supabase.from("service_requests").select("id,status").eq("assigned_professional_id", user!.id),
        supabase.from("appointments").select("id,status").eq("professional_id", user!.id).in("status", ["requested", "confirmed"]),
        supabase.from("professional_profiles").select("verification_status,is_listed").eq("user_id", user!.id).maybeSingle(),
      ]);
      return { reqs: r.data ?? [], appts: a.data ?? [], profile: p.data };
    },
  });
  const reqs = data?.reqs ?? [];
  return (
    <>
      <DashHeader title="Professional workspace" subtitle="Only engagements assigned to you are visible here." />
      <div className="card-surface mb-6 flex flex-wrap items-center justify-between gap-3 p-5">
        <div><p className="text-sm text-muted-foreground">Account status</p>
          <div className="mt-1 flex items-center gap-2"><StatusPill status={data?.profile?.verification_status ?? "not_submitted"} />{data?.profile?.is_listed && <span className="text-xs text-muted-foreground">Listed in directory</span>}</div></div>
        <Button asChild variant="outline"><Link to="/pro/profile">{data?.profile ? "Edit profile" : "Create profile"}</Link></Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Awaiting your acceptance" value={reqs.filter((r) => r.status === "professional_assigned").length} icon={Inbox} />
        <Stat label="Active engagements" value={reqs.filter((r) => r.status === "in_progress").length} icon={Briefcase} />
        <Stat label="Upcoming appointments" value={data?.appts.length ?? 0} icon={CalendarDays} />
        <Stat label="Pending client actions" value={reqs.filter((r) => r.status === "customer_action_required").length} icon={FileWarning} />
      </div>
      <p className="mt-6 rounded-lg bg-muted p-4 text-xs text-muted-foreground">You decide independently whether to accept an engagement and set your own fees. LegalSetu takes no percentage of your fees; the proposed ₹99 per new unique client connection is not collected until legal review. Keep all client information confidential.</p>
    </>
  );
}
