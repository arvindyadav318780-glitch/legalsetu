import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DashHeader } from "@/components/dash/DashShell";
import { StatusPill } from "@/components/site/bits";
import { LocationSelect, selectCls } from "@/components/site/LocationSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { canSubmitForVerification, verificationLabel } from "@/lib/verification";
import { ProAvatar } from "@/components/site/ProAvatar";

export const Route = createFileRoute("/_authenticated/pro/profile")({ component: ProProfile });

const CATS = ["Chartered Accountant", "Advocate", "Company Secretary", "Tax Practitioner", "Other"];
const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 15);

function ProProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isFetched } = useQuery({
    queryKey: ["my-pro", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("professional_profiles").select("*").eq("user_id", user!.id).maybeSingle()).data,
  });
  const [f, setF] = useState({ display_name: "", category: CATS[0], qualifications: "", registration_details: "", years_experience: "", languages: "", state: "", city: "", modes: "Online", expertise: "", description: "", is_listed: false, membership_number: "", availability: "", fee_from: "", fee_to: "", cop_number: "" });
  const history = useQuery({
    queryKey: ["my-pro-history", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("verification_reviews").select("*").eq("professional_id", user!.id).order("created_at", { ascending: false })).data ?? [],
  });
  useEffect(() => { if (data) setF({
    display_name: data.display_name, category: data.category, qualifications: data.qualifications ?? "", registration_details: data.registration_details ?? "",
    years_experience: data.years_experience?.toString() ?? "", languages: (data.languages ?? []).join(", "), state: data.state ?? "", city: data.city ?? "",
    modes: (data.consultation_modes ?? []).join(", "), expertise: (data.expertise ?? []).join(", "), description: data.description ?? "", is_listed: data.is_listed,
    membership_number: data.membership_number ?? "", availability: data.availability ?? "", fee_from: data.fee_from_paise != null ? String(data.fee_from_paise / 100) : "", fee_to: data.fee_to_paise != null ? String(data.fee_to_paise / 100) : "", cop_number: data.cop_number ?? "",
  }); }, [data]);

  const payload = () => ({
    user_id: user!.id, display_name: f.display_name.trim().slice(0, 120), category: f.category,
    qualifications: f.qualifications.slice(0, 300) || null, registration_details: f.registration_details.slice(0, 300) || null,
    years_experience: f.years_experience ? Math.max(0, Math.min(70, parseInt(f.years_experience) || 0)) : null,
    languages: list(f.languages), state: f.state || null, city: f.city || null, consultation_modes: list(f.modes),
    expertise: list(f.expertise), description: f.description.slice(0, 2000) || null, is_listed: f.is_listed,
    membership_number: f.membership_number.trim().slice(0, 60) || null, availability: f.availability.trim().slice(0, 300) || null, cop_number: f.category === "Chartered Accountant" ? f.cop_number.trim().slice(0, 60) || null : null,
    fee_from_paise: f.fee_from ? Math.max(0, Math.round((parseFloat(f.fee_from) || 0) * 100)) : null, fee_to_paise: f.fee_to ? Math.max(0, Math.round((parseFloat(f.fee_to) || 0) * 100)) : null,
  });

  const save = async (submit = false) => {
    if (!f.display_name.trim()) return toast.error("Display name is required");
    if (submit && !f.registration_details.trim()) return toast.error("Add registration / membership details before submitting for verification");
    const p = { ...payload(), ...(submit ? { verification_status: "pending" } : {}) };
    // Re-check for an existing row so a quick "Save" then "Submit" never tries to insert twice.
    const { data: existing } = await supabase.from("professional_profiles").select("user_id").eq("user_id", user!.id).maybeSingle();
    const { error } = existing
      ? await supabase.from("professional_profiles").update(p).eq("user_id", user!.id)
      : await supabase.from("professional_profiles").insert(p);
    if (error) return toast.error(error.message);
    toast.success(submit ? "Submitted for verification" : "Profile saved");
    qc.invalidateQueries({ queryKey: ["my-pro"] });
  };

  const uploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file || !user) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return toast.error("Use a JPG, PNG or WebP image");
    if (file.size > 2 * 1024 * 1024) return toast.error("Photo must be 2 MB or smaller");
    const path = `${user.id}/photo-${Date.now()}.${file.type.split("/")[1]}`;
    const up = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type });
    if (up.error) return toast.error(up.error.message);
    const { error } = await supabase.from("professional_profiles").update({ photo_path: path }).eq("user_id", user.id);
    if (error) return toast.error(error.message);
    if (data?.photo_path) await supabase.storage.from("avatars").remove([data.photo_path]);
    toast.success("Photo updated"); qc.invalidateQueries({ queryKey: ["my-pro"] });
  };

  if (!isFetched) return null;
  const status = data?.verification_status ?? "not_submitted";
  return (
    <>
      <DashHeader title="Profile & Verification" />
      <div className="card-surface mb-6 p-5">
        <p className="text-sm text-muted-foreground">Verification progress</p>
        <div className="mt-2 flex items-center gap-3"><StatusPill status={status} />
          <span className="text-sm text-muted-foreground">{status === "approved" ? "Your credentials have been reviewed and approved." : status === "pending" ? "Submitted — waiting for review." : status === "under_review" ? "Our team is reviewing your submission." : status === "more_info_required" ? "More information is needed. Update your details and resubmit." : status === "rejected" ? "Please update details and resubmit." : "Complete your profile and submit credentials."}</span></div>
        {data?.verification_note && ["rejected", "more_info_required"].includes(status) && <p className="mt-3 rounded-lg bg-muted p-3 text-sm"><span className="font-medium">Reviewer note:</span> {data.verification_note}</p>}
        {data?.suspended && <p className="mt-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">Your professional account is suspended. Contact support for details.</p>}
        <p className="mt-2 text-xs text-muted-foreground">Your profile appears in the public directory only when verified and listing is turned on.{data && <> <Link to="/professionals/$id" params={{ id: user!.id }} className="text-accent hover:underline">View my public profile</Link></>}</p>
        {(history.data ?? []).length > 0 && (
          <details className="mt-3 text-sm" open><summary className="cursor-pointer text-accent">Verification history</summary>
            <ol className="mt-2 space-y-1">{(history.data ?? []).map((h) => (
              <li key={h.id} className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString("en-IN")} · {verificationLabel(h.from_status ?? "")} → <strong>{verificationLabel(h.to_status)}</strong> · {h.reviewer_id === user?.id ? "You" : "LegalSetu reviewer"}{h.note ? ` · ${h.note}` : ""}</li>
            ))}</ol>
          </details>
        )}
      </div>
      <div className="card-surface mb-6 flex flex-wrap items-center gap-4 p-5">
        <ProAvatar name={f.display_name || "?"} path={data?.photo_path} size={72} />
        <div className="flex-1">
          <p className="font-medium">Profile photo</p>
          <p className="text-xs text-muted-foreground">JPG, PNG or WebP, up to 2 MB. Use a genuine, professional photo of yourself.{!data ? " Save your profile first." : ""}</p>
        </div>
        {data && <label className="cursor-pointer rounded-md border px-3 py-2 text-sm hover:bg-muted">Upload photo<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={uploadPhoto} /></label>}
      </div>
      <div className="card-surface grid gap-4 p-6 md:grid-cols-2">
        <Fld label="Display name"><Input value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} /></Fld>
        <Fld label="Category"><select className={selectCls} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></Fld>
        <Fld label="Qualifications"><Input value={f.qualifications} onChange={(e) => setF({ ...f, qualifications: e.target.value })} /></Fld>
        <Fld label="Registration / membership details"><Input value={f.registration_details} onChange={(e) => setF({ ...f, registration_details: e.target.value })} placeholder="e.g. ICAI membership no., Bar Council enrolment no." /></Fld>
        {(f.category === "Chartered Accountant" || f.category === "Advocate") && (
          <Fld label={f.category === "Chartered Accountant" ? "ICAI membership number" : "Bar Council enrolment number (with State Bar Council)"}><Input value={f.membership_number} maxLength={60} onChange={(e) => setF({ ...f, membership_number: e.target.value })} placeholder={f.category === "Chartered Accountant" ? "e.g. 6-digit ICAI membership no." : "e.g. D/1234/2015 (Delhi)"} /></Fld>
        )}
        {f.category === "Chartered Accountant" && <Fld label="Certificate of Practice (COP) details, if held"><Input value={f.cop_number} maxLength={60} onChange={(e) => setF({ ...f, cop_number: e.target.value })} placeholder="As issued by ICAI" /></Fld>}
        <Fld label="Availability"><Input value={f.availability} maxLength={300} onChange={(e) => setF({ ...f, availability: e.target.value })} placeholder="e.g. Mon–Fri, 10am–6pm IST" /></Fld>
        <Fld label="Self-declared consultation fee range (₹, optional)"><div className="flex gap-2"><Input type="number" min={0} value={f.fee_from} onChange={(e) => setF({ ...f, fee_from: e.target.value })} placeholder="From" aria-label="Fee from" /><Input type="number" min={0} value={f.fee_to} onChange={(e) => setF({ ...f, fee_to: e.target.value })} placeholder="To" aria-label="Fee to" /></div></Fld>
        <Fld label="Years of experience"><Input type="number" min={0} max={70} value={f.years_experience} onChange={(e) => setF({ ...f, years_experience: e.target.value })} /></Fld>
        <Fld label="Languages (comma separated)"><Input value={f.languages} onChange={(e) => setF({ ...f, languages: e.target.value })} /></Fld>
        <Fld label="Location"><LocationSelect state={f.state} city={f.city} onChange={(v) => setF({ ...f, ...v })} allLabel="Select state" /></Fld>
        <Fld label="Consultation modes"><Input value={f.modes} onChange={(e) => setF({ ...f, modes: e.target.value })} placeholder="Online, In-person" /></Fld>
        <div className="md:col-span-2"><Fld label="Areas of expertise (comma separated)"><Input value={f.expertise} onChange={(e) => setF({ ...f, expertise: e.target.value })} /></Fld></div>
        <div className="md:col-span-2"><Fld label="Profile description"><Textarea rows={4} value={f.description} maxLength={2000} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Factual description. Avoid claims that breach your professional body's advertising rules." /></Fld></div>
        <div className="flex items-center justify-between rounded-lg border p-3 md:col-span-2"><div><span className="text-sm">List me in the public directory</span><p className="text-xs text-muted-foreground">{status === "approved" && !data?.suspended ? "Requires qualifications, registration details, category, city and state." : "Available once your verification is approved."}</p></div><Switch checked={f.is_listed} disabled={status !== "approved" || !!data?.suspended} onCheckedChange={(v) => setF({ ...f, is_listed: v })} aria-label="List me in the public directory" /></div>
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <Button variant="accent" onClick={() => save(false)}>Save profile</Button>
          {canSubmitForVerification(status) && <Button variant="outline" onClick={() => save(true)}>Submit for verification</Button>}
        </div>
      </div>
    </>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><Label>{label}</Label>{children}</div>;
}
