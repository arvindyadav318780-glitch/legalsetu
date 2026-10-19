import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DashHeader, fmtDateTime } from "@/components/dash/DashShell";
import { EmptyState, StatusPill } from "@/components/site/bits";
import { selectCls } from "@/components/site/LocationSelect";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { TicketThread } from "@/components/dash/TicketThread";

export const Route = createFileRoute("/_authenticated/admin/tickets")({ component: Tickets });

const TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"];

function Tickets() {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const { data } = useQuery({
    queryKey: ["admin-tickets"],
    queryFn: async () => {
      const [t, c, s] = await Promise.all([
        supabase.from("support_tickets").select("*").eq("kind", "support").order("created_at", { ascending: false }),
        supabase.rpc("staff_contact_messages"),
        supabase.from("user_roles").select("user_id").in("role", ["admin", "support"]),
      ]);
      const staffIds = [...new Set((s.data ?? []).map((x) => x.user_id))];
      const names = staffIds.length ? ((await supabase.rpc("staff_directory")).data ?? []).filter((x) => staffIds.includes(x.id)) : [];
      return { tickets: t.data ?? [], contacts: c.data ?? [], staff: names };
    },
  });
  const set = async (id: string, patch: any) => {
    const { error } = await supabase.from("support_tickets").update(patch as never).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin-tickets"] });
  };
  const handleContact = async (id: string, st: string) => {
    const note = window.prompt(st === "needs_admin_reply" ? "Suggested reply or what the admin should do" : "Note (e.g. how you replied)");
    if (!note) return;
    const { error } = await supabase.rpc("update_contact_message", { _id: id, _status: st, _note: note });
    if (error) return toast.error(error.message);
    toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin-tickets"] });
  };
  const tickets = (data?.tickets ?? []).filter((t) => !status || t.status === status);
  return (
    <>
      <DashHeader title="Support tickets" subtitle="Assign, reply and update status. Complaints and profile reports are handled in Complaints & disputes." />
      <Tabs defaultValue="tickets">
        <TabsList><TabsTrigger value="tickets">Tickets ({data?.tickets.length ?? 0})</TabsTrigger><TabsTrigger value="contact">Contact form ({data?.contacts.length ?? 0})</TabsTrigger></TabsList>
        <TabsContent value="tickets" className="mt-4">
          <select aria-label="Filter by status" className={selectCls + " mb-4 w-44"} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{TICKET_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          {!tickets.length ? <EmptyState title="No tickets" /> : (
            <div className="card-surface divide-y">{tickets.map((t) => (
              <div key={t.id} className="p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1"><p className="font-medium">{t.subject}</p><p className="whitespace-pre-wrap text-sm text-muted-foreground">{t.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{fmtDateTime(t.created_at)}{t.request_id && <> · <Link to="/dashboard/requests/$id" params={{ id: t.request_id }} className="text-accent underline">linked request</Link></>}</p></div>
                  <StatusPill status={t.status} />
                  <select aria-label="Assigned to" className={selectCls + " w-48"} value={t.assigned_to ?? ""} onChange={(e) => set(t.id, { assigned_to: e.target.value || null })}>
                    <option value="">Unassigned</option>{(data?.staff ?? []).map((s) => <option key={s.id} value={s.id}>{s.id === user?.id ? "Me" : s.full_name || s.email}</option>)}
                  </select>
                  <select aria-label="Ticket status" className={selectCls + " w-36"} value={t.status} onChange={(e) => set(t.id, { status: e.target.value })}>{TICKET_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
                  <Button size="sm" variant="outline" onClick={() => setOpen(open === t.id ? null : t.id)}>{open === t.id ? "Hide" : "Replies"}</Button>
                </div>
                {open === t.id && <TicketThread ticketId={t.id} />}
              </div>
            ))}</div>
          )}
        </TabsContent>
        <TabsContent value="contact" className="mt-4">
          {!data?.contacts.length ? <EmptyState title="No messages" /> : (
            <div className="card-surface divide-y">{data.contacts.map((c) => (
              <div key={c.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2"><p className="flex-1 font-medium">{c.subject}</p><StatusPill status={c.handling_status} /></div>
                <p className="text-xs text-muted-foreground">{c.name}{isAdmin && c.email ? ` · ${c.email}` : ""} · {fmtDateTime(c.created_at)}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{c.message}</p>
                {c.handling_note && <p className="mt-1 text-xs text-muted-foreground">Note: {c.handling_note}</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  {!isAdmin && <p className="w-full text-xs text-muted-foreground">Sender email is visible to administrators only. Flag for an admin to reply.</p>}
                  <Button size="sm" variant="outline" onClick={() => handleContact(c.id, "needs_admin_reply")}>Needs admin reply</Button>
                  {isAdmin && <><Button size="sm" variant="outline" onClick={() => handleContact(c.id, "replied")}>Mark replied</Button><Button size="sm" variant="ghost" onClick={() => handleContact(c.id, "closed")}>Close</Button></>}
                </div>
              </div>
            ))}</div>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
