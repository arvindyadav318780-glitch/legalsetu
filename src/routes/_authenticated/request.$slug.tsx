import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { CheckCircle2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { catalogQuery, mergeCatalog, useCatalog } from "@/lib/catalog-live";
import { validateDocument } from "@/lib/status";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { LocationSelect, selectCls } from "@/components/site/LocationSelect";
import { cn } from "@/lib/utils";
import { CONTACT_PREFS, URGENCY, findLikelyDuplicate, labelOf, requestText } from "@/lib/requests";

export const Route = createFileRoute("/_authenticated/request/$slug")({
  loader: async ({ params, context }) => { const live = await context.queryClient.ensureQueryData(catalogQuery); if (params.slug !== "choose" && !mergeCatalog(live).getService(params.slug)) throw notFound(); return null; },
  head: () => ({ meta: [{ title: "Request a service — LegalSetu" }, { name: "robots", content: "noindex" }] }),
  component: RequestFlow,
});

const STEPS = ["Service", "Your details", "Location", "Questions", "Documents", "Review"];
const contactS = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Valid email required").max(255),
  phone: z.string().trim().regex(/^[0-9+\s-]{0,15}$/, "Enter a valid phone number").optional().or(z.literal("")),
});

function RequestFlow() {
  const { SERVICES, getService } = useCatalog();
  const { slug: initial } = Route.useParams();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [slug, setSlug] = useState(initial === "choose" ? SERVICES[0].slug : initial);
  const svc = getService(slug)!;
  const [contact, setContact] = useState({ name: (user?.user_metadata?.full_name as string) ?? "", email: user?.email ?? "", phone: "" });
  const [loc, setLoc] = useState({ state: "", city: "" });
  const [mode, setMode] = useState(svc.modes[0]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [details, setDetails] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [consent, setConsent] = useState(false);
  const [terms, setTerms] = useState(false);
  const [urgency, setUrgency] = useState("");
  const [pref, setPref] = useState("");
  const [shareConsent, setShareConsent] = useState(false);
  const [dup, setDup] = useState<{ id: string; reference: string; status: string; created_at: string } | null>(null);
  const [dupOk, setDupOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: string; reference: string } | null>(null);

  const next = () => {
    setErr(null);
    if (step === 1) { const r = contactS.safeParse(contact); if (!r.success) return setErr(r.error.issues[0].message); }
    if (step === 1 && !pref) return setErr("Please choose how you'd like to be contacted");
    if (step === 1 && (pref === "phone" || pref === "whatsapp") && !contact.phone.trim()) return setErr("Add a phone number for phone or WhatsApp contact");
    if (step === 2 && !loc.state) return setErr("Please select your state");
    if (step === 2 && !urgency) return setErr("Please choose how urgent this is");
    if (step === 4 && files.length && !consent) return setErr("Please confirm consent for document handling");
    setStep((s) => s + 1);
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const ok: File[] = [];
    for (const f of Array.from(list)) { const e = validateDocument(f); if (e) toast.error(`${f.name}: ${e}`); else ok.push(f); }
    setFiles((p) => [...p, ...ok].slice(0, 10));
  };

  const submit = async () => {
    if (!user) return;
    if (!shareConsent) return setErr("Please confirm consent to share your contact details with the assigned professional");
    if (!terms) return setErr("Please accept the service terms");
    setBusy(true); setErr(null);
    if (!dupOk) {
      const since = new Date(Date.now() - 30 * 864e5).toISOString();
      const { data: mine } = await supabase.from("service_requests").select("id,reference,service_slug,status,created_at,details,answers").eq("customer_id", user.id).eq("service_slug", svc.slug).gte("created_at", since);
      const d = findLikelyDuplicate({ service_slug: svc.slug, text: requestText(details, answers) }, mine ?? []);
      if (d) { setBusy(false); setDup(d); return; }
    }
    const { data, error } = await supabase.from("service_requests").insert({
      customer_id: user.id, service_slug: svc.slug, service_name: svc.name,
      contact_name: contact.name.trim(), contact_email: contact.email.trim(), contact_phone: contact.phone || null,
      state: loc.state, city: loc.city || null, mode, answers, details: details.trim().slice(0, 3000) || null, terms_accepted: true,
      urgency, contact_preference: pref, contact_consent_at: new Date().toISOString(),
    }).select("id, reference").single();
    if (error || !data) { setBusy(false); return setErr(error && /limit reached|Duplicate request/.test(error.message) ? error.message : "Couldn't submit your request. Please try again."); }
    for (const f of files) {
      const path = `${user.id}/${data.id}/${crypto.randomUUID()}-${f.name.replace(/[^\w.-]/g, "_")}`;
      const up = await supabase.storage.from("documents").upload(path, f, { contentType: f.type });
      if (up.error) { toast.error(`Upload failed: ${f.name}`); continue; }
      await supabase.from("documents").insert({ owner_id: user.id, request_id: data.id, file_name: f.name, storage_path: path, category: svc.name, mime_type: f.type, size_bytes: f.size });
    }
    setBusy(false);
    setDone(data);
  };

  if (done) return (
    <div className="container-page flex min-h-[70vh] items-center justify-center py-12">
      <div className="card-surface max-w-lg p-10 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
        <h1 className="mt-4 text-2xl font-bold">Request submitted</h1>
        <p className="mt-2 text-muted-foreground">Your request ID is</p>
        <p className="mt-1 font-mono text-2xl font-bold tracking-wider">{done.reference}</p>
        <p className="mt-4 text-sm text-muted-foreground">Our team will review it and route it to an eligible professional. You'll see every update in your dashboard.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild><Link to="/dashboard/requests/$id" params={{ id: done.id }}>View request</Link></Button>
          <Button asChild variant="outline"><Link to="/services">More services</Link></Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="container-page max-w-3xl py-10">
      <h1 className="text-2xl font-bold md:text-3xl">Request: {svc.name}</h1>
      <ol className="mt-6 flex gap-1.5" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1">
            <div className={cn("h-1.5 rounded-full", i <= step ? "bg-accent" : "bg-border")} />
            <p className={cn("mt-1.5 hidden text-xs sm:block", i === step ? "font-semibold text-foreground" : "text-muted-foreground")}>{s}</p>
          </li>
        ))}
      </ol>
      <div className="card-surface mt-6 grid gap-4 p-6 md:p-8">
        {step === 0 && (
          <>
            <Label htmlFor="svc">Service</Label>
            <select id="svc" className={selectCls} value={slug} onChange={(e) => { setSlug(e.target.value); setAnswers({}); setMode(getService(e.target.value)!.modes[0]); }}>
              {SERVICES.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
            </select>
            <p className="text-sm text-muted-foreground">{svc.overview}</p>
          </>
        )}
        {step === 1 && (
          <>
            <p className="text-sm text-muted-foreground">We only ask for what's needed to handle your request.</p>
            <div className="grid gap-1.5"><Label>Full name</Label><Input value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} maxLength={100} /></div>
            <div className="grid gap-1.5"><Label>Email</Label><Input type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} maxLength={255} /></div>
            <div className="grid gap-1.5"><Label>Phone {pref === "phone" || pref === "whatsapp" ? "" : "(optional)"}</Label><Input value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} maxLength={15} /></div>
            <div className="grid gap-1.5"><Label htmlFor="pref">Preferred contact method</Label>
              <select id="pref" className={selectCls} value={pref} onChange={(e) => setPref(e.target.value)}>
                <option value="">Select…</option>{CONTACT_PREFS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
              </select></div>
          </>
        )}
        {step === 2 && (
          <>
            <Label>Your state and city</Label>
            <LocationSelect state={loc.state} city={loc.city} onChange={setLoc} allLabel="Select state" />
            <Label htmlFor="urg">How urgent is this?</Label>
            <select id="urg" className={selectCls} value={urgency} onChange={(e) => setUrgency(e.target.value)}>
              <option value="">Select…</option>{URGENCY.map((u) => <option key={u.v} value={u.v}>{u.label}</option>)}
            </select>
            <Label>Preferred mode</Label>
            <div className="flex gap-2">{svc.modes.map((m) => <Button key={m} type="button" variant={mode === m ? "default" : "outline"} size="sm" onClick={() => setMode(m)}>{m}</Button>)}</div>
          </>
        )}
        {step === 3 && (
          <>
            {svc.questions.map((q) => (
              <div key={q.id} className="grid gap-1.5">
                <Label>{q.label}</Label>
                {q.type === "select" ? (
                  <select className={selectCls} value={answers[q.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}>
                    <option value="">Select…</option>{q.options!.map((o) => <option key={o}>{o}</option>)}
                  </select>
                ) : q.type === "textarea" ? (
                  <Textarea value={answers[q.id] ?? ""} maxLength={1000} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
                ) : (
                  <Input value={answers[q.id] ?? ""} maxLength={200} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
                )}
              </div>
            ))}
            <div className="grid gap-1.5"><Label>Anything else? (optional)</Label><Textarea value={details} maxLength={3000} onChange={(e) => setDetails(e.target.value)} placeholder="Avoid sharing Aadhaar numbers or bank credentials here." /></div>
          </>
        )}
        {step === 4 && (
          <>
            <p className="text-sm text-muted-foreground">Typically required: {svc.documents.join(", ")}. You can also upload later.</p>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center hover:border-accent">
              <Upload className="h-6 w-6 text-accent" />
              <span className="text-sm font-medium">Choose files</span>
              <span className="text-xs text-muted-foreground">PDF, JPG or PNG · max 10 MB each</span>
              <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            </label>
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                <span className="truncate">{f.name}</span>
                <Button variant="ghost" size="icon" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}><X /></Button>
              </div>
            ))}
            {files.length > 0 && (
              <label className="flex items-start gap-2 text-sm"><Checkbox checked={consent} onCheckedChange={(v) => setConsent(!!v)} />
                <span>I consent to these documents being stored privately and shared only with the professional assigned to this request and authorised support staff.</span></label>
            )}
          </>
        )}
        {step === 5 && (
          <>
            <dl className="grid gap-2 text-sm">
              <Row k="Service" v={svc.name} /><Row k="Name" v={contact.name} /><Row k="Email" v={contact.email} />
              <Row k="Location" v={[loc.city, loc.state].filter(Boolean).join(", ")} /><Row k="Mode" v={mode} />
              <Row k="Urgency" v={labelOf(URGENCY, urgency)} /><Row k="Contact by" v={labelOf(CONTACT_PREFS, pref)} />
              {svc.questions.map((q) => <Row key={q.id} k={q.label} v={answers[q.id] || "—"} />)}
              <Row k="Documents" v={`${files.length} file(s)`} />
            </dl>
            <div className="rounded-lg bg-muted p-4 text-xs text-muted-foreground">
              Professional fees will be quoted separately before any work begins. LegalSetu will not file anything on your behalf; an authorised professional acts only with your consent.
            </div>
            <label className="flex items-start gap-2 text-sm"><Checkbox checked={shareConsent} onCheckedChange={(v) => setShareConsent(!!v)} aria-label="Consent to share contact details" />
              <span>I consent to my name, email and phone number being shared only with the verified professional assigned to this request and authorised LegalSetu staff, so they can contact me by my preferred method.</span></label>
            {dup && !dupOk && (
              <div role="status" className="rounded-lg border border-warning/50 bg-warning/10 p-4 text-sm">
                <p className="font-semibold">You may already have this request</p>
                <p className="mt-1">Request <strong className="font-mono">{dup.reference}</strong> for the same service, with similar details, is still open (status: {dup.status.replace(/_/g, " ")}).</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild size="sm"><Link to="/dashboard/requests/$id" params={{ id: dup.id }}>Continue with {dup.reference}</Link></Button>
                  <Button size="sm" variant="outline" onClick={() => { setDupOk(true); setDup(null); }}>This is a different requirement</Button>
                </div>
              </div>
            )}
            <label className="flex items-start gap-2 text-sm"><Checkbox checked={terms} onCheckedChange={(v) => setTerms(!!v)} />
              <span>I agree to the <Link to="/legal/$page" params={{ page: "terms" }} className="text-accent underline" target="_blank">Terms of Use</Link> and <Link to="/legal/$page" params={{ page: "privacy" }} className="text-accent underline" target="_blank">Privacy Policy</Link>.</span></label>
          </>
        )}
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        <div className="mt-2 flex justify-between">
          <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={step === 0 || busy}>Back</Button>
          {step < 5 ? <Button variant="accent" onClick={next}>Continue</Button> : <Button variant="accent" onClick={submit} disabled={busy}>{busy ? "Submitting…" : "Submit request"}</Button>}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-4 border-b pb-2"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>;
}
