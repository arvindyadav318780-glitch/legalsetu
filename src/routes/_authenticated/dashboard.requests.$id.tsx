import { createFileRoute, Link } from "@tanstack/react-router";
import { ProLink } from "@/components/site/ProAvatar";
import { CONTACT_PREFS, URGENCY, labelOf } from "@/lib/requests";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Circle, FileText, Send, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { REQUEST_STATUSES, customerCanCancel, customerCanClose, proNextStatuses, statusLabel, validateDocument } from "@/lib/status";
import { useCatalog } from "@/lib/catalog-live";
import { StatusPill, EmptyState } from "@/components/site/bits";
import { fmtDateTime } from "@/components/dash/DashShell";
import { openDocument } from "@/components/dash/docs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { selectCls } from "@/components/site/LocationSelect";
import { Skeleton } from "@/components/ui/skeleton";
import { useServerFn } from "@tanstack/react-start";
import { createPaymentRequest } from "@/lib/payments.functions";
import { inr } from "@/lib/fees";

export const Route = createFileRoute("/_authenticated/dashboard/requests/$id")({ component: Detail });

function Detail() {
  const { id } = Route.useParams();
  const { user, isStaff } = useAuth();
  const { getService } = useCatalog(true);
  const qc = useQueryClient();
  const key = ["request", id];
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const since = new Date(Date.now() - 55 * 60 * 1000).toISOString();
      const [r, rc, h, m, d, t, c, dr, ap, pn] = await Promise.all([
        supabase.from("service_requests").select("id,reference,customer_id,service_slug,service_name,contact_name,state,city,mode,answers,details,status,assigned_professional_id,next_action,terms_accepted,created_at,updated_at,assignment_accepted_at,assignment_note,urgency,contact_preference,contact_consent_at,contact_consent_withdrawn_at").eq("id", id).maybeSingle(),
        supabase.rpc("request_contact", { _rid: id }),
        supabase.from("request_status_history").select("*").eq("request_id", id).order("created_at"),
        supabase.from("messages").select("*").eq("request_id", id).order("created_at"),
        supabase.from("documents").select("*").eq("request_id", id).order("created_at"),
        supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("request_id", id).in("status", ["open", "in_progress"]),
        supabase.from("conversation_access_log").select("id").eq("request_id", id).gte("created_at", since).limit(1),
        supabase.from("document_requests").select("*").eq("request_id", id).order("created_at"),
        supabase.from("appointments").select("*").eq("request_id", id).order("preferred_at"),
        supabase.rpc("assigned_professional_name", { _rid: id }),
      ]);
      const contact = (rc.data as { contact_email: string | null; contact_phone: string | null; shared: boolean }[] | null)?.[0] ?? { contact_email: null, contact_phone: null, shared: false };
      return { contact, req: r.data, history: h.data ?? [], messages: m.data ?? [], docs: d.data ?? [], openTickets: t.count ?? 0, unlocked: (c.data ?? []).length > 0, docReqs: dr.data ?? [], appts: ap.data ?? [], proName: (pn.data as string | null) ?? null };
    },
  });
  const pros = useQuery({
    queryKey: ["pros-for-assign"], enabled: isStaff,
    queryFn: async () => (await supabase.from("professional_profiles").select("user_id,display_name,category,verification_status,suspended")).data ?? [],
  });
  const [msg, setMsg] = useState("");
  const [docReason, setDocReason] = useState("");
  const [convReason, setConvReason] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [assignTo, setAssignTo] = useState<string | null>(null);
  const [assignNote, setAssignNote] = useState("");
  const [infoText, setInfoText] = useState("");
  const [docLabel, setDocLabel] = useState("");
  const [appt, setAppt] = useState({ at: "", mode: "Online", topic: "" });
  const [busy, setBusy] = useState(false);
  const createPay = useServerFn(createPaymentRequest);
  const [pf, setPf] = useState({ desc: "", fee: "", tax: "", gov: "" });
  const payments = useQuery({
    queryKey: ["request-payments", id],
    queryFn: async () => (await supabase.from("payments").select("id,description,total_paise,status,invoice_number,created_at").eq("request_id", id).order("created_at", { ascending: false })).data ?? [],
  });

  if (isLoading) return <Skeleton className="h-80 rounded-xl" />;
  const req = data?.req;
  if (!req) return <EmptyState title="Request not found" body="It doesn't exist or you don't have access." action={<Button asChild><Link to="/dashboard/requests">Back</Link></Button>} />;

  const isCustomer = req.customer_id === user?.id;
  const isAssigned = req.assigned_professional_id === user?.id;
  const accepted = !!req.assignment_accepted_at;
  const isParty = isCustomer || isAssigned;
  const oversightEligible = req.status === "disputed" || data!.openTickets > 0;
  const conversationVisible = isParty || data!.unlocked;
  const serviceDocs = getService(req.service_slug)?.documents ?? [];
  const proOptions = proNextStatuses(req.status, accepted);
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  const openConversation = async () => {
    if (convReason.trim().length < 5) return toast.error("Enter a reason (at least 5 characters)");
    const { error } = await supabase.from("conversation_access_log").insert({ request_id: id, staff_id: user!.id, reason: convReason.trim().slice(0, 500) });
    if (error) return toast.error("Conversation access is only allowed for disputed requests or those with an open ticket.");
    setConvReason(""); refresh();
  };
  const openDoc = async (d: { id: string; storage_path: string; owner_id: string }) => {
    if (isParty || d.owner_id === user?.id) return openDocument(d.storage_path);
    if (docReason.trim().length < 5) return toast.error("Enter a reason for opening this customer document (at least 5 characters)");
    return openDocument(d.storage_path, { documentId: d.id, reason: docReason.trim() });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update = async (patch: any, ok = "Updated") => {
    const { error } = await supabase.from("service_requests").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return false; }
    toast.success(ok); refresh(); return true;
  };
  const postMessage = async (body: string) => {
    const { error } = await supabase.from("messages").insert({ request_id: id, sender_id: user!.id, body: body.slice(0, 4000) });
    if (error) { toast.error("Couldn't send message"); return false; }
    return true;
  };
  const send = async () => {
    const body = msg.trim();
    if (!body) return;
    if (await postMessage(body)) { setMsg(""); refresh(); }
  };
  const requestInfo = async () => {
    const t = infoText.trim();
    if (t.length < 5) return toast.error("Describe what you need from the customer");
    if (!(await postMessage(`Information requested: ${t}`))) return;
    await update({ status: "customer_action_required", next_action: t.slice(0, 200) }, "Customer asked for information");
    setInfoText("");
  };
  const requestDoc = async () => {
    const l = docLabel.trim();
    if (l.length < 3) return toast.error("Name the document you need");
    const { error } = await supabase.from("document_requests").insert({ request_id: id, label: l.slice(0, 200), requested_by: user!.id });
    if (error) return toast.error(error.message);
    if (req.status === "in_progress") await update({ status: "customer_action_required", next_action: `Upload: ${l}`.slice(0, 200) }, "Document requested");
    else { toast.success("Document requested"); refresh(); }
    setDocLabel("");
  };
  const schedule = async () => {
    if (!appt.at || appt.topic.trim().length < 3) return toast.error("Choose a date/time and add a topic");
    if (new Date(appt.at) < new Date()) return toast.error("Choose a future time");
    const { error } = await supabase.from("appointments").insert({ customer_id: req.customer_id, professional_id: user!.id, request_id: id, preferred_at: new Date(appt.at).toISOString(), mode: appt.mode, topic: appt.topic.trim().slice(0, 200), status: "confirmed" });
    if (error) return toast.error(error.message);
    toast.success("Appointment scheduled"); setAppt({ at: "", mode: "Online", topic: "" }); refresh();
  };
  const fulfil = async (drId: string, label: string, files: FileList | null) => {
    const f = files?.[0]; if (!f || !user) return;
    const e = validateDocument(f); if (e) return toast.error(e);
    setBusy(true);
    const path = `${user.id}/${id}/${crypto.randomUUID()}-${f.name.replace(/[^\w.-]/g, "_")}`;
    const up = await supabase.storage.from("documents").upload(path, f, { contentType: f.type });
    if (up.error) { setBusy(false); return toast.error("Upload failed"); }
    const ins = await supabase.from("documents").insert({ owner_id: user.id, request_id: id, file_name: f.name, storage_path: path, category: label.slice(0, 60), mime_type: f.type, size_bytes: f.size }).select("id").single();
    if (ins.error) { setBusy(false); return toast.error("Upload failed"); }
    const { error } = await supabase.from("document_requests").update({ status: "fulfilled", fulfilled_document_id: ins.data.id }).eq("id", drId);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Document uploaded"); refresh();
  };
  const raisePayment = async () => {
    const rs = (v: string) => Math.round((parseFloat(v || "0") || 0) * 100);
    try {
      await createPay({ data: { requestId: id, description: pf.desc || `${req.service_name} — ${req.reference}`, professionalFeePaise: rs(pf.fee), professionalTaxPaise: rs(pf.tax), governmentFeePaise: rs(pf.gov) } });
      toast.success("Payment request sent to the customer (test mode)"); setPf({ desc: "", fee: "", tax: "", gov: "" });
      qc.invalidateQueries({ queryKey: ["request-payments", id] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't create payment request"); }
  };
  const reassign = async () => {
    const to = assignTo ?? "";
    if (req.assigned_professional_id && assignNote.trim().length < 5) return toast.error("Enter a reason for reassigning (at least 5 characters)");
    if (await update({ assigned_professional_id: to || null, assignment_note: assignNote.trim() || null }, to ? "Professional assigned" : "Assignment removed")) { setAssignTo(null); setAssignNote(""); }
  };

  return (
    <>
      <Link to="/dashboard/requests" className="text-sm text-accent hover:underline">← My requests</Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div><p className="font-mono text-sm text-muted-foreground">Request ID {req.reference}</p><h1 className="text-2xl font-bold">{req.service_name}</h1></div>
        <StatusPill status={req.status} />
      </div>
      {req.next_action && !["completed", "closed", "cancelled"].includes(req.status) && (
        <p className="mt-4 rounded-lg border border-accent/40 bg-accent/5 p-3 text-sm"><span className="font-semibold">Next action:</span> {req.next_action}</p>
      )}
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <section className="card-surface p-5">
            <h2 className="font-semibold">Details</h2>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <D k="Assigned professional" v={data!.proName ? <><ProLink id={req.assigned_professional_id}>{data!.proName}</ProLink>{accepted ? "" : " · awaiting acceptance"}</> : "Not yet assigned"} />
              <D k="Contact" v={isStaff ? <Link to="/admin/customers" search={{ q: req.customer_id }} className="hover:underline">{req.contact_name}</Link> : req.contact_name} />
              {data!.contact.shared ? <><D k="Email" v={data!.contact.contact_email ?? "—"} />{data!.contact.contact_phone && <D k="Phone" v={data!.contact.contact_phone} />}</> : <D k="Email & phone" v={!req.contact_consent_at || req.contact_consent_withdrawn_at ? "Hidden — client has not consented to sharing" : "Shown after you accept the assignment"} />}
              <D k="Urgency" v={labelOf(URGENCY, req.urgency)} /><D k="Contact by" v={labelOf(CONTACT_PREFS, req.contact_preference)} />
              <D k="Location" v={[req.city, req.state].filter(Boolean).join(", ") || "—"} /><D k="Mode" v={req.mode ?? "—"} />
              {Object.entries((req.answers as Record<string, string>) ?? {}).map(([k, v]) => <D key={k} k={k} v={v || "—"} />)}
            </dl>
            {req.details && <p className="mt-3 rounded-lg bg-muted p-3 text-sm">{req.details}</p>}
          </section>

          {isAssigned && (
            <section className="card-surface space-y-4 p-5">
              <h2 className="font-semibold">Your actions</h2>
              {!accepted ? (
                <div className="rounded-lg bg-muted p-4 text-sm">
                  <p>This request has been assigned to you. Accept it to start work and unlock the actions below. If you can't take it on, contact LegalSetu support to be reassigned.</p>
                  <Button className="mt-3" variant="accent" onClick={() => update({ status: "in_progress" }, "Assignment accepted")}>Accept assignment</Button>
                </div>
              ) : (<>
                <div className="grid gap-2"><label className="text-sm text-muted-foreground">Request additional information</label>
                  <div className="flex gap-2"><Input value={infoText} onChange={(e) => setInfoText(e.target.value)} placeholder="e.g. Confirm your annual turnover" maxLength={500} aria-label="Information needed" /><Button variant="outline" onClick={requestInfo}>Request</Button></div></div>
                <div className="grid gap-2"><label className="text-sm text-muted-foreground">Request a document</label>
                  <div className="flex gap-2"><Input value={docLabel} onChange={(e) => setDocLabel(e.target.value)} placeholder="e.g. Rent agreement for business premises" maxLength={200} aria-label="Document needed" /><Button variant="outline" onClick={requestDoc}>Request</Button></div></div>
                <div className="grid gap-2"><label className="text-sm text-muted-foreground">Schedule an appointment</label>
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]"><Input type="datetime-local" value={appt.at} onChange={(e) => setAppt({ ...appt, at: e.target.value })} aria-label="Appointment date and time" />
                    <select className={selectCls} value={appt.mode} onChange={(e) => setAppt({ ...appt, mode: e.target.value })} aria-label="Appointment mode"><option>Online</option><option>Phone</option><option>In-person</option></select></div>
                  <div className="flex gap-2"><Input value={appt.topic} onChange={(e) => setAppt({ ...appt, topic: e.target.value })} placeholder="Topic" maxLength={200} aria-label="Appointment topic" /><Button variant="outline" onClick={schedule}>Schedule</Button></div></div>
              </>)}
            </section>
          )}

          <section className="card-surface p-5">
            <h2 className="font-semibold">Messages</h2>
            <p className="text-xs text-muted-foreground">Private between the customer and the assigned professional. Support staff may open it only for disputes or open tickets, with a recorded reason.</p>
            {!conversationVisible ? (
              <div className="mt-4 rounded-lg bg-muted p-4 text-sm">
                {oversightEligible ? (
                  <>
                    <p className="font-medium">Conversation hidden</p>
                    <p className="mt-1 text-muted-foreground">This request is disputed or has an open ticket. Opening the conversation is logged in the audit log and lasts one hour.</p>
                    <div className="mt-3 flex gap-2"><Input value={convReason} onChange={(e) => setConvReason(e.target.value)} placeholder="Reason for reviewing the conversation" maxLength={500} aria-label="Reason for reviewing the conversation" /><Button variant="outline" onClick={openConversation}>Open conversation</Button></div>
                  </>
                ) : <p className="text-muted-foreground">Conversation hidden. Staff can only review messages on disputed requests or requests with an open support ticket or complaint.</p>}
              </div>
            ) : (<>
            <div className="mt-4 max-h-96 space-y-3 overflow-y-auto">
              {data!.messages.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
              {data!.messages.map((m) => (
                <div key={m.id} className={"max-w-[85%] rounded-xl p-3 text-sm " + (m.sender_id === user?.id ? "ml-auto bg-navy text-navy-foreground" : "bg-muted")}>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p className="mt-1 text-[11px] opacity-70">{m.sender_id === user?.id ? "You" : m.sender_id === req.customer_id ? "Customer" : m.sender_id === req.assigned_professional_id ? "Professional" : "LegalSetu support"} · {fmtDateTime(m.created_at)}</p>
                </div>
              ))}
            </div>
            {!["cancelled", "closed"].includes(req.status) && (isParty || isStaff) && (
              <div className="mt-4 flex gap-2">
                <Textarea rows={2} value={msg} maxLength={4000} onChange={(e) => setMsg(e.target.value)} placeholder="Write a message" aria-label="Message" />
                <Button onClick={send} aria-label="Send"><Send /></Button>
              </div>
            )}
            </>)}
          </section>
        </div>

        <div className="space-y-6">
          {isAssigned && accepted && proOptions.length > 0 && (
            <section className="card-surface space-y-3 p-5">
              <h2 className="font-semibold">Update status</h2>
              <div className="flex flex-wrap gap-2">{proOptions.map((s) => (
                <Button key={s} size="sm" variant={s === "completed" ? "accent" : "outline"} onClick={() => { if (s !== "completed" || confirm("Mark this work as completed?")) update({ status: s }, `Marked ${statusLabel(s)}`); }}>{s === "completed" ? "Mark work completed" : statusLabel(s)}</Button>
              ))}</div>
              <label className="text-sm text-muted-foreground">Next action for customer</label>
              <div className="flex gap-2"><Input value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder={req.next_action ?? "e.g. Upload PAN"} maxLength={200} aria-label="Next action" /><Button variant="outline" onClick={() => { update({ next_action: nextAction || null }); setNextAction(""); }}>Save</Button></div>
            </section>
          )}
          {isStaff && !isAssigned && (
            <section className="card-surface space-y-3 p-5">
              <h2 className="font-semibold">Manage</h2>
              <label className="text-sm text-muted-foreground">Status</label>
              <select className={selectCls} value={req.status} onChange={(e) => update({ status: e.target.value })} aria-label="Status">
                {!REQUEST_STATUSES.includes(req.status as never) && <option value={req.status}>{statusLabel(req.status)}</option>}
                {REQUEST_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
              </select>
              <label className="text-sm text-muted-foreground">Next action for customer</label>
              <div className="flex gap-2"><Input value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder={req.next_action ?? "e.g. Upload PAN"} maxLength={200} /><Button variant="outline" onClick={() => { update({ next_action: nextAction || null }); setNextAction(""); }}>Save</Button></div>
              <label className="text-sm text-muted-foreground">Assigned professional</label>
              <select className={selectCls} value={assignTo ?? req.assigned_professional_id ?? ""} onChange={(e) => setAssignTo(e.target.value)} aria-label="Assigned professional">
                <option value="">Unassigned</option>
                {(pros.data ?? []).filter((p) => p.verification_status === "approved" && !p.suspended || p.user_id === req.assigned_professional_id).map((p) => <option key={p.user_id} value={p.user_id}>{p.display_name} · {p.category}</option>)}
              </select>
              {assignTo !== null && assignTo !== (req.assigned_professional_id ?? "") && (
                <div className="grid gap-2">
                  {req.assigned_professional_id && <Input value={assignNote} onChange={(e) => setAssignNote(e.target.value)} placeholder="Reason for reassigning (required, logged)" maxLength={300} aria-label="Reason for reassigning" />}
                  <Button size="sm" variant="accent" onClick={reassign}>{req.assigned_professional_id ? "Reassign" : "Assign"}</Button>
                </div>
              )}
              {req.assignment_note && <p className="text-xs text-muted-foreground">Last assignment note: {req.assignment_note}</p>}
            </section>
          )}
          {isCustomer && customerCanClose(req.status) && (
            <section className="card-surface space-y-2 p-5">
              <p className="text-sm">The professional has marked this work as completed. If everything is in order, confirm to close the request. If not, raise a support ticket.</p>
              <Button variant="accent" className="w-full" onClick={() => update({ status: "closed" }, "Request closed")}>Confirm and close</Button>
            </section>
          )}
          {isCustomer && customerCanCancel(req.status) && (
            <Button variant="outline" className="w-full" onClick={() => { if (confirm("Cancel this request?")) update({ status: "cancelled" }, "Request cancelled"); }}>Cancel request</Button>
          )}
          <section className="card-surface p-5">
            <h2 className="font-semibold">Payments <span className="ml-1 rounded-full border border-warning/50 bg-warning/10 px-2 py-0.5 text-[11px] font-bold uppercase text-warning">Test mode</span></h2>
            <ul className="mt-3 space-y-2">
              {(payments.data ?? []).length === 0 && <li className="text-sm text-muted-foreground">No payment requests yet.</li>}
              {(payments.data ?? []).map((p) => (
                <li key={p.id}><Link to="/dashboard/payments/$id" params={{ id: p.id }} className="flex items-center justify-between gap-2 rounded-lg border p-2.5 text-sm hover:bg-muted">
                  <span className="min-w-0 truncate">{p.invoice_number ?? p.description}</span><span className="font-medium">{inr(p.total_paise)}</span><StatusPill status={p.status} /></Link></li>
              ))}
            </ul>
            {((isAssigned && accepted) || isStaff) && !["cancelled", "closed"].includes(req.status) && (
              <div className="mt-4 grid gap-2 border-t pt-4">
                <p className="text-xs text-muted-foreground">Request payment. Enter your professional fee as agreed with the client — it is passed on in full. LegalSetu's platform fee and its GST are added as separate lines automatically.</p>
                <Input value={pf.desc} onChange={(e) => setPf({ ...pf, desc: e.target.value })} placeholder="Description (optional)" maxLength={200} aria-label="Payment description" />
                <div className="grid grid-cols-3 gap-2">
                  <Input type="number" min={0} value={pf.fee} onChange={(e) => setPf({ ...pf, fee: e.target.value })} placeholder="Professional fee ₹" aria-label="Professional fee" />
                  <Input type="number" min={0} value={pf.tax} onChange={(e) => setPf({ ...pf, tax: e.target.value })} placeholder="Tax on fee ₹" aria-label="Tax on professional fee" />
                  <Input type="number" min={0} value={pf.gov} onChange={(e) => setPf({ ...pf, gov: e.target.value })} placeholder="Govt fee ₹" aria-label="Government fee" />
                </div>
                <Button size="sm" variant="outline" onClick={raisePayment}>Send payment request</Button>
              </div>
            )}
          </section>
          <section className="card-surface p-5">
            <h2 className="font-semibold">Required documents</h2>
            {serviceDocs.length > 0 && (<>
              <p className="mt-2 text-xs text-muted-foreground">Usually needed for this service</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">{serviceDocs.map((d) => <li key={d}>{d}</li>)}</ul>
            </>)}
            <p className="mt-3 text-xs text-muted-foreground">Requested by your professional</p>
            <ul className="mt-1 space-y-2">
              {data!.docReqs.length === 0 && <li className="text-sm text-muted-foreground">No specific requests yet.</li>}
              {data!.docReqs.map((r) => (
                <li key={r.id} className="flex items-center gap-2 text-sm">
                  {r.status === "fulfilled" ? <CheckCircle2 className="h-4 w-4 text-accent" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                  <span className="flex-1">{r.label}{r.status === "waived" ? " (not needed)" : ""}</span>
                  {isCustomer && r.status === "open" && (
                    <label className={"inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs " + (busy ? "opacity-50" : "")}>
                      <Upload className="h-3 w-3" />Upload
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="sr-only" disabled={busy} aria-label={`Upload ${r.label}`} onChange={(e) => { fulfil(r.id, r.label, e.target.files); e.target.value = ""; }} />
                    </label>
                  )}
                  {(isAssigned || isStaff) && r.status === "open" && <Button size="sm" variant="ghost" onClick={async () => { const { error } = await supabase.from("document_requests").update({ status: "waived" }).eq("id", r.id); if (error) toast.error(error.message); else refresh(); }}>Waive</Button>}
                </li>
              ))}
            </ul>
          </section>
          <section className="card-surface p-5">
            <h2 className="font-semibold">Documents</h2>
            <div className="mt-3 space-y-2">
              {data!.docs.length === 0 && <p className="text-sm text-muted-foreground">No documents linked.</p>}
              {!isParty && data!.docs.length > 0 && (
                <Input value={docReason} onChange={(e) => setDocReason(e.target.value)} placeholder="Reason for opening (required, logged)" maxLength={500} aria-label="Reason for opening documents" />
              )}
              {data!.docs.map((d) => (
                <button key={d.id} onClick={() => openDoc(d)} className="flex w-full items-center gap-2 rounded-lg border p-2.5 text-left text-sm hover:bg-muted">
                  <FileText className="h-4 w-4 text-accent" /><span className="truncate">{d.file_name}</span>
                </button>
              ))}
            </div>
            {isCustomer && <Button asChild variant="outline" size="sm" className="mt-3"><Link to="/dashboard/documents" search={{ request: id }}>Upload more</Link></Button>}
          </section>
          <section className="card-surface p-5">
            <h2 className="font-semibold">Appointments</h2>
            <ul className="mt-3 space-y-2">
              {data!.appts.length === 0 && <li className="text-sm text-muted-foreground">No appointments for this request.</li>}
              {data!.appts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg border p-2.5 text-sm">
                  <div><p className="font-medium">{a.topic}</p><p className="text-xs text-muted-foreground">{fmtDateTime(a.preferred_at)} · {a.mode}</p></div>
                  <StatusPill status={a.status} />
                </li>
              ))}
            </ul>
          </section>
          <section className="card-surface p-5">
            <h2 className="font-semibold">Status history</h2>
            <ol className="mt-3 space-y-3 border-l pl-4">
              {data!.history.map((h) => (
                <li key={h.id} className="relative text-sm"><span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-accent" />
                  <p className="font-medium">{statusLabel(h.status)}</p>
                  <p className="text-xs text-muted-foreground">{fmtDateTime(h.created_at)} · {!h.changed_by ? "System" : h.changed_by === user?.id ? "You" : h.changed_by === req.customer_id ? "Customer" : h.changed_by === req.assigned_professional_id ? "Professional" : "LegalSetu team"}</p></li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </>
  );
}

function D({ k, v }: { k: string; v: React.ReactNode }) {
  return <div><dt className="text-xs capitalize text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>;
}
