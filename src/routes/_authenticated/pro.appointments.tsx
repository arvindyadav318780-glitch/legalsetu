import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DashHeader, fmtDateTime } from "@/components/dash/DashShell";
import { EmptyState, StatusPill } from "@/components/site/bits";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/pro/appointments")({ component: ProAppts });

function ProAppts() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["pro-appts", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("appointments").select("*").eq("professional_id", user!.id).order("preferred_at")).data ?? [],
  });
  const set = async (id: string, status: string) => {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
    if (error) return toast.error("Couldn't update");
    qc.invalidateQueries({ queryKey: ["pro-appts"] });
  };
  return (
    <>
      <DashHeader title="Appointment calendar" />
      {data.length === 0 ? <EmptyState title="No appointment requests" /> : (
        <div className="card-surface divide-y">{data.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1"><p className="font-medium">{a.topic}</p><p className="text-xs text-muted-foreground">{fmtDateTime(a.preferred_at)} · {a.mode}</p></div>
            <StatusPill status={a.status} />
            {a.status === "requested" && <><Button size="sm" onClick={() => set(a.id, "confirmed")}>Confirm</Button><Button size="sm" variant="outline" onClick={() => set(a.id, "declined")}>Decline</Button></>}
            {a.status === "confirmed" && <Button size="sm" variant="outline" onClick={() => set(a.id, "completed")}>Mark completed</Button>}
          </div>
        ))}</div>
      )}
    </>
  );
}
