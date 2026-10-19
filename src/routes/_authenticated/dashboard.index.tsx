import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, AlertCircle, CalendarDays, Bell, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DashHeader, Stat, fmtDate, fmtDateTime } from "@/components/dash/DashShell";
import { EmptyState, StatusPill } from "@/components/site/bits";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard/")({ component: Overview });

function Overview() {
  const { user, isPro, isAdmin } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["overview", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [r, a, n] = await Promise.all([
        supabase.from("service_requests").select("id,reference,service_name,status,next_action,created_at").eq("customer_id", user!.id).order("created_at", { ascending: false }),
        supabase.from("appointments").select("id,topic,preferred_at,status").eq("customer_id", user!.id).gte("preferred_at", new Date().toISOString()).order("preferred_at"),
        supabase.from("notifications").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(8),
      ]);
      return { requests: r.data ?? [], appts: a.data ?? [], notifs: n.data ?? [] };
    },
  });
  const reqs = data?.requests ?? [];
  const active = reqs.filter((r) => !["completed", "cancelled"].includes(r.status));
  const pending = reqs.filter((r) => r.status === "customer_action_required");
  const name = (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0];

  const markRead = async () => {
    await supabase.from("notifications").update({ read: true }).eq("user_id", user!.id).eq("read", false);
    qc.invalidateQueries({ queryKey: ["overview"] });
  };

  return (
    <>
      <DashHeader title={`Welcome${name ? ", " + name : ""}`} subtitle="Here's what's happening with your requests."
        action={<Button asChild variant="accent"><Link to="/request/$slug" params={{ slug: "choose" }}>New request</Link></Button>} />
      {(isPro || isAdmin) && (
        <div className="mb-6 flex flex-wrap gap-2 rounded-xl border bg-teal-soft p-4 text-sm">
          <span className="font-medium">You also have a workspace:</span>
          {isPro && <Link to="/pro" className="font-semibold text-accent underline">Professional workspace</Link>}
          {isAdmin && <Link to="/admin" className="font-semibold text-accent underline">Admin console</Link>}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Active requests" value={active.length} icon={ClipboardList} />
        <Stat label="Pending actions" value={pending.length} icon={AlertCircle} />
        <Stat label="Upcoming appointments" value={data?.appts.length ?? 0} icon={CalendarDays} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section>
          <h2 className="mb-3 font-semibold">Recent requests</h2>
          {reqs.length === 0 ? (
            <EmptyState title="No requests yet" body="When you request a service, it will appear here with its full status history." action={<Button asChild variant="accent"><Link to="/services">Explore Services</Link></Button>} />
          ) : (
            <div className="card-surface divide-y">
              {reqs.slice(0, 5).map((r) => (
                <Link key={r.id} to="/dashboard/requests/$id" params={{ id: r.id }} className="flex items-center justify-between gap-3 p-4 hover:bg-muted/50">
                  <div className="min-w-0"><p className="truncate font-medium">{r.service_name}</p><p className="text-xs text-muted-foreground">{r.reference} · {fmtDate(r.created_at)}{r.next_action ? ` · Next: ${r.next_action}` : ""}</p></div>
                  <StatusPill status={r.status} />
                </Link>
              ))}
            </div>
          )}
        </section>
        <section>
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Notifications</h2>{data?.notifs.some((n) => !n.read) && <button onClick={markRead} className="text-xs text-accent">Mark all read</button>}</div>
          <div className="card-surface divide-y">
            {(data?.notifs ?? []).length === 0 && <p className="p-5 text-sm text-muted-foreground">No notifications yet.</p>}
            {data?.notifs.map((n) => (
              <div key={n.id} className="flex gap-3 p-4">
                <Bell className={"mt-0.5 h-4 w-4 shrink-0 " + (n.read ? "text-muted-foreground" : "text-accent")} />
                <div className="min-w-0 flex-1"><p className="text-sm font-medium">{n.title}</p><p className="text-xs text-muted-foreground">{n.body} · {fmtDateTime(n.created_at)}</p></div>
                {n.link && <a href={n.link} aria-label="Open"><ArrowRight className="h-4 w-4 text-muted-foreground" /></a>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
