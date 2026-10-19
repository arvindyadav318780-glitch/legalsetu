import { createFileRoute, Link } from "@tanstack/react-router";
import { ProLink } from "@/components/site/ProAvatar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DashHeader } from "@/components/dash/DashShell";
import { EmptyState, StatusPill } from "@/components/site/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pager, TestTag } from "@/components/dash/CrmBits";
import { isTestRecord } from "@/lib/crm";
import { selectCls } from "@/components/site/LocationSelect";

export const Route = createFileRoute("/_authenticated/admin/professionals")({ component: Pros });

function Pros() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [ver, setVer] = useState("");
  const [sort, setSort] = useState("updated");
  const [page, setPage] = useState(1);
  const { data } = useQuery({
    queryKey: ["admin-pro-mgmt"],
    queryFn: async () => {
      const [p, r] = await Promise.all([
        supabase.from("professional_profiles").select("*").order("updated_at", { ascending: false }),
        supabase.from("service_requests").select("assigned_professional_id,status").not("assigned_professional_id", "is", null),
      ]);
      return { pros: p.data ?? [], reqs: r.data ?? [] };
    },
  });
  const upd = async (uid: string, patch: any, msg: string) => {
    const { error } = await supabase.from("professional_profiles").update(patch as never).eq("user_id", uid);
    if (error) return toast.error(error.message);
    toast.success(msg); qc.invalidateQueries({ queryKey: ["admin-pro-mgmt"] });
  };
  const all = (data?.pros ?? []).filter((p) => `${p.display_name} ${p.category} ${p.city ?? ""} ${p.state ?? ""}`.toLowerCase().includes(q.toLowerCase())
    && (!cat || (cat === "ca" ? !/advocate/i.test(p.category) : /advocate/i.test(p.category))) && (!ver || (ver === "unlisted" ? !p.is_listed : ver === "suspended" ? p.suspended : p.verification_status === ver)))
    .sort((a, b) => sort === "name" ? a.display_name.localeCompare(b.display_name) : sort === "new" ? b.created_at.localeCompare(a.created_at) : b.updated_at.localeCompare(a.updated_at));
  const pages = Math.max(1, Math.ceil(all.length / 20)); const pg = Math.min(page, pages);
  const list = all.slice((pg - 1) * 20, pg * 20);
  return (
    <>
      <DashHeader title="Professionals" subtitle="Manage listing and suspension. Credentials can only be entered or edited by the professional themselves." action={<Button asChild variant="outline"><Link to="/admin/verification">Verification queue</Link></Button>} />
      <Input className="mb-4 max-w-sm" placeholder="Search professionals" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search professionals" />
      <div className="mb-4 flex flex-wrap gap-2">
        <select aria-label="Profession" className={selectCls + " w-40"} value={cat} onChange={(e) => { setCat(e.target.value); setPage(1); }}><option value="">CA + Advocate</option><option value="ca">CA</option><option value="advocate">Advocate</option></select>
        <select aria-label="Status" className={selectCls + " w-48"} value={ver} onChange={(e) => { setVer(e.target.value); setPage(1); }}><option value="">Any status</option><option value="pending">Pending</option><option value="under_review">Under review</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="unlisted">Not listed</option><option value="suspended">Suspended</option></select>
        <select aria-label="Sort" className={selectCls + " w-44"} value={sort} onChange={(e) => setSort(e.target.value)}><option value="updated">Recently updated</option><option value="new">Newest</option><option value="name">Name A–Z</option></select>
        <span className="self-center text-sm text-muted-foreground">{all.length} professional(s)</span>
      </div>
      {list.length === 0 ? <EmptyState title="No professional profiles" /> : (
        <div className="card-surface divide-y">{list.map((p) => {
          const work = (data?.reqs ?? []).filter((r) => r.assigned_professional_id === p.user_id);
          const active = work.filter((r) => !["completed", "cancelled"].includes(r.status)).length;
          return (
            <div key={p.user_id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{isAdmin ? <Link to="/admin/professionals/$id" params={{ id: p.user_id }} className="hover:underline">{p.display_name}</Link> : <ProLink id={p.user_id}>{p.display_name}</ProLink>}<TestTag on={isTestRecord(p.display_name, p.registration_details)} /> {p.suspended && <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">Suspended</span>}</p>
                <p className="text-xs text-muted-foreground">{p.category} · {[p.city, p.state].filter(Boolean).join(", ") || "—"} · {active} active / {work.length} total engagements · {p.is_listed ? "Listed publicly" : "Not listed"}</p>
              </div>
              <StatusPill status={p.verification_status} />
              {isAdmin && (
                <div className="flex gap-2">
                  <Button asChild size="sm"><Link to="/admin/professionals/$id" params={{ id: p.user_id }}>Open record</Link></Button>
                  {p.is_listed && <Button size="sm" variant="outline" onClick={() => upd(p.user_id, { is_listed: false }, "Removed from directory")}>Unlist</Button>}
                  {p.suspended
                    ? <Button size="sm" variant="outline" onClick={() => upd(p.user_id, { suspended: false }, "Reinstated")}>Reinstate</Button>
                    : <Button size="sm" variant="destructive" onClick={() => upd(p.user_id, { suspended: true, is_listed: false }, "Suspended")}>Suspend</Button>}
                </div>
              )}
            </div>
          );
        })}</div>
      )}
      <Pager page={pg} pages={pages} set={setPage} />
    </>
  );
}
