import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DashHeader, fmtDateTime } from "@/components/dash/DashShell";
import { EmptyState, StatusPill } from "@/components/site/bits";
import { Button } from "@/components/ui/button";
import { RESTRICTION_DURATIONS, isRestrictionActive, reportReasonLabel } from "@/lib/reports";

export const Route = createFileRoute("/_authenticated/admin/trust")({ component: Trust });

function Trust() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-trust"],
    queryFn: async () => {
      const [a, r, rv, ap, rs] = await Promise.all([
        supabase.from("risk_alerts").select("*").order("created_at", { ascending: false }).limit(300),
        supabase.from("abuse_reports").select("*").order("created_at", { ascending: false }).limit(300),
        supabase.from("reviews").select("*").order("created_at", { ascending: false }).limit(300),
        supabase.from("appeals").select("*").order("created_at", { ascending: false }).limit(300),
        supabase.from("account_restrictions").select("*").order("created_at", { ascending: false }).limit(300),
      ]);
      return { alerts: a.data ?? [], reports: r.data ?? [], reviews: rv.data ?? [], appeals: ap.data ?? [], restrictions: rs.data ?? [] };
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-trust"] });
  const ask = (q: string) => { const n = window.prompt(q); return n && n.trim().length >= 5 ? n.trim().slice(0, 1000) : null; };
  const upd = async (table: "risk_alerts" | "abuse_reports" | "reviews" | "appeals", id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from(table).update(patch as never).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Saved"); refresh();
  };
  const now = () => new Date().toISOString();
  const restrict = async (uid: string, hours: number) => {
    const reason = ask(`Reason for a temporary restriction (${RESTRICTION_DURATIONS.find((d) => d.h === hours)?.label}); shown to the user`);
    if (!reason) return;
    const { error } = await supabase.rpc("admin_restrict_account", { _uid: uid, _hours: hours, _reason: reason });
    if (error) return toast.error(error.message);
    toast.success("Temporary restriction issued — it ends automatically"); refresh();
  };
  const lift = async (id: string) => {
    const reason = ask("Reason for lifting early");
    if (!reason) return;
    const { error } = await supabase.rpc("admin_lift_restriction", { _id: id, _reason: reason });
    if (error) return toast.error(error.message);
    toast.success("Restriction lifted"); refresh();
  };
  const Restrict = ({ uid }: { uid: string | null }) => isAdmin && uid ? (
    <select className="h-8 rounded-md border bg-background px-2 text-xs" value="" aria-label="Temporarily restrict account" onChange={(e) => e.target.value && restrict(uid, Number(e.target.value))}>
      <option value="">Restrict temporarily…</option>{RESTRICTION_DURATIONS.map((d) => <option key={d.h} value={d.h}>{d.label}</option>)}
    </select>) : null;

  return (
    <>
      <DashHeader title="Trust & safety" subtitle="Suspicious-activity alerts, abuse reports, review moderation and appeals. Every decision is written to the audit log. No system is fully fraud-proof — alerts need human review." />

      <h2 className="mb-2 font-semibold">Suspicious-activity alerts</h2>
      {(data?.alerts ?? []).length === 0 ? <div className="mb-6"><EmptyState title="No alerts" /></div> : (
        <div className="card-surface mb-6 divide-y text-sm">{data!.alerts.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center gap-3 p-3">
            <span className="flex-1">{a.kind.replace(/_/g, " ")} · user {a.user_id?.slice(0, 8)} · {JSON.stringify(a.details)}{a.review_note ? ` · ${a.review_note}` : ""}</span>
            <StatusPill status={a.status} /><span className="text-xs text-muted-foreground">{fmtDateTime(a.created_at)}</span><Restrict uid={a.user_id} />
            {a.status === "open" && <>
              <Button size="sm" variant="outline" onClick={() => { const n = ask("Resolution note"); if (n) upd("risk_alerts", a.id, { status: "resolved", review_note: n, reviewed_at: now() }); }}>Resolve</Button>
              <Button size="sm" variant="ghost" onClick={() => { const n = ask("Why dismiss?"); if (n) upd("risk_alerts", a.id, { status: "dismissed", review_note: n, reviewed_at: now() }); }}>Dismiss</Button>
            </>}
          </div>
        ))}</div>
      )}
      <p className="mb-6 text-xs text-muted-foreground">To suspend an account, use Customers or Professionals. Suspended users cannot message, send or accept contact requests.</p>

      <h2 className="mb-2 font-semibold">Abuse reports</h2>
      {(data?.reports ?? []).length === 0 ? <div className="mb-6"><EmptyState title="No reports" /></div> : (
        <div className="card-surface mb-6 divide-y text-sm">{data!.reports.map((r) => (
          <div key={r.id} className="grid gap-1 p-3">
            <div className="flex flex-wrap items-center gap-3"><span className="flex-1">Reporter {r.reporter_id.slice(0, 8)} → user {r.target_user_id.slice(0, 8)}{r.conversation_id ? ` · conversation ${r.conversation_id.slice(0, 8)} (readable for review)` : ""}</span><StatusPill status={r.status} /></div>
            <p><span className="font-medium">{reportReasonLabel(r.reason_code)}</span> · via {r.source.replace("_", " ")}{r.reason ? ` · ${r.reason}` : ""}</p>{r.review_note && <p className="text-xs text-muted-foreground">Decision: {r.review_note}</p>}
            {r.status === "open" && <div className="flex flex-wrap gap-2"><Restrict uid={r.target_user_id} />
              <Button size="sm" variant="outline" onClick={() => { const n = ask("Action taken"); if (n) upd("abuse_reports", r.id, { status: "actioned", review_note: n, reviewed_at: now() }); }}>Mark actioned</Button>
              <Button size="sm" variant="ghost" onClick={() => { const n = ask("Why dismiss?"); if (n) upd("abuse_reports", r.id, { status: "dismissed", review_note: n, reviewed_at: now() }); }}>Dismiss</Button>
            </div>}
          </div>
        ))}</div>
      )}

      <h2 className="mb-2 font-semibold">Temporary restrictions</h2>
      {(data?.restrictions ?? []).length === 0 ? <div className="mb-6"><EmptyState title="No restrictions issued" /></div> : (
        <div className="card-surface mb-6 divide-y text-sm">{data!.restrictions.map((r) => {
          const on = isRestrictionActive(r);
          return (
            <div key={r.id} className="flex flex-wrap items-center gap-3 p-3">
              <span className="flex-1">User {r.user_id.slice(0, 8)} · {fmtDateTime(r.starts_at)} → {fmtDateTime(r.ends_at)} · {r.reason} · issued by {r.issued_by.slice(0, 8)}{r.lift_reason ? ` · lifted: ${r.lift_reason}` : ""}</span>
              <StatusPill status={on ? "active" : r.lifted_at ? "lifted" : new Date(r.starts_at) > new Date() ? "scheduled" : "expired"} />
              {isAdmin && on && <Button size="sm" variant="ghost" onClick={() => lift(r.id)}>Lift early</Button>}
            </div>);
        })}</div>
      )}

      <h2 className="mb-2 font-semibold">Reviews</h2>
      {(data?.reviews ?? []).length === 0 ? <div className="mb-6"><EmptyState title="No reviews yet" /></div> : (
        <div className="card-surface mb-6 divide-y text-sm">{data!.reviews.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 p-3">
            <span className="flex-1">{"★".repeat(r.rating)} · pro {r.professional_id.slice(0, 8)} · {r.body ?? ""}{r.moderation_note ? ` · ${r.moderation_note}` : ""}</span><StatusPill status={r.status} />
            {r.status === "published"
              ? <Button size="sm" variant="outline" onClick={() => { const n = ask("Reason for hiding"); if (n) upd("reviews", r.id, { status: "hidden", moderation_note: n }); }}>Hide</Button>
              : <Button size="sm" variant="ghost" onClick={() => { const n = ask("Reason for restoring"); if (n) upd("reviews", r.id, { status: "published", moderation_note: n }); }}>Restore</Button>}
          </div>
        ))}</div>
      )}

      <h2 className="mb-2 font-semibold">Appeals</h2>
      {(data?.appeals ?? []).length === 0 ? <EmptyState title="No appeals" /> : (
        <div className="card-surface divide-y text-sm">{data!.appeals.map((a) => (
          <div key={a.id} className="grid gap-1 p-3">
            <div className="flex flex-wrap items-center gap-3"><span className="flex-1 font-medium">{a.subject} · user {a.user_id.slice(0, 8)}{a.restriction_id ? " · appeals a temporary restriction (upholding lifts it)" : ""}</span><StatusPill status={a.status} /></div>
            <p>{a.body}</p>{a.decision_note && <p className="text-xs text-muted-foreground">Decision: {a.decision_note}</p>}
            {isAdmin && ["submitted", "under_review"].includes(a.status) && <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { const n = ask("Decision note"); if (n) upd("appeals", a.id, { status: "upheld", decision_note: n }); }}>Uphold appeal</Button>
              <Button size="sm" variant="ghost" onClick={() => { const n = ask("Decision note"); if (n) upd("appeals", a.id, { status: "rejected", decision_note: n }); }}>Reject appeal</Button>
            </div>}
          </div>
        ))}</div>
      )}
    </>
  );
}
