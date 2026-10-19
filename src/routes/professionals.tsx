import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { BadgeCheck, Flag, Heart, MapPin, Languages, Video, MessageSquare, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_PROS, type DirectoryPro } from "@/lib/demo-pros";
import { PageHero, DemoBadge, EmptyState } from "@/components/site/bits";
import { LocationSelect, selectCls } from "@/components/site/LocationSelect";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ProAvatar } from "@/components/site/ProAvatar";
import { ContactDialog, feeText } from "@/components/site/ProContact";

export const Route = createFileRoute("/professionals")({
  validateSearch: z.object({ state: z.string().optional(), city: z.string().optional(), cat: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Find a Professional — LegalSetu" },
      { name: "description", content: "Search independent CAs, advocates and company secretaries by category, language and location across India." },
      { property: "og:title", content: "Find a Professional — LegalSetu" },
      { property: "og:description", content: "Professional directory with clear verification status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Professionals,
});

const CATS = ["Chartered Accountant", "Advocate", "Company Secretary", "Tax Practitioner", "Other"];

function Professionals() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: "/professionals" });
  const cat = s.cat ?? "";
  const setCat = (v: string) => navigate({ search: (prev) => ({ ...prev, cat: v || undefined }), replace: true });
  const [q, setQ] = useState("");
  const [report, setReport] = useState<DirectoryPro | null>(null);
  const [contact, setContact] = useState<DirectoryPro | null>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const toggleCompare = (k: string) => setCompare((c) => c.includes(k) ? c.filter((x) => x !== k) : c.length >= 3 ? (toast.info("Compare up to 3 professionals"), c) : [...c, k]);

  const { data: real = [] } = useQuery({
    queryKey: ["directory"],
    queryFn: async () => {
      const { data } = await supabase.from("professional_profiles").select("*").eq("is_listed", true).eq("verification_status", "approved").eq("suspended", false);
      return (data ?? []).map<DirectoryPro>((p) => ({
        key: p.user_id, name: p.display_name, category: p.category, qualifications: p.qualifications ?? "",
        registration: p.registration_details, verification: "verified", experience: p.years_experience,
        languages: p.languages ?? [], state: p.state ?? "", city: p.city ?? "", modes: p.consultation_modes ?? [],
        expertise: p.expertise ?? [], description: p.description ?? "", demo: false, photo: p.photo_path,
        membership: p.membership_number, cop: p.cop_number, availability: p.availability, feeFrom: p.fee_from_paise, feeTo: p.fee_to_paise,
      }));
    },
  });

  const list = useMemo(() => [...real, ...DEMO_PROS].filter((p) =>
    (!cat || p.category === cat) && (!s.state || p.state === s.state) && (!s.city || p.city === s.city) &&
    (!q || (p.name + p.expertise.join(" ") + p.languages.join(" ")).toLowerCase().includes(q.toLowerCase())),
  ), [real, cat, s.state, s.city, q]);

  return (
    <>
      <PageHero eyebrow="Professional directory" title="Find a Professional" subtitle="Browse independent professionals. A verified badge appears only after our team has reviewed submitted credentials." />
      <div className="container-page py-12">
        <div className="card-surface grid gap-3 p-4 md:grid-cols-[1fr_220px_1.2fr]">
          <input aria-label="Search professionals" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by expertise or language" className={selectCls} />
          <select aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)} className={selectCls}>
            <option value="">All categories</option>{CATS.map((c) => <option key={c}>{c}</option>)}
          </select>
          <LocationSelect state={s.state ?? ""} city={s.city ?? ""} onChange={(v) => navigate({ search: { state: v.state || undefined, city: v.city || undefined }, replace: true })} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Profession">
          {[["", "All professionals"], ["Chartered Accountant", "Chartered Accountants"], ["Advocate", "Advocates"]].map(([v, l]) => (
            <Button key={l} role="tab" aria-selected={cat === v} size="sm" variant={cat === v ? "default" : "outline"} onClick={() => setCat(v)}>{l}</Button>
          ))}
        </div>
        {compare.length > 0 && <CompareTable pros={list.filter((p) => compare.includes(p.key))} onClear={() => setCompare([])} />}
        <div className="mt-4 rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm text-warning">
          Profiles marked <strong>DEMO</strong> are fictional examples to show the layout. They are not real people and cannot receive requests.
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {list.length === 0 && <div className="md:col-span-2"><EmptyState title="No professionals found" body="No listed professionals match these filters yet. You can still submit a service request — our team will route it to an eligible professional." action={<Button asChild><Link to="/services">Browse services</Link></Button>} /></div>}
          {list.map((p) => <ProCard key={p.key} p={p} onReport={() => setReport(p)} onContact={() => setContact(p)} comparing={compare.includes(p.key)} onCompare={() => toggleCompare(p.key)} />)}
        </div>
      </div>
      <ReportDialog pro={report} onClose={() => setReport(null)} />
      <ContactDialog pro={contact} onClose={() => setContact(null)} />
    </>
  );
}

function ProCard({ p, onReport, onContact, comparing, onCompare }: { p: DirectoryPro; onReport: () => void; onContact: () => void; comparing: boolean; onCompare: () => void }) {
  const { user } = useAuth();
  const { data: stats } = useQuery({
    queryKey: ["pro-stats", p.key], enabled: !p.demo,
    queryFn: async () => (await supabase.rpc("pro_public_stats", { _pro: p.key })).data?.[0] ?? null,
  });
  const save = async () => {
    if (!user) return toast.info("Log in to save professionals.");
    const { error } = await supabase.from("saved_professionals").insert({ professional_key: p.key, user_id: user.id });
    if (error && !error.message.includes("duplicate")) return toast.error("Couldn't save. Please try again.");
    toast.success("Saved to your dashboard");
  };
  return (
    <article className="card-surface flex flex-col p-5">
      <div className="flex items-start gap-4">
        <ProAvatar name={p.name} path={p.photo} proId={p.demo ? undefined : p.key} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{p.demo ? p.name : <Link to="/professionals/$id" params={{ id: p.key }} className="hover:underline">{p.name}</Link>}</h3>
            {p.demo && <DemoBadge />}
            {p.verification === "verified" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success"><BadgeCheck className="h-3.5 w-3.5" />Verified</span>
            ) : (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Not verified</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{p.category}{p.experience ? ` · ${p.experience} yrs` : ""}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{p.city}, {p.state}</span>
            <span className="flex items-center gap-1"><Languages className="h-3.5 w-3.5" />{p.languages.join(", ")}</span>
            <span className="flex items-center gap-1"><Video className="h-3.5 w-3.5" />{p.modes.join(" / ")}</span>
          </div>
        </div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{p.description}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">{p.expertise.map((e) => <span key={e} className="rounded-md bg-teal-soft px-2 py-0.5 text-xs font-medium text-accent">{e}</span>)}</div>
      {p.registration && <p className="mt-3 text-xs text-muted-foreground">Registration: {p.registration}</p>}
      {p.membership && <p className="mt-1 text-xs text-muted-foreground">{p.category === "Advocate" ? "Bar Council enrolment" : "ICAI membership"}: {p.membership}</p>}
      {p.cop && <p className="mt-1 text-xs text-muted-foreground">Certificate of Practice: {p.cop}</p>}
      {p.availability && <p className="mt-1 text-xs text-muted-foreground">Availability: {p.availability}</p>}
      <p className="mt-1 text-xs text-muted-foreground">Consultation fee: {feeText(p)}</p>
      {!p.demo && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Star className="h-3.5 w-3.5" />{stats?.review_count ? `${stats.avg_rating} from ${stats.review_count} verified review${stats.review_count === 1 ? "" : "s"}` : "No reviews yet"} · {stats?.interaction_count ?? 0} verified interactions</p>}
      <div className="mt-5 flex flex-wrap gap-2">
        {p.demo ? (
          <Button disabled size="sm" title="Demo profiles can't receive requests">Request appointment</Button>
        ) : (
          <Button asChild size="sm"><Link to="/dashboard/appointments" search={{ pro: p.key }}>Request appointment</Link></Button>
        )}
        {!p.demo && <Button asChild variant="outline" size="sm"><Link to="/professionals/$id" params={{ id: p.key }}>View profile</Link></Button>}
        {!p.demo && <Button variant="outline" size="sm" onClick={onContact}><MessageSquare /> Send contact request</Button>}
        {!p.demo && <Button variant={comparing ? "default" : "ghost"} size="sm" onClick={onCompare} aria-pressed={comparing}>{comparing ? "Comparing" : "Compare"}</Button>}
        <Button variant="outline" size="sm" onClick={save}><Heart /> Save</Button>
        <Button variant="ghost" size="sm" onClick={onReport}><Flag /> Report</Button>
      </div>
    </article>
  );
}

function ReportDialog({ pro, onClose }: { pro: DirectoryPro | null; onClose: () => void }) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!user || !pro) return;
    if (text.trim().length < 10) return toast.error("Please describe the issue (at least 10 characters).");
    setBusy(true);
    const { error } = await supabase.from("support_tickets").insert({ user_id: user.id, kind: "profile_report", subject: `Profile report: ${pro.name} (${pro.key})`, body: text.trim().slice(0, 3000) });
    setBusy(false);
    if (error) return toast.error("Couldn't submit the report.");
    toast.success("Report submitted. Our team will review it.");
    setText(""); onClose();
  };
  return (
    <Dialog open={!!pro} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report this profile</DialogTitle>
          <DialogDescription>Tell us what's wrong with {pro?.name}'s profile.</DialogDescription>
        </DialogHeader>
        {user ? (
          <>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={3000} rows={5} placeholder="Describe the issue" />
            <Button onClick={submit} disabled={busy}>{busy ? "Submitting…" : "Submit report"}</Button>
          </>
        ) : (
          <Button asChild><Link to="/auth" search={{ mode: "login" }}>Log in to report</Link></Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CompareTable({ pros, onClear }: { pros: DirectoryPro[]; onClear: () => void }) {
  const rows: [string, (p: DirectoryPro) => string][] = [
    ["Profession", (p) => p.category],
    ["Verification", (p) => (p.verification === "verified" ? "Verified by LegalSetu" : "Not verified")],
    ["Qualifications", (p) => p.qualifications || "—"],
    ["Registration", (p) => p.membership || p.registration || "—"],
    ["Certificate of Practice", (p) => p.cop || "—"],
    ["Experience", (p) => (p.experience != null ? `${p.experience} yrs` : "—")],
    ["Availability", (p) => p.availability || "—"],
    ["Fee range", (p) => feeText(p)],
    ["Location", (p) => `${p.city}, ${p.state}`],
    ["Languages", (p) => p.languages.join(", ") || "—"],
  ];
  return (
    <div className="card-surface mt-4 overflow-x-auto p-4">
      <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold">Compare ({pros.length})</h2><Button size="sm" variant="ghost" onClick={onClear}>Clear</Button></div>
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead><tr><th className="p-2"></th>{pros.map((p) => <th key={p.key} className="p-2 font-semibold">{p.name}</th>)}</tr></thead>
        <tbody>
          {rows.map(([l, f]) => <tr key={l} className="border-t"><td className="p-2 text-muted-foreground">{l}</td>{pros.map((p) => <td key={p.key} className="p-2">{f(p)}</td>)}</tr>)}
          <tr className="border-t"><td className="p-2 text-muted-foreground">Ratings & completed work</td>{pros.map((p) => <td key={p.key} className="p-2"><CompareStats id={p.key} /></td>)}</tr>
        </tbody>
      </table>
    </div>
  );
}

function CompareStats({ id }: { id: string }) {
  const { data } = useQuery({ queryKey: ["pro-stats", id], queryFn: async () => (await supabase.rpc("pro_public_stats", { _pro: id })).data?.[0] ?? null });
  return <>{data?.review_count ? `${data.avg_rating}★ (${data.review_count})` : "No reviews yet"} · {data?.interaction_count ?? 0} verified interactions</>;
}
