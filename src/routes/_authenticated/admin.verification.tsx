import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DashHeader, fmtDateTime } from "@/components/dash/DashShell";
import { EmptyState, StatusPill } from "@/components/site/bits";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VERIFICATION_STAGES, verificationLabel } from "@/lib/verification";
import { CHECK_OUTCOMES, checkMethodsFor } from "@/lib/reports";
import { Input } from "@/components/ui/input";
import { selectCls } from "@/components/site/LocationSelect";

export const Route = createFileRoute("/_authenticated/admin/verification")({ component: Verification });

function Verification() {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<string>("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const { data } = useQuery({
    queryKey: ["admin-pros"],
    queryFn: async () => {
      const [p, h, c] = await Promise.all([
        supabase.from("professional_profiles").select("*").neq("verification_status", "not_submitted").order("updated_at", { ascending: false }),
        supabase.from("verification_reviews").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("credential_checks").select("*").order("created_at", { ascending: false }).limit(500),
      ]);
      return { pros: p.data ?? [], history: h.data ?? [], checks: c.data ?? [] };
    },
  });
  const decide = async (uid: string, status: string) => {
    const note = (notes[uid] ?? "").trim();
    if ((status === "rejected" || status === "more_info_required") && note.length < 5) return toast.error("Add a note explaining the decision (at least 5 characters)");
    const { error } = await supabase.from("professional_profiles").update({ verification_status: status, verification_note: note || null }).eq("user_id", uid);
    if (error) return toast.error(error.message);
    toast.success(`Marked as ${verificationLabel(status)}`); setNotes({ ...notes, [uid]: "" });
    qc.invalidateQueries({ queryKey: ["admin-pros"] });
  };
  const list = (data?.pros ?? []).filter((p) => p.verification_status === tab);
  return (
    <>
      <DashHeader title="Verification queue" subtitle="Check submitted registration details against the relevant professional body. Admins can change the status only — credentials are entered by the professional." />
      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList className="flex-wrap">{VERIFICATION_STAGES.map((s) => (
          <TabsTrigger key={s} value={s}>{verificationLabel(s)} ({(data?.pros ?? []).filter((p) => p.verification_status === s).length})</TabsTrigger>
        ))}</TabsList>
      </Tabs>
      {list.length === 0 ? <EmptyState title={`Nothing in "${verificationLabel(tab)}"`} /> : (
        <div className="grid gap-4">{list.map((p) => (
          <div key={p.user_id} className="card-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="font-semibold">{p.display_name}</p><p className="text-sm text-muted-foreground">{p.category} · {[p.city, p.state].filter(Boolean).join(", ") || "—"}</p></div>
              <StatusPill status={p.verification_status} />
            </div>
            <dl className="mt-3 grid gap-2 text-sm md:grid-cols-3">
              <div><dt className="text-xs text-muted-foreground">Qualifications</dt><dd>{p.qualifications || "—"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Registration / membership</dt><dd>{p.registration_details || "—"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Experience</dt><dd>{p.years_experience != null ? `${p.years_experience} years` : "—"}</dd></div>
            </dl>
            {p.verification_note && <p className="mt-3 rounded-lg bg-muted p-3 text-sm"><span className="font-medium">Last note:</span> {p.verification_note}</p>}
            {isAdmin && p.user_id !== user?.id && (
              <div className="mt-4 grid gap-2">
                <Textarea rows={2} placeholder="Reviewer note (required for Reject and More Information Required)" value={notes[p.user_id] ?? ""} maxLength={500} onChange={(e) => setNotes({ ...notes, [p.user_id]: e.target.value })} aria-label="Reviewer note" />
                <div className="flex flex-wrap gap-2">
                  {p.verification_status !== "under_review" && <Button size="sm" variant="outline" onClick={() => decide(p.user_id, "under_review")}>Mark under review</Button>}
                  {p.verification_status !== "approved" && <Button size="sm" variant="accent" onClick={() => decide(p.user_id, "approved")}>Approve</Button>}
                  <Button size="sm" variant="outline" onClick={() => decide(p.user_id, "more_info_required")}>Request more information</Button>
                  {p.verification_status !== "rejected" && <Button size="sm" variant="destructive" onClick={() => decide(p.user_id, "rejected")}>Reject</Button>}
                </div>
              </div>
            )}
            <CredentialChecks pro={p} checks={(data?.checks ?? []).filter((c) => c.professional_id === p.user_id)} canRecord={!!isAdmin && p.user_id !== user?.id} onSaved={() => qc.invalidateQueries({ queryKey: ["admin-pros"] })} />
            {isAdmin && p.user_id === user?.id && <p className="mt-3 text-xs text-muted-foreground">You can't review your own profile.</p>}
            <details className="mt-3 text-sm"><summary className="cursor-pointer text-accent">History</summary>
              <ol className="mt-2 space-y-1">{(data?.history ?? []).filter((h) => h.professional_id === p.user_id).map((h) => (
                <li key={h.id} className="text-xs text-muted-foreground">{fmtDateTime(h.created_at)} · {verificationLabel(h.from_status ?? "")} → <strong>{verificationLabel(h.to_status)}</strong>{h.note ? ` · ${h.note}` : ""}</li>
              ))}</ol>
            </details>
          </div>
        ))}</div>
      )}
    </>
  );
}

type Check = { id: string; method: string; checked_on: string; reference: string; outcome: string; notes: string | null; reviewer_id: string; created_at: string; profession: string };
function CredentialChecks({ pro, checks, canRecord, onSaved }: { pro: { user_id: string; category: string }; checks: Check[]; canRecord: boolean; onSaved: () => void }) {
  const methods = checkMethodsFor(pro.category);
  const [f, setF] = useState({ method: "", checked_on: new Date().toISOString().slice(0, 10), reference: "", outcome: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const label = (v: string) => methods.find((m) => m.v === v)?.label ?? v.replace(/_/g, " ");
  const save = async () => {
    if (!f.method || !f.outcome || f.reference.trim().length < 3) return toast.error("Choose a method and outcome, and enter the reference checked");
    setBusy(true);
    const { error } = await supabase.rpc("record_credential_check", { _pro: pro.user_id, _method: f.method, _checked_on: f.checked_on, _reference: f.reference, _outcome: f.outcome, _notes: f.notes || undefined });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Credential check recorded"); setF({ ...f, method: "", reference: "", outcome: "", notes: "" }); onSaved();
  };
  return (
    <div className="mt-4 rounded-lg border p-3 text-sm">
      <p className="font-medium">Credential check ({pro.category === "Advocate" ? "Bar Council" : pro.category === "Chartered Accountant" ? "ICAI" : "documented"})</p>
      <p className="text-xs text-muted-foreground">Approval requires a recorded check with outcome "Confirmed" made after the latest submission. Record only checks you actually performed — this is an admin record, not an official confirmation by ICAI or a Bar Council.</p>
      {checks.length > 0 && <ul className="mt-2 space-y-1 text-xs">{checks.map((c) => <li key={c.id}>{c.checked_on} · {label(c.method)} · ref {c.reference} · <strong>{c.outcome.replace("_", " ")}</strong> · reviewer {c.reviewer_id.slice(0, 8)}{c.notes ? ` · ${c.notes}` : ""}</li>)}</ul>}
      {canRecord && (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <select className={selectCls} value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} aria-label="Verification method"><option value="">Method…</option>{methods.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}</select>
          <select className={selectCls} value={f.outcome} onChange={(e) => setF({ ...f, outcome: e.target.value })} aria-label="Outcome"><option value="">Outcome…</option>{CHECK_OUTCOMES.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}</select>
          <Input type="date" value={f.checked_on} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setF({ ...f, checked_on: e.target.value })} aria-label="Date checked" />
          <Input value={f.reference} maxLength={200} placeholder="Reference checked (membership / enrolment no., document)" onChange={(e) => setF({ ...f, reference: e.target.value })} aria-label="Reference checked" />
          <Textarea className="md:col-span-2" rows={2} maxLength={1000} value={f.notes} placeholder="Notes (optional)" onChange={(e) => setF({ ...f, notes: e.target.value })} aria-label="Check notes" />
          <Button size="sm" variant="outline" className="w-fit" disabled={busy} onClick={save}>Record credential check</Button>
        </div>
      )}
    </div>
  );
}
