import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashHeader, fmtDateTime } from "@/components/dash/DashShell";
import { EmptyState } from "@/components/site/bits";
import { selectCls } from "@/components/site/LocationSelect";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/audit")({ component: Audit });

function Audit() {
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const { data } = useQuery({
    queryKey: ["audit", from, to],
    queryFn: async () => {
      let q = supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(1000);
      if (from) q = q.gte("created_at", new Date(from).toISOString());
      if (to) { const d = new Date(to); d.setDate(d.getDate() + 1); q = q.lt("created_at", d.toISOString()); }
      const [l, p] = await Promise.all([q, supabase.rpc("staff_directory")]);
      return { logs: l.data ?? [], people: p.data ?? [] };
    },
  });
  const name = (id: string | null) => { if (!id) return "System"; const p = data?.people.find((x) => x.id === id); return p?.full_name || p?.email || id.slice(0, 8); };
  const actions = [...new Set((data?.logs ?? []).map((l) => l.action.split(".")[0]))].sort();
  const actors = [...new Set((data?.logs ?? []).map((l) => l.actor_id ?? ""))];
  const logs = (data?.logs ?? []).filter((l) => (!actor || (l.actor_id ?? "") === actor) && (!action || l.action.startsWith(action + ".")) && (!q || `${l.action} ${l.target ?? ""}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <>
      <DashHeader title="Audit log" subtitle="Administrative actions, recorded automatically. Entries cannot be edited or deleted." />
      <div className="mb-4 flex flex-wrap gap-2">
        <select aria-label="Filter by person" className={selectCls + " w-52"} value={actor} onChange={(e) => setActor(e.target.value)}><option value="">Everyone</option>{actors.map((a) => <option key={a} value={a}>{name(a || null)}</option>)}</select>
        <select aria-label="Filter by action" className={selectCls + " w-52"} value={action} onChange={(e) => setAction(e.target.value)}><option value="">All actions</option>{actions.map((a) => <option key={a}>{a}</option>)}</select>
        <Input aria-label="Search" placeholder="Search action or record" className="w-56" value={q} onChange={(e) => setQ(e.target.value)} />
        <Input aria-label="From date" type="date" className="w-44" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input aria-label="To date" type="date" className="w-44" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      {logs.length === 0 ? <EmptyState title="No entries" /> : (
        <div className="card-surface overflow-x-auto">
          <table className="w-full text-sm"><thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="p-3">When</th><th className="p-3">Action</th><th className="p-3">Target</th><th className="p-3">By</th></tr></thead>
            <tbody className="divide-y">{logs.map((l) => <tr key={l.id}><td className="p-3 text-muted-foreground">{fmtDateTime(l.created_at)}</td><td className="p-3 font-medium">{l.action}</td><td className="p-3">{l.target}</td><td className="p-3">{name(l.actor_id)}</td></tr>)}</tbody></table>
        </div>
      )}
    </>
  );
}
