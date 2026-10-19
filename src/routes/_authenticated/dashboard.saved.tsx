import { createFileRoute, Link } from "@tanstack/react-router";
import { ProLink } from "@/components/site/ProAvatar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DEMO_PROS } from "@/lib/demo-pros";
import { DashHeader } from "@/components/dash/DashShell";
import { EmptyState, DemoBadge } from "@/components/site/bits";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard/saved")({ component: Saved });

function Saved() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["saved", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data: rows } = await supabase.from("saved_professionals").select("professional_key").eq("user_id", user!.id);
      const keys = (rows ?? []).map((r) => r.professional_key);
      const realKeys = keys.filter((k) => !k.startsWith("demo-"));
      const real = realKeys.length ? (await supabase.from("professional_profiles").select("user_id,display_name,category").in("user_id", realKeys)).data ?? [] : [];
      return keys.map((k) => {
        const d = DEMO_PROS.find((p) => p.key === k);
        if (d) return { key: k, name: d.name, category: d.category, demo: true };
        const r = real.find((p) => p.user_id === k);
        return { key: k, name: r?.display_name ?? "Unavailable profile", category: r?.category ?? "", demo: false };
      });
    },
  });
  const remove = async (k: string) => {
    await supabase.from("saved_professionals").delete().eq("user_id", user!.id).eq("professional_key", k);
    qc.invalidateQueries({ queryKey: ["saved"] });
  };
  return (
    <>
      <DashHeader title="Saved Professionals" />
      {data.length === 0 ? <EmptyState title="Nothing saved yet" action={<Button asChild><Link to="/professionals">Find professionals</Link></Button>} /> : (
        <div className="card-surface divide-y">{data.map((p) => (
          <div key={p.key} className="flex items-center gap-3 p-4">
            <div className="flex-1"><p className="flex items-center gap-2 font-medium">{p.demo ? p.name : <ProLink id={p.key}>{p.name}</ProLink>}{p.demo && <DemoBadge />}</p><p className="text-xs text-muted-foreground">{p.category}</p></div>
            <Button variant="ghost" size="sm" onClick={() => remove(p.key)}>Remove</Button>
          </div>
        ))}</div>
      )}
    </>
  );
}
