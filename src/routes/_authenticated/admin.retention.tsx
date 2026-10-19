import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DashHeader, fmtDateTime } from "@/components/dash/DashShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/admin/retention")({ component: Retention });

function Retention() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-retention"],
    queryFn: async () => {
      const [s, p] = await Promise.all([supabase.from("retention_settings").select("*").eq("id", 1).maybeSingle(), supabase.rpc("retention_preview")]);
      return { s: s.data, preview: p.data?.[0] ?? null };
    },
  });
  const [f, setF] = useState({ msg: "1095", cr: "730", note: "" });
  const [confirm, setConfirm] = useState("");
  useEffect(() => { if (data?.s) setF({ msg: String(data.s.message_retention_days), cr: String(data.s.closed_contact_retention_days), note: data.s.backup_note ?? "" }); }, [data?.s]);
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-retention"] });
  const save = async () => {
    const { error } = await supabase.from("retention_settings").update({ message_retention_days: parseInt(f.msg) || 0, closed_contact_retention_days: parseInt(f.cr) || 0, backup_note: f.note.trim().slice(0, 2000) || null, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) return toast.error(error.message.includes("check") ? "Minimum: 180 days for messages, 90 days for closed requests" : error.message);
    toast.success("Retention settings saved"); refresh();
  };
  const purge = async () => {
    const { data: r, error } = await supabase.rpc("purge_expired", { _confirm: confirm });
    if (error) return toast.error(error.message);
    const x = r as { messages: number; contact_requests: number };
    toast.success(`Removed ${x.messages} messages and ${x.contact_requests} closed requests`); setConfirm(""); refresh();
  };
  return (
    <>
      <DashHeader title="Backups & data retention" subtitle="How long marketplace records are kept. Nothing is deleted automatically." />
      <div className="mb-6 rounded-xl border bg-muted p-4 text-sm">
        <strong>Backups:</strong> the database is backed up automatically by Lovable Cloud. Restores are handled through Lovable support; this page cannot run or test a restore.
        Credit ledger, payments, invoices, refunds and audit logs are <strong>never</strong> purged here (financial and legal records).
      </div>
      <div className="card-surface mb-6 grid gap-3 p-5">
        <label className="text-xs">Keep conversation messages for (days, min 180)<Input type="number" min={180} disabled={!isAdmin} value={f.msg} onChange={(e) => setF({ ...f, msg: e.target.value })} /></label>
        <label className="text-xs">Keep declined / withdrawn contact requests for (days, min 90)<Input type="number" min={90} disabled={!isAdmin} value={f.cr} onChange={(e) => setF({ ...f, cr: e.target.value })} /></label>
        <label className="text-xs">Backup & retention notes (policy reference, who approved)<Textarea rows={3} disabled={!isAdmin} value={f.note} maxLength={2000} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
        {isAdmin && <Button className="w-fit" variant="outline" onClick={save}>Save</Button>}
      </div>
      <div className="card-surface grid gap-3 p-5">
        <h2 className="font-semibold">Manual clean-up</h2>
        <p className="text-sm">Would remove now: <strong>{data?.preview?.old_messages ?? 0}</strong> messages and <strong>{data?.preview?.old_closed_contacts ?? 0}</strong> closed contact requests. Messages in conversations under an open report are kept.</p>
        <p className="text-xs text-muted-foreground">Last clean-up: {data?.s?.last_purge_at ? fmtDateTime(data.s.last_purge_at) : "never"}</p>
        {isAdmin && <div className="flex flex-wrap gap-2"><Input className="w-48" placeholder="Type PURGE" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="Type PURGE to confirm" /><Button variant="outline" disabled={confirm !== "PURGE"} onClick={purge}>Run clean-up</Button></div>}
      </div>
    </>
  );
}
