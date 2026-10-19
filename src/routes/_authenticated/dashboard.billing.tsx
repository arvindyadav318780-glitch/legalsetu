import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DashHeader, fmtDate } from "@/components/dash/DashShell";
import { EmptyState, StatusPill } from "@/components/site/bits";
import { inr } from "@/lib/fees";

export const Route = createFileRoute("/_authenticated/dashboard/billing")({ component: Billing });

function Billing() {
  const { user } = useAuth();
  const { data = [] } = useQuery({
    queryKey: ["invoices", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("invoices").select("*").eq("user_id", user!.id).order("created_at", { ascending: false })).data ?? [],
  });
  const pays = useQuery({
    queryKey: ["my-payments", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("payments").select("id,description,total_paise,status,invoice_number,created_at,paid_at").eq("customer_id", user!.id).order("created_at", { ascending: false })).data ?? [],
  });
  return (
    <>
      <DashHeader title="Billing Records" />
      <div className="mb-6 rounded-xl border border-warning/40 bg-warning-soft p-4 text-sm text-warning">
        <strong>Payments are in test mode.</strong> No online payments are processed yet. Platform fees and professional fees will always appear as separate line items.
      </div>
      <div className="mb-6 card-surface p-5">
        <p className="text-sm text-muted-foreground">Current plan</p>
        <p className="text-xl font-bold">Free Account</p>
      </div>
      <h2 className="mb-3 font-semibold">Payment history <span className="ml-1 rounded-full border border-warning/50 bg-warning/10 px-2 py-0.5 text-[11px] font-bold uppercase text-warning">Test mode</span></h2>
      {(pays.data ?? []).length === 0 ? <div className="mb-6"><EmptyState title="No payment requests yet" body="When your professional or our team raises a payment for a request, it will appear here." /></div> : (
        <div className="card-surface mb-6 divide-y">{(pays.data ?? []).map((p) => (
          <Link key={p.id} to="/dashboard/payments/$id" params={{ id: p.id }} className="flex flex-wrap items-center gap-3 p-4 hover:bg-muted/40">
            <div className="min-w-0 flex-1"><p className="font-medium">{p.description}</p><p className="text-xs text-muted-foreground">{p.invoice_number ?? "No invoice yet"} · {fmtDate(p.paid_at ?? p.created_at)}</p></div>
            <p className="font-semibold">{inr(p.total_paise)}</p>
            <StatusPill status={p.status} />
          </Link>
        ))}</div>
      )}
      {data.length > 0 && <h2 className="mb-3 font-semibold">Earlier records</h2>}
      {data.length === 0 ? null : (
        <div className="card-surface divide-y">{data.map((i) => (
          <div key={i.id} className="flex items-center gap-3 p-4">
            <div className="flex-1"><p className="font-medium">{i.description}</p><p className="text-xs text-muted-foreground">{fmtDate(i.created_at)}</p></div>
            <p className="font-semibold">₹{(i.amount_paise / 100).toLocaleString("en-IN")}</p>
            <StatusPill status={i.status} />
          </div>
        ))}</div>
      )}
    </>
  );
}
