import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DashHeader } from "@/components/dash/DashShell";
import { FutureBadge } from "@/components/site/bits";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/admin/settings")({ component: SettingsPage });

function SettingsPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["settings"], queryFn: async () => (await supabase.from("platform_settings").select("*").eq("key", "platform_fee_note").maybeSingle()).data });
  const [note, setNote] = useState("");
  useEffect(() => { if (data) setNote(String(data.value)); }, [data]);
  const save = async () => {
    const { error } = await supabase.from("platform_settings").upsert({ key: "platform_fee_note", value: note, updated_at: new Date().toISOString() });
    if (error) return toast.error(error.message);
    toast.success("Saved"); qc.invalidateQueries({ queryKey: ["settings"] });
  };
  return (
    <>
      <DashHeader title="Platform settings" />
      <div className="grid gap-4">
        <div className="card-surface p-5">
          <h2 className="font-semibold">Platform fee note</h2>
          <p className="text-sm text-muted-foreground">Shown wherever platform fees are explained. Keep platform fees separate from professional fees.</p>
          <Textarea className="mt-3" rows={3} value={note} onChange={(e) => setNote(e.target.value)} disabled={!isAdmin} />
          {isAdmin && <Button className="mt-3" onClick={save}>Save</Button>}
        </div>
        {[
          ["Payment gateway", "Payments stay in test mode until a gateway is connected, verified server-side and webhooks are in place."],
          ["Email notifications", "Notification templates and email delivery will be configured with a verified sending domain."],
          ["Subscription plans", "Plan prices are configured in the pricing catalogue and shown as 'To be announced' until launch."],
          ["Languages", "Hindi and other Indian languages will be added after legal content is reviewed for translation."],
        ].map(([t, d]) => (
          <div key={t} className="card-surface flex items-start justify-between gap-4 p-5"><div><h2 className="font-semibold">{t}</h2><p className="text-sm text-muted-foreground">{d}</p></div><FutureBadge /></div>
        ))}
      </div>
    </>
  );
}
