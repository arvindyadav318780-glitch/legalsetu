import { useState } from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { selectCls } from "@/components/site/LocationSelect";
import { REPORT_REASONS, reportReasonError } from "@/lib/reports";

type Props = { targetId: string; conversationId?: string; contactRequestId?: string; label?: string; size?: "sm" | "default" };

/** Report another account. Eligibility (own conversation / contact request / listed profile) is enforced by the database. */
export function ReportButton({ targetId, conversationId, contactRequestId, label = "Report", size = "sm" }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  if (!user || user.id === targetId) return null;
  const submit = async () => {
    const err = reportReasonError(code, details);
    if (err) return toast.error(err);
    setBusy(true);
    const { error } = await supabase.from("abuse_reports").insert({
      reporter_id: user.id, target_user_id: targetId, reason_code: code, reason: details.trim().slice(0, 2000),
      conversation_id: conversationId ?? null, contact_request_id: contactRequestId ?? null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Report sent to LegalSetu Trust & Safety"); setOpen(false); setCode(""); setDetails("");
  };
  return (
    <>
      <Button size={size} variant="ghost" onClick={() => setOpen(true)}><Flag /> {label}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report this account</DialogTitle>
            <DialogDescription>LegalSetu Trust & Safety reviews every report.{conversationId ? " Staff will be able to read this conversation to review it." : ""} Don't include passwords, OTPs or bank details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5"><Label htmlFor="rr">Reason</Label>
              <select id="rr" className={selectCls} value={code} onChange={(e) => setCode(e.target.value)}>
                <option value="">Select…</option>{REPORT_REASONS.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
              </select></div>
            <div className="grid gap-1.5"><Label htmlFor="rd">Details {code === "other" ? "(required)" : "(optional)"}</Label>
              <Textarea id="rd" rows={4} maxLength={2000} value={details} onChange={(e) => setDetails(e.target.value)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button variant="destructive" disabled={busy} onClick={submit}>{busy ? "Sending…" : "Send report"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
