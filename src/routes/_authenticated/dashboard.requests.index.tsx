import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DashHeader, fmtDate } from "@/components/dash/DashShell";
import { EmptyState, StatusPill } from "@/components/site/bits";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/dashboard/requests/")({ component: Requests });

function Requests() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["my-requests", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("service_requests").select("id,reference,service_name,status,next_action,created_at,assigned_professional_id").eq("customer_id", user!.id).order("created_at", { ascending: false })).data ?? [],
  });
  return (
    <>
      <DashHeader title="My Requests" action={<Button asChild variant="accent"><Link to="/request/$slug" params={{ slug: "choose" }}>New request</Link></Button>} />
      {isLoading ? <Skeleton className="h-40 rounded-xl" /> : !data?.length ? (
        <EmptyState title="No requests yet" body="Start by choosing a service." action={<Button asChild><Link to="/services">Browse services</Link></Button>} />
      ) : (
        <div className="card-surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="p-4">Request ID</th><th className="p-4">Service</th><th className="p-4">Professional</th><th className="p-4">Status</th><th className="p-4">Date</th><th className="p-4">Next action</th></tr>
            </thead>
            <tbody className="divide-y">
              {data.map((r) => (
                <tr key={r.id} className="hover:bg-muted/40">
                  <td className="p-4 font-mono"><Link to="/dashboard/requests/$id" params={{ id: r.id }} className="font-semibold text-accent hover:underline">{r.reference}</Link></td>
                  <td className="p-4">{r.service_name}</td>
                  <td className="p-4 text-muted-foreground">{r.assigned_professional_id ? "Assigned" : "Not yet assigned"}</td>
                  <td className="p-4"><StatusPill status={r.status} /></td>
                  <td className="p-4 text-muted-foreground">{fmtDate(r.created_at)}</td>
                  <td className="p-4 text-muted-foreground">{r.next_action ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
