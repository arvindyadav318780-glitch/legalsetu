import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DashHeader, fmtDate } from "@/components/dash/DashShell";
import { selectCls } from "@/components/site/LocationSelect";
import { Input } from "@/components/ui/input";

const ROLES = ["customer", "ca", "advocate", "professional", "support", "admin"] as const;

export const Route = createFileRoute("/_authenticated/admin/users")({ component: AdminUsers });

function AdminUsers() {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const { data } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [p, r] = await Promise.all([supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(500), supabase.from("user_roles").select("*")]);
      return (p.data ?? []).map((x) => ({ ...x, roles: (r.data ?? []).filter((y) => y.user_id === x.id).map((y) => y.role) }));
    },
  });
  const add = async (uid: string, role: (typeof ROLES)[number]) => {
    const { error } = await supabase.from("user_roles").insert({ user_id: uid, role });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  };
  const remove = async (uid: string, role: string) => {
    if (uid === user!.id) return toast.error("You can't change your own roles.");
    const { error } = await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", role as never);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  };
  const list = (data ?? []).filter((u) => ((u.full_name ?? "") + u.id).toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <DashHeader title="Users & roles" subtitle={isAdmin ? "Grant or revoke roles, including support staff. You cannot change your own roles. Every change is recorded in the audit log." : "Only administrators can change roles."} />
      <Input className="mb-4 max-w-sm" placeholder="Search by name or ID" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="card-surface divide-y">
        {list.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1"><p className="font-medium">{u.full_name || "Unnamed user"} <span className="font-normal text-muted-foreground">{u.email}</span></p><p className="truncate font-mono text-xs text-muted-foreground">{u.id} · joined {fmtDate(u.created_at)}</p></div>
            <div className="flex flex-wrap gap-1.5">{u.roles.map((r) => (
              <span key={r} className="inline-flex items-center gap-1 rounded-full bg-teal-soft px-2 py-0.5 text-xs font-semibold text-accent">{r}
                {isAdmin && u.id !== user?.id && <button aria-label={`Remove ${r}`} onClick={() => remove(u.id, r)}><X className="h-3 w-3" /></button>}</span>
            ))}</div>
            {isAdmin && u.id !== user?.id && (
              <select className={selectCls + " w-40"} value="" onChange={(e) => e.target.value && add(u.id, e.target.value as never)}>
                <option value="">Add role…</option>{ROLES.filter((r) => !u.roles.includes(r)).map((r) => <option key={r}>{r}</option>)}
              </select>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
