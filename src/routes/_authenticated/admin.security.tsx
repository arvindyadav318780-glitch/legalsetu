import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DashHeader, Stat, fmtDateTime } from "@/components/dash/DashShell";
import { EmptyState } from "@/components/site/bits";
import { selectCls } from "@/components/site/LocationSelect";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { filterHealth, type HealthRow } from "@/lib/security-events";
import { AlertTriangle, Bug, CreditCard, ShieldX } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/security")({ component: Security });

const TYPES: Record<string, string> = {
  permission_denied: "Permission denied", suspicious_activity: "Suspicious activity", app_error: "Application error",
  risk_alert: "Risk alert", abuse_report: "Abuse report", payment_failure: "Payment failure", webhook: "Payment webhook",
};

function Security() {
  const { isAdmin } = useAuth();
  const [f, setF] = useState({ type: "", severity: "", from: "", to: "", test: "all" as "all" | "real" | "test" });
  const { data, isLoading } = useQuery({
    queryKey: ["admin-security"],
    enabled: isAdmin,
    queryFn: async () => {
      const [ev, ra, ar, pay, ord, pe, people] = await Promise.all([
        supabase.from("security_events").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("risk_alerts").select("id,user_id,kind,status,created_at").order("created_at", { ascending: false }).limit(300),
        supabase.from("abuse_reports").select("id,target_user_id,reason,status,created_at").order("created_at", { ascending: false }).limit(300),
        supabase.from("payments").select("id,customer_id,status,failure_reason,test_mode,created_at,updated_at").in("status", ["failed", "cancelled"]).limit(300),
        supabase.from("credit_orders").select("id,professional_id,status,failure_reason,test_mode,created_at").eq("status", "failed").limit(300),
        supabase.from("payment_events").select("id,event_type,outcome,received_at").order("received_at", { ascending: false }).limit(300),
        supabase.from("profiles").select("id,full_name").limit(2000),
      ]);
      const testUser = (id: string | null) => !!id && /test/i.test(people.data?.find((p) => p.id === id)?.full_name ?? "");
      const rows: HealthRow[] = [
        ...(ev.data ?? []).map((e) => ({ id: "e" + e.id, at: e.created_at, type: e.kind, severity: e.severity as HealthRow["severity"], title: e.area || TYPES[e.kind], detail: e.summary, test: e.is_test })),
        ...(ra.data ?? []).map((r) => ({ id: "r" + r.id, at: r.created_at, type: "risk_alert", severity: "high" as const, title: r.kind.replace(/_/g, " "), detail: `Status: ${r.status}`, test: testUser(r.user_id) })),
        ...(ar.data ?? []).map((r) => ({ id: "a" + r.id, at: r.created_at, type: "abuse_report", severity: "medium" as const, title: "User reported", detail: `${r.reason.slice(0, 80)} · ${r.status}`, test: testUser(r.target_user_id) })),
        ...(pay.data ?? []).map((p) => ({ id: "p" + p.id, at: p.updated_at, type: "payment_failure", severity: "medium" as const, title: `Service payment ${p.status}`, detail: p.failure_reason ?? "", test: p.test_mode })),
        ...(ord.data ?? []).map((o) => ({ id: "o" + o.id, at: o.created_at, type: "payment_failure", severity: "medium" as const, title: "Credit-pack payment failed", detail: o.failure_reason ?? "", test: o.test_mode })),
        // Only test credentials are configured, so every provider event is a test event.
        ...(pe.data ?? []).filter((e) => /fail/.test(e.event_type + (e.outcome ?? ""))).map((e) => ({ id: "w" + e.id, at: e.received_at, type: "webhook", severity: "low" as const, title: e.event_type, detail: e.outcome ?? "recorded", test: true })),
      ];
      return rows;
    },
  });
  if (!isAdmin) return <EmptyState title="Administrators only" body="Security events are visible only to administrators." action={<Button asChild><Link to="/admin">Back</Link></Button>} />;
  const rows = filterHealth(data ?? [], f);
  const all = data ?? [];
  const count = (t: string) => all.filter((r) => r.type === t).length;
  return (
    <>
      <DashHeader title="Security & platform health" subtitle="Permission denials, suspicious activity, application errors and payment failures. Passwords, tokens and contact details are never recorded." />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Permission denied" value={count("permission_denied")} icon={ShieldX} />
        <Stat label="Suspicious / risk" value={count("suspicious_activity") + count("risk_alert") + count("abuse_report")} icon={AlertTriangle} />
        <Stat label="Application errors" value={count("app_error")} icon={Bug} />
        <Stat label="Payment failures" value={count("payment_failure") + count("webhook")} icon={CreditCard} />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <select aria-label="Event type" className={selectCls + " w-52"} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="">All types</option>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select aria-label="Minimum severity" className={selectCls + " w-44"} value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })}><option value="">Any severity</option><option value="medium">Medium and high</option><option value="high">High only</option></select>
        <select aria-label="Real or test" className={selectCls + " w-44"} value={f.test} onChange={(e) => setF({ ...f, test: e.target.value as typeof f.test })}><option value="all">Real and test</option><option value="real">Real only</option><option value="test">Test only</option></select>
        <Input aria-label="From date" type="date" className="w-44" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
        <Input aria-label="To date" type="date" className="w-44" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : rows.length === 0 ? <EmptyState title="No events match" /> : (
        <div className="card-surface overflow-x-auto">
          <table className="w-full text-sm"><thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="p-3">When</th><th className="p-3">Type</th><th className="p-3">Severity</th><th className="p-3">Event</th><th className="p-3">Details</th><th className="p-3">Source</th></tr></thead>
            <tbody className="divide-y">{rows.map((r) => (
              <tr key={r.id}>
                <td className="p-3 whitespace-nowrap text-muted-foreground">{fmtDateTime(r.at)}</td>
                <td className="p-3">{TYPES[r.type] ?? r.type}</td>
                <td className="p-3 capitalize">{r.severity}</td>
                <td className="p-3 font-medium">{r.title}</td>
                <td className="p-3 text-muted-foreground">{r.detail}</td>
                <td className="p-3"><span className={"rounded border px-2 py-0.5 text-xs " + (r.test ? "border-dashed text-muted-foreground" : "font-semibold")}>{r.test ? "TEST" : "Real"}</span></td>
              </tr>))}</tbody></table>
        </div>
      )}
    </>
  );
}
