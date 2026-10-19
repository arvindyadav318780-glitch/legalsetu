import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DashHeader, fmtDateTime } from "@/components/dash/DashShell";
import { EmptyState } from "@/components/site/bits";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard/consents")({
  head: () => ({ meta: [{ title: "My consents — LegalSetu" }, { name: "robots", content: "noindex" }] }),
  component: Consents,
});

const PURPOSE: Record<string, string> = { share_contact_with_assigned_professional: "Share my email and phone with the verified professional assigned to this request" };

function Consents() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["consents", user?.id], enabled: !!user,
    queryFn: async () => {
      const [r, c] = await Promise.all([
        supabase.from("service_requests").select("id,reference,service_name,contact_consent_at,contact_consent_withdrawn_at,status").eq("customer_id", user!.id).order("created_at", { ascending: false }),
        supabase.from("consents").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(200),
      ]);
      return { reqs: r.data ?? [], events: c.data ?? [] };
    },
  });
  const ref = (id: string | null) => data?.reqs.find((r) => r.id === id)?.reference ?? "—";
  const toggle = async (id: string, grant: boolean) => {
    if (!grant && !window.confirm("Withdraw consent? The assigned professional will no longer see your email and phone for this request. You can still message them inside LegalSetu.")) return;
    const { error } = await supabase.rpc("set_contact_consent", { _rid: id, _grant: grant });
    if (error) return toast.error("Couldn't update consent");
    toast.success(grant ? "Consent given" : "Consent withdrawn"); qc.invalidateQueries({ queryKey: ["consents"] });
  };
  return (
    <>
      <DashHeader title="My consents" subtitle="See what you agreed to share, and withdraw it at any time. Withdrawal takes effect immediately." />
      {(data?.reqs ?? []).length === 0 ? <EmptyState title="No requests yet" /> : (
        <div className="card-surface mb-6 divide-y text-sm">{data!.reqs.map((r) => {
          const active = !!r.contact_consent_at && !r.contact_consent_withdrawn_at;
          return (
            <div key={r.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <Link to="/dashboard/requests/$id" params={{ id: r.id }} className="font-medium hover:underline">{r.reference} · {r.service_name}</Link>
                <p className="text-xs text-muted-foreground">{PURPOSE.share_contact_with_assigned_professional}</p>
                <p className="text-xs">{active ? `Given ${fmtDateTime(r.contact_consent_at!)}` : r.contact_consent_withdrawn_at ? `Withdrawn ${fmtDateTime(r.contact_consent_withdrawn_at)}` : "Not given"}</p>
              </div>
              {active ? <Button size="sm" variant="outline" onClick={() => toggle(r.id, false)}>Withdraw</Button> : <Button size="sm" variant="outline" onClick={() => toggle(r.id, true)}>Give consent</Button>}
            </div>
          );
        })}</div>
      )}
      <h2 className="mb-2 font-semibold">Consent history</h2>
      {(data?.events ?? []).length === 0 ? <EmptyState title="No consent records" /> : (
        <div className="card-surface divide-y text-sm">{data!.events.map((e) => (
          <div key={e.id} className="flex flex-wrap gap-3 p-3"><span className="flex-1 capitalize">{e.action} · {ref(e.request_id)}<span className="block text-xs normal-case text-muted-foreground">{PURPOSE[e.purpose] ?? e.purpose} · version {e.version}</span></span><span className="text-xs text-muted-foreground">{fmtDateTime(e.created_at)}</span></div>
        ))}</div>
      )}
    </>
  );
}
