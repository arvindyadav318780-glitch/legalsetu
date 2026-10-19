import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DashHeader, fmtDate } from "@/components/dash/DashShell";
import { EmptyState, StatusPill } from "@/components/site/bits";

export const Route = createFileRoute("/_authenticated/pro/requests")({ component: ProRequests });

function ProRequests() {
  const { user } = useAuth();
  const { data = [] } = useQuery({
    queryKey: ["pro-requests", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("service_requests").select("id,reference,service_name,status,city,state,created_at,contact_name").eq("assigned_professional_id", user!.id).order("created_at", { ascending: false })).data ?? [],
  });
  return (
    <>
      <DashHeader title="Engagements" subtitle="Requests assigned to you. Open one to update status, message the client and view linked documents." />
      {data.length === 0 ? <EmptyState title="No assigned engagements" body="When our team assigns a request to you, it will appear here." /> : (
        <div className="card-surface divide-y">{data.map((r) => (
          <Link key={r.id} to="/dashboard/requests/$id" params={{ id: r.id }} className="flex items-center gap-3 p-4 hover:bg-muted/40">
            <div className="min-w-0 flex-1"><p className="font-medium">{r.service_name} · {r.contact_name}</p><p className="text-xs text-muted-foreground">{r.reference} · {[r.city, r.state].filter(Boolean).join(", ")} · {fmtDate(r.created_at)}</p></div>
            <StatusPill status={r.status} />
          </Link>
        ))}</div>
      )}
    </>
  );
}
