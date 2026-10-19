import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DashHeader, fmtDateTime } from "@/components/dash/DashShell";
import { EmptyState, StatusPill } from "@/components/site/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { selectCls } from "@/components/site/LocationSelect";

export const Route = createFileRoute("/_authenticated/dashboard/appointments")({
  validateSearch: z.object({ pro: z.string().uuid().optional() }),
  component: Appts,
});

function Appts() {
  const { pro } = Route.useSearch();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [topic, setTopic] = useState("");
  const [when, setWhen] = useState("");
  const [mode, setMode] = useState("online");
  const { data = [] } = useQuery({
    queryKey: ["appts", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("appointments").select("*").eq("customer_id", user!.id).order("preferred_at", { ascending: false })).data ?? [],
  });
  const create = async () => {
    if (topic.trim().length < 3) return toast.error("Please add a short topic");
    if (!when || new Date(when) < new Date()) return toast.error("Choose a future date and time");
    const { error } = await supabase.from("appointments").insert({ customer_id: user!.id, professional_id: pro ?? null, topic: topic.trim().slice(0, 200), preferred_at: new Date(when).toISOString(), mode });
    if (error) return toast.error("Couldn't create the request");
    toast.success("Appointment requested"); setTopic(""); setWhen("");
    qc.invalidateQueries({ queryKey: ["appts"] });
  };
  const cancel = async (id: string) => {
    await supabase.from("appointments").update({ status: "cancelled" }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["appts"] });
  };
  return (
    <>
      <DashHeader title="Appointments" subtitle={pro ? "Requesting with the selected professional." : "Request a consultation. Our team will match an eligible professional."} />
      <div className="card-surface grid gap-3 p-5 md:grid-cols-[1.5fr_1fr_140px_auto] md:items-end">
        <div><label className="text-sm font-medium">Topic</label><Input className="mt-1" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} placeholder="e.g. GST registration query" /></div>
        <div><label className="text-sm font-medium">Preferred time</label><Input className="mt-1" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></div>
        <div><label className="text-sm font-medium">Mode</label><select className={selectCls + " mt-1"} value={mode} onChange={(e) => setMode(e.target.value)}><option value="online">Online</option><option value="in-person">In-person</option></select></div>
        <Button variant="accent" onClick={create}>Request</Button>
      </div>
      <div className="mt-6">
        {data.length === 0 ? <EmptyState title="No appointments" body="Requested appointments will appear here." /> : (
          <div className="card-surface divide-y">{data.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1"><p className="font-medium">{a.topic}</p><p className="text-xs text-muted-foreground">{fmtDateTime(a.preferred_at)} · {a.mode}</p></div>
              <StatusPill status={a.status} />
              {["requested", "confirmed"].includes(a.status) && <Button variant="ghost" size="sm" onClick={() => cancel(a.id)}>Cancel</Button>}
            </div>
          ))}</div>
        )}
      </div>
    </>
  );
}
