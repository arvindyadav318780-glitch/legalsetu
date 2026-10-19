import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { DirectoryPro } from "@/lib/demo-pros";
import { selectCls } from "@/components/site/LocationSelect";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export function ContactDialog({ pro, onClose }: { pro: DirectoryPro | null; onClose: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [reqId, setReqId] = useState("");
  const { data: myReqs = [] } = useQuery({
    queryKey: ["my-reqs-for-contact", user?.id], enabled: !!user && !!pro,
    queryFn: async () => (await supabase.from("service_requests").select("id,reference,service_name,status").eq("customer_id", user!.id).not("status", "in", "(cancelled,closed)").order("created_at", { ascending: false }).limit(50)).data ?? [],
  });
  const submit = async () => {
    if (!user || !pro) return;
    if (text.trim().length < 10) return toast.error("Describe what you need (at least 10 characters).");
    setBusy(true);
    const { error } = await supabase.from("contact_requests").insert({ client_id: user.id, professional_id: pro.key, message: text.trim().slice(0, 2000), request_id: reqId || null });
    setBusy(false);
    if (error) return toast.error(error.message.includes("contact_requests_active_pair") ? "You already have an open request with this professional." : error.message);
    toast.success("Contact request sent. You'll be notified when they reply.");
    setText(""); onClose(); navigate({ to: "/dashboard/messages" });
  };
  return (
    <Dialog open={!!pro} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contact {pro?.name}</DialogTitle>
          <DialogDescription>Briefly describe your matter. If the professional accepts, a private conversation opens. Contact is free for clients. Don't include Aadhaar, PAN or bank details here.</DialogDescription>
        </DialogHeader>
        {user ? (
          <>
            <select className={selectCls} value={reqId} onChange={(e) => setReqId(e.target.value)} aria-label="Link to one of your service requests">
              <option value="">General enquiry (no linked service request)</option>
              {myReqs.map((r) => <option key={r.id} value={r.id}>{r.reference} · {r.service_name}</option>)}
            </select>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} rows={5} placeholder="e.g. I need help filing GST returns for a small trading business in Pune." aria-label="Contact message" />
            <Button onClick={submit} disabled={busy}>{busy ? "Sending…" : "Send contact request"}</Button>
          </>
        ) : (
          <Button asChild><Link to="/auth" search={{ mode: "login" }}>Log in to contact</Link></Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function feeText(p: DirectoryPro) {
  const r = (x: number) => `₹${(x / 100).toLocaleString("en-IN")}`;
  if (p.feeFrom != null && p.feeTo != null) return `${r(p.feeFrom)} – ${r(p.feeTo)} (self-declared; agree directly with the professional)`;
  if (p.feeFrom != null) return `from ${r(p.feeFrom)} (self-declared)`;
  return "quoted on request";
}

