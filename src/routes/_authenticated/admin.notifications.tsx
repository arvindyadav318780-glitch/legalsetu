import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { sendAnnouncement } from "@/lib/admin.functions";
import { DashHeader, fmtDateTime } from "@/components/dash/DashShell";
import { EmptyState, FutureBadge } from "@/components/site/bits";
import { selectCls } from "@/components/site/LocationSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/admin/notifications")({ component: Notifications });

function Notifications() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const send = useServerFn(sendAnnouncement);
  const [f, setF] = useState({ audience: "customers", target: "", title: "", body: "" });
  const [busy, setBusy] = useState(false);
  const { data } = useQuery({
    queryKey: ["admin-announcements"],
    queryFn: async () => {
      const [a, p] = await Promise.all([
        supabase.from("announcements").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.rpc("staff_directory"),
      ]);
      return { list: a.data ?? [], people: p.data ?? [] };
    },
  });
  const submit = async () => {
    if (f.title.trim().length < 3 || f.body.trim().length < 3) return toast.error("Add a title and message");
    if (f.audience === "user" && !f.target) return toast.error("Choose a recipient");
    setBusy(true);
    try {
      const r = await send({ data: { audience: f.audience as "customers", targetUser: f.audience === "user" ? f.target : undefined, title: f.title, body: f.body } });
      toast.success(`Sent to ${r.recipients} account(s)`); setF({ ...f, title: "", body: "" });
      qc.invalidateQueries({ queryKey: ["admin-announcements"] });
    } catch (e) { toast.error((e as Error).message || "Couldn't send"); }
    setBusy(false);
  };
  return (
    <>
      <DashHeader title="Notifications" subtitle="Send in-app announcements. Automatic notifications (status changes, assignments, verification) are sent by the system." />
      {isAdmin && (
        <div className="card-surface grid gap-3 p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <select aria-label="Audience" className={selectCls} value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}>
              <option value="customers">All customers</option><option value="professionals">All professionals</option><option value="user">One user</option>
            </select>
            {f.audience === "user" && <select aria-label="Recipient" className={selectCls} value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })}><option value="">Choose recipient…</option>{(data?.people ?? []).map((p) => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}</select>}
          </div>
          <Input aria-label="Title" placeholder="Title" maxLength={120} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <Textarea aria-label="Message" placeholder="Message" rows={3} maxLength={1000} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
          <div className="flex items-center gap-3"><Button variant="accent" disabled={busy} onClick={submit}>{busy ? "Sending…" : "Send announcement"}</Button><span className="text-xs text-muted-foreground">Email and SMS delivery</span><FutureBadge /></div>
        </div>
      )}
      <h2 className="mb-3 mt-8 font-semibold">Sent announcements</h2>
      {!(data?.list.length) ? <EmptyState title="Nothing sent yet" /> : (
        <div className="card-surface divide-y">{data.list.map((a) => (
          <div key={a.id} className="p-4"><p className="font-medium">{a.title}</p><p className="text-sm text-muted-foreground">{a.body}</p>
            <p className="mt-1 text-xs text-muted-foreground">{a.audience === "user" ? "One user" : `All ${a.audience}`} · {a.recipients} recipient(s) · {fmtDateTime(a.created_at)}</p></div>
        ))}</div>
      )}
    </>
  );
}
