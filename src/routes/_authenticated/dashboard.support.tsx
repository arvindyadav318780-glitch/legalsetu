import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DashHeader, fmtDate } from "@/components/dash/DashShell";
import { EmptyState, StatusPill } from "@/components/site/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { selectCls } from "@/components/site/LocationSelect";
import { TicketThread } from "@/components/dash/TicketThread";

export const Route = createFileRoute("/_authenticated/dashboard/support")({ component: Support });

function Support() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState("support");
  const [reqId, setReqId] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const reqs = useQuery({
    queryKey: ["my-req-options", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("service_requests").select("id,reference,service_name").eq("customer_id", user!.id).order("created_at", { ascending: false })).data ?? [],
  });
  const { data = [] } = useQuery({
    queryKey: ["tickets", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("support_tickets").select("*").eq("user_id", user!.id).order("created_at", { ascending: false })).data ?? [],
  });
  const create = async () => {
    if (!subject.trim() || body.trim().length < 10) return toast.error("Add a subject and at least 10 characters of detail");
    const { error } = await supabase.from("support_tickets").insert({ user_id: user!.id, subject: subject.trim().slice(0, 200), body: body.trim().slice(0, 3000), kind, request_id: reqId || null });
    if (error) return toast.error("Couldn't create ticket");
    toast.success("Ticket created"); setSubject(""); setBody(""); setReqId("");
    qc.invalidateQueries({ queryKey: ["tickets"] });
  };
  return (
    <>
      <DashHeader title="Support Tickets" subtitle="Email notifications for ticket updates are coming soon; check status here." />
      <div className="card-surface grid gap-3 p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_200px_240px]">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" maxLength={200} />
          <select className={selectCls} value={kind} onChange={(e) => setKind(e.target.value)}><option value="support">Support</option><option value="complaint">Complaint</option></select>
          <select aria-label="Related request" className={selectCls} value={reqId} onChange={(e) => setReqId(e.target.value)}><option value="">No related request</option>{(reqs.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.reference} · {r.service_name}</option>)}</select>
        </div>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={3000} placeholder="Describe your issue" />
        <Button variant="accent" className="w-fit" onClick={create}>Create ticket</Button>
      </div>
      <div className="mt-6">
        {data.length === 0 ? <EmptyState title="No tickets" body="Your support tickets will appear here." /> : (
          <div className="card-surface divide-y">{data.map((t) => (
            <div key={t.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1"><p className="font-medium">{t.subject}</p><p className="line-clamp-2 text-sm text-muted-foreground">{t.body}</p><p className="mt-1 text-xs text-muted-foreground">{t.kind.replace("_", " ")} · {fmtDate(t.created_at)}</p>
                  {t.resolution_note && <p className="mt-2 rounded-lg bg-muted p-2 text-sm"><span className="font-medium">Outcome:</span> {t.resolution_note}</p>}</div>
                <StatusPill status={t.status} />
                <Button size="sm" variant="outline" onClick={() => setOpen(open === t.id ? null : t.id)}>{open === t.id ? "Hide" : "Replies"}</Button>
              </div>
              {open === t.id && <TicketThread ticketId={t.id} closed={t.status === "closed"} />}
            </div>
          ))}</div>
        )}
      </div>
    </>
  );
}
