import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashHeader, fmtDateTime } from "@/components/dash/DashShell";
import { EmptyState, StatusPill } from "@/components/site/bits";
import { selectCls } from "@/components/site/LocationSelect";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/appointments")({ component: AdminAppts });

const STATUSES = ["requested", "confirmed", "declined", "completed", "cancelled"];

function AdminAppts() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const { data } = useQuery({
    queryKey: ["admin-appts"],
    queryFn: async () => {
      const [a, p] = await Promise.all([
        supabase.from("appointments").select("*").order("preferred_at", { ascending: false }).limit(300),
        supabase.from("professional_profiles").select("user_id,display_name,category,suspended").eq("verification_status", "approved"),
      ]);
      return { appts: a.data ?? [], pros: (p.data ?? []).filter((x) => !x.suspended) };
    },
  });
  const update = async (id: string, patch: any) => {
    const { error } = await supabase.from("appointments").update(patch as never).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    qc.invalidateQueries({ queryKey: ["admin-appts"] });
  };
  const appts = (data?.appts ?? []).filter((a) => !status || a.status === status);
  return (
    <>
      <DashHeader title="Appointment management" subtitle="Assign or reassign appointment requests to a verified professional, or cancel them." action={
        <select aria-label="Filter by status" className={selectCls + " w-44"} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
      } />
      {appts.length === 0 ? <EmptyState title="No appointment requests" /> : (
        <div className="card-surface divide-y">{appts.map((a) => {
          const open = ["requested", "confirmed"].includes(a.status);
          return (
            <div key={a.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1"><p className="font-medium">{a.topic}</p><p className="text-xs text-muted-foreground">{fmtDateTime(a.preferred_at)} · {a.mode}</p></div>
              <StatusPill status={a.status} />
              <select aria-label="Assigned professional" className={selectCls + " w-60"} value={a.professional_id ?? ""} disabled={!open} onChange={(e) => update(a.id, { professional_id: e.target.value || null })}>
                <option value="">Unassigned</option>
                {(data?.pros ?? []).map((p) => <option key={p.user_id} value={p.user_id}>{p.display_name} · {p.category}</option>)}
              </select>
              {open && <Button size="sm" variant="outline" onClick={() => { if (confirm("Cancel this appointment?")) update(a.id, { status: "cancelled" }); }}>Cancel</Button>}
            </div>
          );
        })}</div>
      )}
    </>
  );
}
