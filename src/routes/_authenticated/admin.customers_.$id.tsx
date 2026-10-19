import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashHeader, fmtDate, fmtDateTime } from "@/components/dash/DashShell";
import { StatusPill } from "@/components/site/bits";
import { ProLink } from "@/components/site/ProAvatar";
import { Button } from "@/components/ui/button";
import { Section, Empty, Row, Field, TestTag, RequestRow, Timeline, DeniedOrMissing, type ReqRow, type TimelineItem } from "@/components/dash/CrmBits";
import { inr, isTestRecord } from "@/lib/crm";
import { statusLabel } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/admin/customers_/$id")({ component: ClientDetail });

type L = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function ClientDetail() {
  const { id } = Route.useParams();
  const { data, error, isLoading } = useQuery({
    queryKey: ["crm-client", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("crm_client_detail", { _uid: id });
      if (error) throw error;
      return data as L | null;
    },
    retry: false,
  });
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading client…</p>;
  if (error || !data) return <DeniedOrMissing missing={!error} />;
  const p = data.profile as L;
  const reqs = data.requests as (ReqRow & L)[];
  const test = isTestRecord(p.full_name, p.email);
  const tl: TimelineItem[] = [
    { at: p.created_at, label: "Account registered" },
    ...(data.history as L[]).map((h) => ({ at: h.at, label: `${h.reference}: ${statusLabel(h.status)}`, to: { id: h.request_id } })),
    ...(data.contacts as L[]).map((c) => ({ at: c.created_at, label: `Contact request to ${c.pro_name ?? "professional"} (${c.status})` })),
    ...(data.tickets as L[]).map((t) => ({ at: t.created_at, label: `Ticket: ${t.subject}` })),
    ...(data.payments as L[]).map((x) => ({ at: x.created_at, label: `Payment ${inr(x.total_paise)} (${x.status})${x.test_mode ? " · TEST" : ""}` })),
    ...(data.restrictions as L[]).map((r) => ({ at: r.starts_at, label: "Temporary restriction started" })),
    ...(data.appeals as L[]).map((a) => ({ at: a.created_at, label: `Appeal: ${a.subject}` })),
  ];
  const status = p.suspended ? "Suspended" : p.restricted ? "Temporarily restricted" : "Active";
  return (
    <>
      <DashHeader title={p.full_name || "Unnamed client"} subtitle="Client record (administrators only). Message content and documents are not shown here." action={<Button asChild variant="outline"><Link to="/admin/customers">All customers</Link></Button>} />
      {test && <p className="mb-4 rounded-lg border bg-card p-3 text-sm font-medium">TEST account — not real business activity.</p>}
      <div className="card-surface grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Account ID" value={<span className="font-mono text-xs">{p.id}</span>} />
        <Field label="Status" value={status} />
        <Field label="Registered" value={fmtDate(p.created_at)} />
        <Field label="Last recorded action" value={data.last_activity ? fmtDateTime(data.last_activity) : "Not available"} />
        <Field label="Email" value={p.email} />
        <Field label="Phone" value={p.phone} />
        <Field label="Location" value={[p.city, p.state].filter(Boolean).join(", ") || null} />
        <Field label="Roles" value={(p.roles ?? []).join(", ")} />
      </div>

      <Section title="Requests" count={reqs.length}>
        {reqs.length === 0 ? <Empty /> : reqs.map((r) => <RequestRow key={r.id} r={r} who={r.professional_id ? <ProLink id={r.professional_id}>{r.pro_name ?? "Professional"}</ProLink> : "Unassigned"} />)}
      </Section>

      <Section title="Contact requests and conversations" count={data.contacts.length}>
        {data.contacts.length === 0 ? <Empty /> : (data.contacts as L[]).map((c) => (
          <Row key={c.id}><span>{c.professional_id ? <Link to="/admin/professionals/$id" params={{ id: c.professional_id }} className="font-medium hover:underline">{c.pro_name ?? "Professional"}</Link> : "—"} · sent {fmtDate(c.created_at)}{c.conversation_id && ` · conversation ${c.closed ? "closed" : "open"}, ${c.message_count} message(s)`}</span><StatusPill status={c.status} /></Row>
        ))}
      </Section>

      <Section title="Payments and invoices" count={data.payments.length + data.invoices.length}>
        {data.payments.length + data.invoices.length === 0 ? <Empty /> : <>
          {(data.payments as L[]).map((x) => <Row key={x.id}><span><Link to="/dashboard/payments/$id" params={{ id: x.id }} className="font-medium hover:underline">{x.invoice_number ?? x.description}</Link> · {x.reference} · {inr(x.total_paise)}{x.refunded_paise ? ` · refunded ${inr(x.refunded_paise)}` : ""}<TestTag on={x.test_mode} /></span><span>{x.status.replace(/_/g, " ")}</span></Row>)}
          {(data.invoices as L[]).map((x) => <Row key={x.id}><span>{x.description} · {inr(x.amount_paise)}<TestTag on={x.test_mode} /></span><span>{x.status}</span></Row>)}
        </>}
      </Section>

      <Section title="Support tickets and complaints" count={data.tickets.length}>
        {data.tickets.length === 0 ? <Empty /> : (data.tickets as L[]).map((t) => <Row key={t.id}><span>{t.subject} · {t.kind.replace("_", " ")} · {fmtDate(t.created_at)} {t.request_id && <Link to="/dashboard/requests/$id" params={{ id: t.request_id }} className="text-accent hover:underline">request</Link>}</span><StatusPill status={t.status} /></Row>)}
      </Section>

      <Section title="Reports, restrictions and appeals" count={data.reports_made.length + data.reports_about.length + data.restrictions.length + data.appeals.length}>
        {data.reports_made.length + data.reports_about.length + data.restrictions.length + data.appeals.length === 0 ? <Empty /> : <>
          {(data.reports_about as L[]).map((r) => <Row key={r.id}><span>Reported by another user · {r.reason_code.replace(/_/g, " ")} · {fmtDate(r.created_at)}</span><span>{r.status}</span></Row>)}
          {(data.reports_made as L[]).map((r) => <Row key={r.id}><span>Report made · {r.reason_code.replace(/_/g, " ")} · {fmtDate(r.created_at)}</span><span>{r.status}</span></Row>)}
          {(data.restrictions as L[]).map((r) => <Row key={r.id}><span>Restriction · {r.reason} · until {fmtDateTime(r.ends_at)}</span><span>{r.lifted_at ? "Lifted" : new Date(r.ends_at) > new Date() ? "Active" : "Expired"}</span></Row>)}
          {(data.appeals as L[]).map((a) => <Row key={a.id}><span>Appeal · {a.subject} · {fmtDate(a.created_at)}</span><span>{a.status.replace("_", " ")}</span></Row>)}
        </>}
        <div className="p-3 text-sm"><Link to="/admin/trust" className="text-accent hover:underline">Manage in Trust & safety</Link></div>
      </Section>

      <Timeline items={tl} />
    </>
  );
}
