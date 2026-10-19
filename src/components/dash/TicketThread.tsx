import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fmtDateTime } from "@/components/dash/DashShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** Reply thread for a support ticket / complaint. Shared by customers and staff. */
export function TicketThread({ ticketId, closed }: { ticketId: string; closed?: boolean }) {
  const { user, isStaff } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const { data = [] } = useQuery({
    queryKey: ["ticket-replies", ticketId],
    queryFn: async () => (await supabase.from("ticket_replies").select("*").eq("ticket_id", ticketId).order("created_at")).data ?? [],
  });
  const send = async () => {
    const b = body.trim();
    if (!b) return;
    const { error } = await supabase.from("ticket_replies").insert({ ticket_id: ticketId, author_id: user!.id, is_staff: isStaff, body: b.slice(0, 4000) });
    if (error) return toast.error("Couldn't send reply");
    setBody(""); qc.invalidateQueries({ queryKey: ["ticket-replies", ticketId] });
  };
  return (
    <div className="mt-3 space-y-2 rounded-lg border bg-muted/30 p-3">
      {data.length === 0 && <p className="text-xs text-muted-foreground">No replies yet.</p>}
      {data.map((r) => (
        <div key={r.id} className={"max-w-[85%] rounded-lg p-2.5 text-sm " + (r.author_id === user?.id ? "ml-auto bg-navy text-navy-foreground" : "bg-background")}>
          <p className="whitespace-pre-wrap">{r.body}</p>
          <p className="mt-1 text-[11px] opacity-70">{r.author_id === user?.id ? "You" : r.is_staff ? "LegalSetu support" : "Customer"} · {fmtDateTime(r.created_at)}</p>
        </div>
      ))}
      {!closed && (
        <div className="flex gap-2">
          <Textarea rows={2} value={body} maxLength={4000} onChange={(e) => setBody(e.target.value)} placeholder="Write a reply" aria-label="Reply" />
          <Button onClick={send} aria-label="Send reply"><Send /></Button>
        </div>
      )}
    </div>
  );
}
