import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashHeader, Stat, fmtDate, fmtDateTime } from "@/components/dash/DashShell";
import { StatusPill } from "@/components/site/bits";
import { Button } from "@/components/ui/button";
import { ClipboardList, CheckCircle2, Timer, XCircle } from "lucide-react";
import { Section, Empty, Row, Field, TestTag, RequestRow, Timeline, DeniedOrMissing, type ReqRow, type TimelineItem } from "@/components/dash/CrmBits";
import { inr, isTestRecord } from "@/lib/crm";
import { proStats } from "@/lib/crm-stats";

export const Route = createFileRoute("/_authenticated/admin/professionals_/$id")({ component: ProDetail });

type L = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function ProDetail() {
  const { id } = Route.useParams();
  const { data, error, isLoading } = useQuery({
    queryKey: ["crm-pro", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("crm_pro_detail", { _uid: id });
      if (error) throw error;
      return data as L | null;
    },
    retry: false,
  });
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading professional…</p>;
  if (error || !data) return <DeniedOrMissing missing={!error} />;
  const p = data.profile as L;
  const reqs = data.requests as (ReqRow & L)[];
  const s = proStats(reqs, data.contacts as L[] as never);
  const test = isTestRecord(p.display_name, p.registration_details, p.email);
  const tl: TimelineItem[] = [
    { at: p.created_at, label: "Profile created" },
    ...(data.verification as L[]).map((v) => ({ at: v.created_at, label: `Verification: ${v.from_status ?? "—"} → ${v.to_status}` })),
    ...(data.credential_checks as L[]).map((c) => ({ at: c.created_at, label: `Credential check (${c.method}): ${c.outcome}` })),
    ...reqs.flatMap((r) => [
      ...(r.accepted_at ? [{ at: r.accepted_at, label: `Accepted ${r.reference}`, to: { id: r.id } }] : []),
      ...(r.completed_at ? [{ at: r.completed_at, label: `Completed ${r.reference}`, to: { id: r.id } }] : []),
    ]),
    ...(data.contacts as L[]).map((c) => ({ at: c.decided_at ?? c.created_at, label: `Contact request from ${c.client_name ?? "client"}: ${c.status}` })),
    ...(data.ledger as L[]).map((l) => ({ at: l.created_at, label: `Credits ${l.delta > 0 ? "+" : ""}${l.delta} (${l.kind})` })),
    ...(data.restrictions as L[]).map((r) => ({ at: r.starts_at, label: "Temporary restriction started" })),
    ...(data.appeals as L[]).map((a) => ({ at: a.created_at, label: `Appeal: ${a.subject}` })),
  ];
  const acct = p.suspended || p.account_suspended ? "Suspended" : p.restricted ? "Temporarily restricted" : "Active";
  return (
    <>
      <DashHeader title={p.display_name} subtitle="Professional record (administrators only). Figures are informational; nothing here approves, suspends or penalises automatically."
        action={<div className="flex gap-2"><Button asChild variant="outline"><Link to="/admin/professionals">All professionals</Link></Button><Button asChild variant="outline"><Link to="/admin/verification">Verification queue</Link></Button></div>} />
      {test && <p className="mb-4 rounded-lg border bg-card p-3 text-sm font-medium">TEST account — not real business activity.</p>}
      <div className="card-surface grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Professional ID" value={<span className="font-mono text-xs">{p.user_id}</span>} />
        <Field label="Profession" value={p.category} />
        <Field label="Verification" value={<StatusPill status={p.verification_status} />} />
        <Field label="Account" value={acct} />
        <Field label="Public listing" value={p.is_listed ? <Link to="/professionals/$id" params={{ id: p.user_id }} className="text-accent hover:underline">Listed — view profile</Link> : "Not listed"} />
        <Field label="Profile submitted" value={fmtDate(p.created_at)} />
        <Field label="Last recorded action" value={data.last_activity ? fmtDateTime(data.last_activity) : "Not available"} />
        <Field label="Contact credits balance" value={data.credit_balance} />
        <Field label="Email" value={p.email} />
        <Field label="Phone" value={p.phone} />
        <Field label="Registration" value={p.registration_details} />
        <Field label="Location" value={[p.city, p.state].filter(Boolean).join(", ") || null} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Assigned requests" value={s.assigned} icon={ClipboardList} />
        <Stat label="Accepted / in progress" value={`${s.accepted} / ${s.inProgress}`} icon={CheckCircle2} />
        <Stat label="Completed / cancelled" value={`${s.completed} / ${s.cancelled}`} icon={XCircle} />
        <Stat label="Median reply to contact" value={s.medianReplyHours == null ? "Not enough data" : (s.medianReplyHours < 1 ? `${Math.round(s.medianReplyHours * 60)} min` : `${s.medianReplyHours} h`)} icon={Timer} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Reply time uses contact requests with a recorded decision time; replies under 60 seconds are treated as automated test activity and ignored. Completion time: {s.medianCompletionDays == null ? "not enough data" : `median ${s.medianCompletionDays} day(s) from request to completion`}.</p>

      <Section title="Credential checks" count={data.credential_checks.length}>
        {data.credential_checks.length === 0 ? <Empty /> : (data.credential_checks as L[]).map((c) => <Row key={c.id}><span>{c.method} · ref {c.reference} · checked {fmtDate(c.checked_on)}</span><span>{c.outcome}</span></Row>)}
      </Section>
      <Section title="Verification history" count={data.verification.length}>
        {data.verification.length === 0 ? <Empty /> : (data.verification as L[]).map((v) => <Row key={v.id}><span>{v.from_status ?? "—"} → <strong>{v.to_status}</strong>{v.note ? ` · ${v.note}` : ""}</span><span className="text-muted-foreground">{fmtDateTime(v.created_at)}</span></Row>)}
      </Section>

      <Section title="Assigned requests" count={reqs.length}>
        {reqs.length === 0 ? <Empty /> : reqs.map((r) => <RequestRow key={r.id} r={r} who={<>Client: <Link to="/admin/customers/$id" params={{ id: r.client_id }} className="hover:underline">{r.client_name ?? "Client"}</Link>{r.accepted_at ? " · accepted" : " · awaiting acceptance"}</>} />)}
      </Section>

      <Section title="Contact requests and conversations" count={data.contacts.length}>
        {data.contacts.length === 0 ? <Empty /> : (data.contacts as L[]).map((c) => (
          <Row key={c.id}><span><Link to="/admin/customers/$id" params={{ id: c.client_id }} className="font-medium hover:underline">{c.client_name ?? "Client"}</Link> · {c.initiated_by === "professional" ? "pro-initiated" : "client-initiated"} · {fmtDate(c.created_at)}{c.conversation_id && ` · conversation ${c.closed ? "closed" : "open"}, ${c.message_count} message(s)`}</span><StatusPill status={c.status} /></Row>
        ))}
      </Section>

      <Section title="Payments, credit purchases and fee records" count={data.payments.length + data.orders.length + data.ledger.length}>
        {data.payments.length + data.orders.length + data.ledger.length === 0 ? <Empty /> : <>
          {(data.payments as L[]).map((x) => <Row key={x.id}><span><Link to="/dashboard/payments/$id" params={{ id: x.id }} className="font-medium hover:underline">{x.description}</Link> · {x.reference} · {inr(x.total_paise)}<TestTag on={x.test_mode} /></span><span>{x.status.replace(/_/g, " ")}</span></Row>)}
          {(data.orders as L[]).map((o) => <Row key={o.id}><span>Credit purchase · {o.credits} credit(s) · {inr(o.amount_paise)}<TestTag on={o.test_mode} /></span><span>{o.status}</span></Row>)}
          {(data.ledger as L[]).map((l) => <Row key={l.id}><span>Ledger · {l.kind} · {l.delta > 0 ? "+" : ""}{l.delta} credit(s){l.note ? ` · ${l.note}` : ""}<TestTag on={isTestRecord(l.note)} /></span><span className="text-muted-foreground">{fmtDate(l.created_at)}</span></Row>)}
        </>}
      </Section>

      <Section title="Complaints, reports, reviews, restrictions and appeals" count={data.complaints.length + data.reports_about.length + data.reviews.length + data.restrictions.length + data.appeals.length}>
        {data.complaints.length + data.reports_about.length + data.reviews.length + data.restrictions.length + data.appeals.length === 0 ? <Empty /> : <>
          {(data.complaints as L[]).map((t) => <Row key={t.id}><span>Complaint · {t.subject} · {fmtDate(t.created_at)}</span><StatusPill status={t.status} /></Row>)}
          {(data.reports_about as L[]).map((r) => <Row key={r.id}><span>Report · {r.reason_code.replace(/_/g, " ")} · {fmtDate(r.created_at)}</span><span>{r.status}</span></Row>)}
          {(data.reviews as L[]).map((r) => <Row key={r.id}><span>Review · {r.rating}★ · {fmtDate(r.created_at)}</span><span>{r.status}</span></Row>)}
          {(data.restrictions as L[]).map((r) => <Row key={r.id}><span>Restriction · {r.reason} · until {fmtDateTime(r.ends_at)}</span><span>{r.lifted_at ? "Lifted" : new Date(r.ends_at) > new Date() ? "Active" : "Expired"}</span></Row>)}
          {(data.appeals as L[]).map((a) => <Row key={a.id}><span>Appeal · {a.subject}</span><span>{a.status.replace("_", " ")}</span></Row>)}
        </>}
        <div className="p-3 text-sm"><Link to="/admin/trust" className="text-accent hover:underline">Manage in Trust & safety</Link></div>
      </Section>

      <Timeline items={tl} />
    </>
  );
}
