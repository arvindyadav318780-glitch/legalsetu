import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashHeader, fmtDateTime } from "@/components/dash/DashShell";
import { EmptyState, StatusPill } from "@/components/site/bits";
import { selectCls } from "@/components/site/LocationSelect";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TicketThread } from "@/components/dash/TicketThread";

export const Route = createFileRoute("/_authenticated/admin/complaints")({ component: Complaints });

function Complaints() {
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const { data } = useQuery({
    queryKey: ["admin-complaints"],
    queryFn: async () => {
      const [t, d] = await Promise.all([
        supabase.from("support_tickets").select("*").in("kind", ["complaint", "profile_report"]).order("created_at", { ascending: false }),
        supabase.from("service_requests").select("id,reference,service_name,contact_name,updated_at").eq("status", "disputed").order("updated_at", { ascending: false }),
      ]);
      return { tickets: t.data ?? [], disputes: d.data ?? [] };
    },
  });
  const save = async (id: string, status: string) => {
    const note = (notes[id] ?? "").trim();
    if (["resolved", "closed"].includes(status) && note.length < 5) return toast.error("Record the outcome before resolving (at least 5 characters)");
    const { error } = await supabase.from("support_tickets").update({ status, ...(note ? { resolution_note: note.slice(0, 2000) } : {}) }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin-complaints"] });
  };
  return (
    <>
      <DashHeader title="Complaints & disputes" subtitle="Complaints, profile reports and disputed requests. Record an outcome before resolving." />
      <h2 className="mb-3 font-semibold">Disputed requests</h2>
      {!(data?.disputes.length) ? <p className="mb-8 text-sm text-muted-foreground">No disputed requests.</p> : (
        <div className="card-surface mb-8 divide-y">{data.disputes.map((r) => (
          <Link key={r.id} to="/dashboard/requests/$id" params={{ id: r.id }} className="flex items-center justify-between gap-3 p-4 hover:bg-muted/40"><span className="font-medium">{r.reference} · {r.service_name} · {r.contact_name}</span><StatusPill status="disputed" /></Link>
        ))}</div>
      )}
      <h2 className="mb-3 font-semibold">Complaints & reports</h2>
      {!(data?.tickets.length) ? <EmptyState title="No complaints" /> : (
        <div className="card-surface divide-y">{data.tickets.map((t) => (
          <div key={t.id} className="p-4">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1"><p className="font-medium">{t.subject}</p><p className="whitespace-pre-wrap text-sm text-muted-foreground">{t.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t.kind.replace("_", " ")} · {fmtDateTime(t.created_at)}{t.request_id && <> · <Link to="/dashboard/requests/$id" params={{ id: t.request_id }} className="text-accent underline">linked request</Link></>}</p>
                {t.resolution_note && <p className="mt-2 rounded-lg bg-muted p-2 text-sm"><span className="font-medium">Outcome:</span> {t.resolution_note}</p>}</div>
              <StatusPill status={t.status} />
              <Button size="sm" variant="outline" onClick={() => setOpen(open === t.id ? null : t.id)}>{open === t.id ? "Hide" : "Handle"}</Button>
            </div>
            {open === t.id && (
              <div className="mt-3 grid gap-2">
                <Textarea rows={2} placeholder="Outcome / resolution note" value={notes[t.id] ?? ""} onChange={(e) => setNotes({ ...notes, [t.id]: e.target.value })} aria-label="Outcome note" />
                <div className="flex flex-wrap gap-2">
                  <select aria-label="Complaint status" className={selectCls + " w-40"} defaultValue={t.status} id={`st-${t.id}`}>{["open", "in_progress", "resolved", "closed"].map((s) => <option key={s}>{s}</option>)}</select>
                  <Button size="sm" onClick={() => save(t.id, (document.getElementById(`st-${t.id}`) as HTMLSelectElement).value)}>Save</Button>
                </div>
                <TicketThread ticketId={t.id} />
              </div>
            )}
          </div>
        ))}</div>
      )}
    </>
  );
}
