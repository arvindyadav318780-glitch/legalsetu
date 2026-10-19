import { useQuery } from "@tanstack/react-query";
import { ProLink } from "@/components/site/ProAvatar";
import { supabase } from "@/integrations/supabase/client";
import { inr } from "@/lib/fees";
import { fmtDateTime } from "@/components/dash/DashShell";
import { EmptyState } from "@/components/site/bits";
import { classifyConnections, summarizeConnections } from "@/lib/marketplace";

const LABEL = { billable: "New unique client — platform fee applies", already_connected: "Already connected — no extra fee", not_billable: "No fee" } as const;

/** Stable, non-identifying lead reference derived from the client–professional pair (the billing unit). */
export function leadId(pairKey: string) { let h = 0; for (const ch of pairKey) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return "LD-" + h.toString(36).toUpperCase().padStart(7, "0"); }
/** Hides emails, phone/WhatsApp numbers and links a client may have typed into a lead summary. */
export function redact(t: string) { return t.replace(/[^\s@]+@[^\s@]+/g, "[hidden]").replace(/\+?\d[\d\s-]{7,}\d/g, "[hidden]").replace(/https?:\/\/\S+/g, "[hidden]").slice(0, 160); }

function Notice({ active, pricePaise }: { active: boolean; pricePaise: number }) {
  return (
    <div className="mb-4 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
      <strong>{active ? "Fee collection ON (test mode)." : "Fee collection is OFF."}</strong> LegalSetu's proposed platform fee is {inr(pricePaise)} per new, unique client connected — charged to the professional once, when the conversation opens. Extra messages or new requests from the same client are free. Declined, pending or failed requests are never charged. LegalSetu takes no percentage of professional fees.
      {!active && " Amounts below are what would apply; nothing is collected until legal review is recorded."}
    </div>
  );
}

/** Professional view: each client request with its connection status and fee. */
export function ProConnectionFees({ userId, active, pricePaise }: { userId: string; active: boolean; pricePaise: number }) {
  const { data = [] } = useQuery({
    queryKey: ["pro-connections", userId],
    queryFn: async () => (await supabase.from("contact_requests").select("id,client_id,professional_id,status,created_at,decided_at,message,pair_key").eq("professional_id", userId).order("created_at", { ascending: false }).limit(500)).data ?? [],
  });
  const { data: info = [], isLoading: infoLoading } = useQuery({
    queryKey: ["pro-lead-info", userId],
    queryFn: async () => (await supabase.rpc("pro_lead_summaries")).data ?? [],
  });
  const infoFor = (id: string) => info.find((x) => x.contact_request_id === id);
  const cls = classifyConnections(data);
  const s = summarizeConnections(data, pricePaise);
  const me = s.perPro[0];
  return (
    <section className="mb-6">
      <h2 className="mb-2 font-semibold">Lead Unlock Fee — {inr(pricePaise)} per eligible unique client</h2>
      <Notice active={active} pricePaise={pricePaise} />
      <div className="mb-3 grid gap-3 text-sm sm:grid-cols-3">
        <div className="card-surface p-3"><p className="text-muted-foreground">Unique clients connected</p><p className="text-xl font-semibold">{me?.clients ?? 0}</p></div>
        <div className="card-surface p-3"><p className="text-muted-foreground">{active ? "Platform fees" : "Fees if active"}</p><p className="text-xl font-semibold">{inr(me?.feePaise ?? 0)}</p></div>
        <div className="card-surface p-3"><p className="text-muted-foreground">Not charged (declined / pending / repeat)</p><p className="text-xl font-semibold">{(me?.declined ?? 0) + (me?.pending ?? 0) + (me?.repeat ?? 0)}</p></div>
      </div>
      {data.length === 0 ? <EmptyState title="No client requests yet" /> : (
        <div className="card-surface divide-y text-sm">{data.map((r) => {
          const c = cls.get(r.id) ?? "not_billable";
          return (
            <div key={r.id} className="flex flex-wrap items-center gap-3 p-3">
              <span className="min-w-0 flex-1"><span className="font-mono text-xs">Lead {leadId(r.pair_key)}</span> · <span className="capitalize">{r.status}</span><span className="block text-xs">{infoLoading ? <span className="text-muted-foreground">Loading lead details…</span> : [infoFor(r.id)?.service_name ?? "Direct contact", infoFor(r.id)?.city ? `near ${infoFor(r.id)!.city}` : null, infoFor(r.id)?.urgency ? `urgency: ${infoFor(r.id)!.urgency!.replace(/_/g, " ")}` : null].filter(Boolean).join(" · ")}</span><span className="block truncate text-xs text-muted-foreground">{redact(r.message)}</span><span className="block text-xs text-muted-foreground">{LABEL[c]}</span></span>
              <span className="font-medium tabular-nums">{c === "billable" ? inr(pricePaise) : inr(0)}</span>
              <span className="text-xs text-muted-foreground">{fmtDateTime(r.decided_at ?? r.created_at)}</span>
            </div>
          );
        })}</div>
      )}
    </section>
  );
}

type Order = { professional_id: string; status: string; amount_paise: number };
type Refund = { professional_id: string; status: string; amount_paise: number };

/** Admin view: per-professional connected clients, billable connections, fees, payments, failures, refunds and monthly totals. */
export function AdminConnectionFees({ active, pricePaise, orders, refunds }: { active: boolean; pricePaise: number; orders: Order[]; refunds: Refund[] }) {
  const { data } = useQuery({
    queryKey: ["admin-connections"],
    queryFn: async () => {
      const [cr, pp] = await Promise.all([
        supabase.from("contact_requests").select("id,client_id,professional_id,status,created_at,decided_at").limit(5000),
        supabase.from("professional_profiles").select("user_id,display_name,category"),
      ]);
      return { cr: cr.data ?? [], names: new Map((pp.data ?? []).map((p) => [p.user_id, `${p.display_name} · ${p.category}`])) };
    },
  });
  const s = summarizeConnections(data?.cr ?? [], pricePaise);
  const sum = (rows: { amount_paise: number }[]) => rows.reduce((a, r) => a + r.amount_paise, 0);
  return (
    <section className="mb-6">
      <h2 className="mb-2 font-semibold">{inr(pricePaise)} connection fees by professional</h2>
      <Notice active={active} pricePaise={pricePaise} />
      {s.perPro.length === 0 ? <EmptyState title="No contact requests yet" /> : (
        <div className="card-surface mb-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr>{["Professional", "Connected clients", "Billable", "Fees", "Paid", "Failed", "Refunded", "Not charged"].map((h) => <th key={h} className="p-3 font-medium">{h}</th>)}</tr></thead>
            <tbody className="divide-y">{s.perPro.map((p) => {
              const o = orders.filter((x) => x.professional_id === p.pro), rf = refunds.filter((x) => x.professional_id === p.pro && x.status === "processed");
              return (
                <tr key={p.pro}>
                  <td className="p-3"><ProLink id={p.pro}>{data?.names.get(p.pro) ?? p.pro.slice(0, 8)}</ProLink></td>
                  <td className="p-3 tabular-nums">{p.clients}</td>
                  <td className="p-3 tabular-nums">{p.billable}</td>
                  <td className="p-3 tabular-nums">{inr(p.feePaise)}</td>
                  <td className="p-3 tabular-nums">{inr(sum(o.filter((x) => x.status === "successful" || x.status === "refunded")))}</td>
                  <td className="p-3 tabular-nums">{o.filter((x) => x.status === "failed").length}</td>
                  <td className="p-3 tabular-nums">{inr(sum(rf))}</td>
                  <td className="p-3 tabular-nums">{p.declined + p.pending + p.repeat}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
      <h3 className="mb-2 text-sm font-semibold">Monthly totals</h3>
      {s.monthly.length === 0 ? <EmptyState title="No billable connections yet" /> : (
        <div className="card-surface divide-y text-sm">{s.monthly.map((m) => (
          <div key={m.month} className="flex justify-between gap-3 p-3"><span>{m.month}</span><span>{m.billable} new connections · <strong>{inr(m.feePaise)}</strong>{active ? "" : " (not collected)"}</span></div>
        ))}</div>
      )}
    </section>
  );
}
