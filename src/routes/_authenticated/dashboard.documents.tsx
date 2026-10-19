import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { FileText, Trash2, Upload, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { validateDocument } from "@/lib/status";
import { DashHeader, fmtDate } from "@/components/dash/DashShell";
import { openDocument } from "@/components/dash/docs";
import { EmptyState } from "@/components/site/bits";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { selectCls } from "@/components/site/LocationSelect";

const CATS = ["Identity", "Address proof", "Tax records", "GST records", "Business documents", "Agreements", "Other"];

export const Route = createFileRoute("/_authenticated/dashboard/documents")({
  validateSearch: z.object({ request: z.string().optional() }),
  component: Docs,
});

function Docs() {
  const { request } = Route.useSearch();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [cat, setCat] = useState("Other");
  const [reqId, setReqId] = useState(request ?? "");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data } = useQuery({
    queryKey: ["docs", user?.id], enabled: !!user,
    queryFn: async () => {
      const [d, r] = await Promise.all([
        supabase.from("documents").select("*").eq("owner_id", user!.id).order("created_at", { ascending: false }),
        supabase.from("service_requests").select("id,reference,service_name").eq("customer_id", user!.id),
      ]);
      return { docs: d.data ?? [], reqs: r.data ?? [] };
    },
  });

  const upload = async (files: FileList | null) => {
    if (!files?.length || !user) return;
    if (!consent) return toast.error("Please confirm consent before uploading.");
    setBusy(true);
    for (const f of Array.from(files)) {
      const e = validateDocument(f); if (e) { toast.error(`${f.name}: ${e}`); continue; }
      const path = `${user.id}/${reqId || "general"}/${crypto.randomUUID()}-${f.name.replace(/[^\w.-]/g, "_")}`;
      const up = await supabase.storage.from("documents").upload(path, f, { contentType: f.type });
      if (up.error) { toast.error(`Upload failed: ${f.name}`); continue; }
      await supabase.from("documents").insert({ owner_id: user.id, request_id: reqId || null, file_name: f.name, storage_path: path, category: cat, mime_type: f.type, size_bytes: f.size });
    }
    setBusy(false);
    toast.success("Upload complete");
    qc.invalidateQueries({ queryKey: ["docs"] });
  };

  const remove = async (id: string, path: string) => {
    if (!confirm("Delete this document permanently?")) return;
    await supabase.storage.from("documents").remove([path]);
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) return toast.error("Couldn't delete");
    qc.invalidateQueries({ queryKey: ["docs"] });
  };

  const reqName = (id: string | null) => data?.reqs.find((r) => r.id === id)?.reference ?? "—";

  return (
    <>
      <DashHeader title="My Documents" subtitle="Private storage. Only you, your assigned professional and authorised support staff can open these." />
      <div className="card-surface grid gap-3 p-5 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <div><label className="text-sm font-medium">Category</label><select className={selectCls + " mt-1"} value={cat} onChange={(e) => setCat(e.target.value)}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div><label className="text-sm font-medium">Link to request (optional)</label>
          <select className={selectCls + " mt-1"} value={reqId} onChange={(e) => setReqId(e.target.value)}><option value="">None</option>{data?.reqs.map((r) => <option key={r.id} value={r.id}>{r.reference} · {r.service_name}</option>)}</select></div>
        <label className={"inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground " + (busy ? "opacity-50" : "")}>
          <Upload className="h-4 w-4" />{busy ? "Uploading…" : "Upload"}
          <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" className="sr-only" disabled={busy} onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
        </label>
        <label className="flex items-start gap-2 text-xs text-muted-foreground md:col-span-3"><Checkbox checked={consent} onCheckedChange={(v) => setConsent(!!v)} />I consent to secure storage of these documents. PDF/JPG/PNG up to 10 MB. Please don't upload Aadhaar unless the service requires it.</label>
      </div>
      <div className="mt-6">
        {!data?.docs.length ? <EmptyState title="No documents yet" body="Upload documents to share them securely with your professional." /> : (
          <div className="card-surface divide-y">
            {data.docs.map((d) => (
              <div key={d.id} className="flex items-center gap-3 p-4">
                <FileText className="h-5 w-5 shrink-0 text-accent" />
                <button className="min-w-0 flex-1 text-left" onClick={() => openDocument(d.storage_path)}>
                  <p className="truncate font-medium hover:underline">{d.file_name}</p>
                  <p className="text-xs text-muted-foreground">{d.category} · {fmtDate(d.created_at)} · Request {reqName(d.request_id)}</p>
                </button>
                <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => remove(d.id, d.storage_path)}><Trash2 /></Button>
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-accent" />Download links expire after 60 seconds.</p>
    </>
  );
}
