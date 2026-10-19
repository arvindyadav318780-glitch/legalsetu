import { useState } from "react";
import { ProLink } from "@/components/site/ProAvatar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ban, Send, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { EmptyState, StatusPill } from "@/components/site/bits";
import { fmtDateTime } from "@/components/dash/DashShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ReportButton } from "@/components/site/ReportButton";
import { isRestrictionActive } from "@/lib/reports";

const errMsg = (e: unknown) => (e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Something went wrong");

export function Conversations({ role }: { role: "client" | "pro" }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [active, setActive] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ["mkt-convs", user?.id], enabled: !!user, refetchInterval: 15000,
    queryFn: async () => {
      const [cr, cv, blocks] = await Promise.all([
        supabase.from("contact_requests").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("conversations").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("user_blocks").select("*").eq("blocker_id", user!.id),
      ]);
      const proIds = [...new Set((cr.data ?? []).map((r) => r.professional_id))];
      const { data: pros } = proIds.length ? await supabase.from("professional_profiles").select("user_id,display_name,category").in("user_id", proIds) : { data: [] };
      return { requests: cr.data ?? [], convs: (cv.data ?? []).filter((c) => c.client_id === user!.id || c.professional_id === user!.id), blocks: blocks.data ?? [], pros: pros ?? [] };
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["mkt-convs"] });
  const proName = (id: string) => data?.pros.find((p) => p.user_id === id)?.display_name ?? "Professional";
  const other = (c: { client_id: string; professional_id: string }) => (role === "client" ? proName(c.professional_id) : `Client ${c.client_id.slice(0, 6)}`);

  const accept = async (id: string) => {
    const { data: cid, error } = await supabase.rpc("accept_contact_request", { _id: id });
    if (error) return toast.error(errMsg(error));
    toast.success("Accepted — conversation opened"); refresh(); setActive(cid as string);
  };
  const decline = async (id: string) => {
    const reason = role === "pro" ? window.prompt("Reason (optional, shared with the client)") ?? "" : "";
    const { error } = await supabase.rpc("decline_contact_request", { _id: id, _reason: reason });
    if (error) return toast.error(errMsg(error));
    toast.success(role === "pro" ? "Declined. No charge applies." : "Request withdrawn"); refresh();
  };

  const pending = (data?.requests ?? []).filter((r) => r.status === "pending");
  const past = (data?.requests ?? []).filter((r) => r.status !== "pending" && r.status !== "accepted");
  const conv = data?.convs.find((c) => c.id === active);

  return (
    <div className="grid gap-6">
      {role === "pro" && <StartContact clients={[...new Set((data?.convs ?? []).map((c) => c.client_id))]} onSent={refresh} />}
      <section>
        <h2 className="mb-2 font-semibold">{role === "pro" ? "Contact requests awaiting your reply" : "Your pending contact requests"} ({pending.length})</h2>
        {pending.length === 0 ? <EmptyState title="Nothing pending" body={role === "client" ? "Find a verified professional in the directory and send a contact request." : "New client contact requests will appear here."} /> : (
          <div className="card-surface divide-y">{pending.map((r) => (
            <div key={r.id} className="grid gap-2 p-4">
              <div className="flex flex-wrap items-center gap-2"><p className="flex-1 font-medium">{role === "client" ? <ProLink id={r.professional_id}>{proName(r.professional_id)}</ProLink> : `Client ${r.client_id.slice(0, 6)}`}</p><StatusPill status={r.status} /></div>
              <p className="whitespace-pre-wrap text-sm">{r.message}</p>
              <div className="flex flex-wrap items-center gap-2"><p className="flex-1 text-xs text-muted-foreground">Sent {fmtDateTime(r.created_at)}</p><ReportButton targetId={role === "client" ? r.professional_id : r.client_id} contactRequestId={r.id} /></div>
              <div className="flex flex-wrap gap-2">
                {r.initiated_by === "professional" && <span className="w-full text-xs text-muted-foreground">{role === "pro" ? "Sent by you — waiting for the client." : "This professional contacted you first. Accept only if you want to talk to them."}</span>}
                {(role === "pro") === (r.initiated_by === "client") ? (<>
                  <Button size="sm" variant="accent" onClick={() => accept(r.id)}>Accept & open conversation</Button>
                  <Button size="sm" variant="outline" onClick={() => decline(r.id)}>Decline</Button>
                </>) : <Button size="sm" variant="outline" onClick={() => decline(r.id)}>Withdraw</Button>}
              </div>
            </div>
          ))}</div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div>
          <h2 className="mb-2 font-semibold">Conversations</h2>
          {(data?.convs ?? []).length === 0 ? <EmptyState title="No conversations yet" /> : (
            <div className="card-surface divide-y">{data!.convs.map((c) => (
              <button key={c.id} onClick={() => setActive(c.id)} className={`block w-full p-3 text-left text-sm ${active === c.id ? "bg-muted" : ""}`}>
                <p className="font-medium">{other(c)}</p><p className="text-xs text-muted-foreground">Since {fmtDateTime(c.created_at)}</p>
              </button>
            ))}</div>
          )}
        </div>
        <div>{conv ? <Thread conv={conv} title={other(conv)} role={role} blocked={(data?.blocks ?? []).some((b) => b.blocked_id === (role === "client" ? conv.professional_id : conv.client_id))} onChange={refresh} /> : <div className="card-surface p-6 text-sm text-muted-foreground">Select a conversation to read and reply.</div>}</div>
      </section>

      {past.length > 0 && (
        <details className="card-surface p-4 text-sm"><summary className="cursor-pointer font-semibold">Closed contact requests</summary>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">{past.map((r) => <li key={r.id}>{fmtDateTime(r.created_at)} · {role === "client" ? <ProLink id={r.professional_id}>{proName(r.professional_id)}</ProLink> : `Client ${r.client_id.slice(0, 6)}`} · {r.status}{r.decline_reason ? ` · ${r.decline_reason}` : ""}</li>)}</ul>
        </details>
      )}
      <AppealBox />
    </div>
  );
}

type Conv = { id: string; client_id: string; professional_id: string; closed: boolean };

function Thread({ conv, title, role, blocked, onChange }: { conv: Conv; title: string; role: "client" | "pro"; blocked: boolean; onChange: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const otherId = role === "client" ? conv.professional_id : conv.client_id;
  const { data } = useQuery({
    queryKey: ["mkt-msgs", conv.id], refetchInterval: 5000,
    queryFn: async () => {
      const [m, rv] = await Promise.all([
        supabase.from("conversation_messages").select("*").eq("conversation_id", conv.id).order("created_at").limit(500),
        supabase.from("reviews").select("id").eq("conversation_id", conv.id).maybeSingle(),
      ]);
      return { msgs: m.data ?? [], reviewed: !!rv.data };
    },
  });
  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    const { error } = await supabase.from("conversation_messages").insert({ conversation_id: conv.id, sender_id: user!.id, body: body.slice(0, 4000) });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    setText(""); qc.invalidateQueries({ queryKey: ["mkt-msgs", conv.id] });
  };
  const toggleBlock = async () => {
    const { error } = blocked
      ? await supabase.from("user_blocks").delete().eq("blocker_id", user!.id).eq("blocked_id", otherId)
      : await supabase.from("user_blocks").insert({ blocker_id: user!.id, blocked_id: otherId });
    if (error) return toast.error(errMsg(error));
    toast.success(blocked ? "Unblocked" : "Blocked. Neither of you can send messages now."); onChange();
  };
  const complain = async () => {
    const body = window.prompt("Describe your complaint or dispute (at least 20 characters). It becomes a complaint ticket that LegalSetu staff will review.");
    if (!body || body.trim().length < 20) return body ? toast.error("Please write at least 20 characters") : undefined;
    const { error } = await supabase.from("support_tickets").insert({ user_id: user!.id, kind: "complaint", subject: `Complaint about conversation ${conv.id.slice(0, 8)} with ${title}`.slice(0, 200), body: body.trim().slice(0, 3000) });
    if (error) return toast.error(errMsg(error));
    toast.success("Complaint ticket created. Track it under Support.");
  };
  const proReplied = (data?.msgs ?? []).some((m) => m.sender_id === conv.professional_id);
  return (
    <div className="card-surface grid gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2"><h3 className="flex-1 font-semibold">{role === "client" ? <ProLink id={conv.professional_id}>{title}</ProLink> : title}</h3>
        <Button size="sm" variant="ghost" onClick={toggleBlock}><Ban /> {blocked ? "Unblock" : "Block"}</Button>
        <ReportButton targetId={otherId} conversationId={conv.id} />
        <Button size="sm" variant="ghost" onClick={complain}>Complaint / dispute</Button>
      </div>
      <p className="text-xs text-muted-foreground">Private conversation between the two of you. Don't share passwords, OTPs or card details here. For documents, use your secure request page.</p>
      <div className="max-h-[420px] space-y-2 overflow-y-auto rounded-lg bg-muted p-3">
        {(data?.msgs ?? []).length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
        {(data?.msgs ?? []).map((m) => (
          <div key={m.id} className={`max-w-[85%] rounded-lg border bg-card p-2 text-sm ${m.sender_id === user?.id ? "ml-auto" : ""}`}>
            <p className="whitespace-pre-wrap break-words">{m.body}</p><p className="mt-1 text-[11px] text-muted-foreground">{m.sender_id === user?.id ? "You" : title} · {fmtDateTime(m.created_at)}</p>
          </div>
        ))}
      </div>
      {conv.closed || blocked ? <p className="text-sm text-muted-foreground">{blocked ? "You blocked this user. Unblock to continue." : "This conversation is closed."}</p> : (
        <div className="flex gap-2"><Textarea rows={2} value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} placeholder="Write a message" aria-label="Message" />
          <Button onClick={send} disabled={busy || !text.trim()} aria-label="Send"><Send /></Button></div>
      )}
      {role === "client" && proReplied && !data?.reviewed && <ReviewForm conv={conv} onDone={() => qc.invalidateQueries({ queryKey: ["mkt-msgs", conv.id] })} />}
      {role === "client" && data?.reviewed && <p className="text-xs text-muted-foreground">You've reviewed this interaction.</p>}
    </div>
  );
}

function ReviewForm({ conv, onDone }: { conv: Conv; onDone: () => void }) {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const submit = async () => {
    if (rating < 1) return toast.error("Choose a rating");
    const { error } = await supabase.from("reviews").insert({ client_id: user!.id, professional_id: conv.professional_id, conversation_id: conv.id, rating, body: body.trim().slice(0, 2000) || null });
    if (error) return toast.error(errMsg(error));
    toast.success("Thank you — your review is published"); onDone();
  };
  return (
    <div className="grid gap-2 rounded-lg border p-3">
      <p className="text-sm font-medium">Rate this interaction</p>
      <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" aria-label={`${n} star`} onClick={() => setRating(n)}><Star className={`h-5 w-5 ${n <= rating ? "fill-accent text-accent" : "text-muted-foreground"}`} /></button>
      ))}</div>
      <Textarea rows={2} value={body} maxLength={2000} onChange={(e) => setBody(e.target.value)} placeholder="Optional: what went well or what could be better (factual, no personal data)" />
      <Button size="sm" className="w-fit" variant="outline" onClick={submit}>Submit review</Button>
    </div>
  );
}

export function AppealBox() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const { data = [] } = useQuery({
    queryKey: ["my-appeals", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("appeals").select("*").eq("user_id", user!.id).order("created_at", { ascending: false })).data ?? [],
  });
  const [restrictionId, setRestrictionId] = useState("");
  const { data: restrictions = [] } = useQuery({
    queryKey: ["my-restrictions", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("account_restrictions").select("id,reason,starts_at,ends_at,lifted_at").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(20)).data ?? [],
  });
  const active = restrictions.filter((r) => isRestrictionActive(r));
  const submit = async () => {
    if (subject.trim().length < 3 || body.trim().length < 20) return toast.error("Add a subject and at least 20 characters of explanation");
    const { error } = await supabase.from("appeals").insert({ user_id: user!.id, subject: subject.trim().slice(0, 200), body: body.trim().slice(0, 4000), restriction_id: restrictionId || null });
    if (error) return toast.error(errMsg(error));
    toast.success("Appeal submitted"); setSubject(""); setBody(""); setRestrictionId(""); qc.invalidateQueries({ queryKey: ["my-appeals"] });
  };
  return (
    <details className="card-surface p-4 text-sm">
      <summary className="cursor-pointer font-semibold">Appeal a decision (suspension, hidden review, blocked contact)</summary>
      <p className="mt-2 text-xs text-muted-foreground">An administrator reviews every appeal and records a written decision. You'll be notified of the outcome.</p>
      {active.map((r) => <p key={r.id} role="status" className="mt-3 rounded-lg border border-warning/50 bg-warning/10 p-3 text-xs">Your account is temporarily restricted until <strong>{fmtDateTime(r.ends_at)}</strong>: {r.reason}. Messaging, contact and new requests are paused; the restriction ends automatically.</p>)}
      <div className="mt-3 grid gap-2">
        {restrictions.length > 0 && <select className="h-9 rounded-md border bg-background px-2 text-sm" value={restrictionId} onChange={(e) => setRestrictionId(e.target.value)} aria-label="Restriction to appeal">
          <option value="">Not about a temporary restriction</option>{restrictions.map((r) => <option key={r.id} value={r.id}>Restriction until {fmtDateTime(r.ends_at)}{r.lifted_at ? " (lifted)" : ""}</option>)}
        </select>}
        <Input value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" aria-label="Appeal subject" />
        <Textarea rows={3} value={body} maxLength={4000} onChange={(e) => setBody(e.target.value)} placeholder="Explain what happened and why the decision should be reviewed" aria-label="Appeal details" />
        <Button size="sm" variant="outline" className="w-fit" onClick={submit}>Submit appeal</Button>
      </div>
      {data.length > 0 && <ul className="mt-3 space-y-1 text-xs">{data.map((a) => <li key={a.id}>{fmtDateTime(a.created_at)} · {a.subject} · <strong>{a.status.replace("_", " ")}</strong>{a.decision_note ? ` · ${a.decision_note}` : ""}</li>)}</ul>}
    </details>
  );
}

/** Professional-initiated contact. Only to clients the professional already worked with; blocked unless the admin switch is on after legal review. */
function StartContact({ clients, onSent }: { clients: string[]; onSent: () => void }) {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["pro-initiate", user?.id], enabled: !!user,
    queryFn: async () => {
      const [s, p, r] = await Promise.all([
        supabase.from("marketplace_settings").select("pro_initiate_ca,pro_initiate_advocate").eq("id", 1).maybeSingle(),
        supabase.from("professional_profiles").select("category").eq("user_id", user!.id).maybeSingle(),
        supabase.from("service_requests").select("customer_id").eq("assigned_professional_id", user!.id).limit(200),
      ]);
      const cat = p.data?.category;
      const on = (cat === "Chartered Accountant" && !!s.data?.pro_initiate_ca) || (cat === "Advocate" && !!s.data?.pro_initiate_advocate);
      return { on, known: [...new Set([...clients, ...(r.data ?? []).map((x) => x.customer_id)])] };
    },
  });
  const [client, setClient] = useState("");
  const [msg, setMsg] = useState("");
  if (!data) return null;
  if (!data.on) return <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">Starting contact with a client yourself is switched off while LegalSetu completes a legal review (Bar Council and ICAI rules on solicitation). Clients can still contact you.</p>;
  const send = async () => {
    if (!client || msg.trim().length < 10) return toast.error("Choose a client and write at least 10 characters");
    const { error } = await supabase.from("contact_requests").insert({ client_id: client, professional_id: user!.id, initiated_by: "professional", message: msg.trim().slice(0, 2000) });
    if (error) return toast.error(errMsg(error));
    toast.success("Request sent. The client decides whether to accept."); setMsg(""); onSent();
  };
  return (
    <div className="card-surface grid gap-2 p-4 text-sm">
      <h2 className="font-semibold">Contact a previous client</h2>
      <p className="text-xs text-muted-foreground">Only clients you've already worked with. Up to 5 per day. The client must accept before a conversation opens.</p>
      <select className="h-10 rounded-md border bg-background px-3" value={client} onChange={(e) => setClient(e.target.value)} aria-label="Client"><option value="">Choose client</option>{data.known.map((c) => <option key={c} value={c}>Client {c.slice(0, 6)}</option>)}</select>
      <Textarea rows={2} value={msg} maxLength={2000} onChange={(e) => setMsg(e.target.value)} placeholder="Why you're getting in touch" aria-label="Message to client" />
      <Button size="sm" variant="outline" className="w-fit" onClick={send}>Send request</Button>
    </div>
  );
}
