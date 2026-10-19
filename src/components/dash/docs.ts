import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Opens a private document via a short-lived (60s) signed URL.
 * Staff opening someone else's file must pass a reason; it is logged first and
 * the database only allows the download for 10 minutes after that log entry.
 */
export async function openDocument(path: string, staffAccess?: { documentId: string; reason: string }) {
  // Open the tab synchronously (inside the click) so browsers don't block it as a pop-up.
  const tab = window.open("", "_blank");
  if (tab) tab.opener = null;
  if (staffAccess) {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("doc_access_log").insert({ document_id: staffAccess.documentId, staff_id: u.user!.id, reason: staffAccess.reason.slice(0, 500) });
    if (error) { tab?.close(); return toast.error("Couldn't record the access reason."); }
  }
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 60);
  if (error || !data) {
    tab?.close();
    return toast.error("You don't have access to this document.");
  }
  if (tab) tab.location.href = data.signedUrl;
  else window.location.assign(data.signedUrl);
}
