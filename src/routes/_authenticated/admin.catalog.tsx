import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCatalog, formatFee, type MergedService } from "@/lib/catalog-live";
import { DashHeader } from "@/components/dash/DashShell";
import { selectCls } from "@/components/site/LocationSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/admin/catalog")({ component: Catalog });

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 20);
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

function Catalog() {
  const { isAdmin } = useAuth();
  const cat = useCatalog(true);
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["live-catalog"] });
  const [edit, setEdit] = useState<MergedService | "new" | null>(null);
  if (!isAdmin) return <p className="text-muted-foreground">Only administrators can manage services and fees.</p>;
  return (
    <>
      <DashHeader title="Services, categories & fees" subtitle="Changes appear on the public website within a minute. Platform fees are always shown separately from professional fees." />
      <Tabs defaultValue="services">
        <TabsList><TabsTrigger value="services">Services ({cat.SERVICES.length})</TabsTrigger><TabsTrigger value="categories">Categories ({cat.CATEGORIES.length})</TabsTrigger><TabsTrigger value="fees">Platform fees</TabsTrigger></TabsList>
        <TabsContent value="services" className="mt-4">
          <Button className="mb-4" variant="accent" onClick={() => setEdit("new")}>Add service</Button>
          {edit && <ServiceForm key={edit === "new" ? "new" : edit.slug} svc={edit === "new" ? null : edit} cats={cat.CATEGORIES} onDone={() => { setEdit(null); refresh(); }} />}
          <div className="card-surface divide-y">{cat.SERVICES.map((s) => (
            <div key={s.slug} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1"><p className="font-medium">{s.name} {!s.visible && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">Hidden</span>}{s.popular && <span className="ml-2 rounded-full bg-teal-soft px-2 py-0.5 text-xs text-accent">Popular</span>}</p>
                <p className="text-xs text-muted-foreground">{cat.categoryName(s.category)} · /services/{s.slug}{s.custom ? " · added by admin" : ""}</p></div>
              <Button size="sm" variant="outline" onClick={() => setEdit(s)}>Edit</Button>
            </div>
          ))}</div>
        </TabsContent>
        <TabsContent value="categories" className="mt-4"><Categories cats={cat.CATEGORIES} onDone={refresh} /></TabsContent>
        <TabsContent value="fees" className="mt-4"><Fees services={cat.SERVICES} onDone={refresh} /></TabsContent>
      </Tabs>
    </>
  );
}

function ServiceForm({ svc, cats, onDone }: { svc: MergedService | null; cats: { key: string; name: string }[]; onDone: () => void }) {
  const [f, setF] = useState({
    slug: svc?.slug ?? "", name: svc?.name ?? "", category: svc?.category ?? cats[0]?.key ?? "", short: svc?.short ?? "", overview: svc?.overview ?? "",
    who: (svc?.whoNeeds ?? []).join("\n"), docs: (svc?.documents ?? []).join("\n"), flow: (svc?.workflow ?? []).join("\n"), professional: svc?.professional ?? "",
    modes: (svc?.modes ?? ["Online"]).join(", "), popular: svc?.popular ?? false, visible: svc?.visible ?? true, sort: String(svc?.sort ?? 500),
  });
  const save = async () => {
    const slug = svc ? svc.slug : slugify(f.slug || f.name);
    if (f.name.trim().length < 2 || !slug) return toast.error("Name is required");
    const modes = f.modes.split(",").map((x) => x.trim()).filter((x) => x === "Online" || x === "In-person");
    const row = { slug, name: f.name.trim(), category: f.category, short: f.short.trim() || null, overview: f.overview.trim() || null,
      who_needs: lines(f.who), documents: lines(f.docs), workflow: lines(f.flow), professional: f.professional.trim() || null,
      modes: modes.length ? modes : ["Online"], popular: f.popular, visible: f.visible, sort: parseInt(f.sort) || 500, updated_at: new Date().toISOString() };
    const { error } = await supabase.from("services").upsert(row);
    if (error) return toast.error(error.message);
    toast.success("Service saved"); onDone();
  };
  return (
    <div className="card-surface mb-6 grid gap-3 p-5 md:grid-cols-2">
      <h2 className="font-semibold md:col-span-2">{svc ? `Edit ${svc.name}` : "New service"}</h2>
      <Input aria-label="Service name" placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      {!svc && <Input aria-label="Service slug" placeholder="URL slug (optional)" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} />}
      <select aria-label="Category" className={selectCls} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{cats.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}</select>
      <Input aria-label="Short description" placeholder="Short description" value={f.short} onChange={(e) => setF({ ...f, short: e.target.value })} />
      <Textarea className="md:col-span-2" aria-label="Overview" placeholder="Overview" rows={3} value={f.overview} onChange={(e) => setF({ ...f, overview: e.target.value })} />
      <Textarea aria-label="Who needs it" placeholder="Who needs it (one per line)" rows={4} value={f.who} onChange={(e) => setF({ ...f, who: e.target.value })} />
      <Textarea aria-label="Documents" placeholder="Document requirements shown to customers (one per line)" rows={4} value={f.docs} onChange={(e) => setF({ ...f, docs: e.target.value })} />
      <Textarea aria-label="Workflow" placeholder="Workflow steps (one per line)" rows={4} value={f.flow} onChange={(e) => setF({ ...f, flow: e.target.value })} />
      <Textarea aria-label="Professional role" placeholder="Role of the professional" rows={4} value={f.professional} onChange={(e) => setF({ ...f, professional: e.target.value })} />
      <Input aria-label="Modes" placeholder="Online, In-person" value={f.modes} onChange={(e) => setF({ ...f, modes: e.target.value })} />
      <Input aria-label="Sort order" type="number" placeholder="Sort order" value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value })} />
      <label className="flex items-center gap-2 text-sm"><Switch checked={f.visible} onCheckedChange={(v) => setF({ ...f, visible: v })} />Visible on website</label>
      <label className="flex items-center gap-2 text-sm"><Switch checked={f.popular} onCheckedChange={(v) => setF({ ...f, popular: v })} />Show as popular</label>
      <div className="flex gap-2 md:col-span-2"><Button variant="accent" onClick={save}>Save service</Button><Button variant="outline" onClick={onDone}>Cancel</Button></div>
    </div>
  );
}

function Categories({ cats, onDone }: { cats: { key: string; name: string; blurb: string; visible: boolean; sort: number }[]; onDone: () => void }) {
  const [rows, setRows] = useState(cats);
  const [nk, setNk] = useState({ name: "", blurb: "" });
  const save = async (c: (typeof cats)[number]) => {
    const { error } = await supabase.from("service_categories").upsert({ key: c.key, name: c.name.trim(), blurb: c.blurb || null, visible: c.visible, sort: c.sort, updated_at: new Date().toISOString() });
    if (error) return toast.error(error.message);
    toast.success("Category saved"); onDone();
  };
  const add = async () => {
    const key = slugify(nk.name).slice(0, 40);
    if (key.length < 2) return toast.error("Enter a category name");
    await save({ key, name: nk.name, blurb: nk.blurb, visible: true, sort: (rows.length + 1) * 10 });
    setRows([...rows, { key, name: nk.name, blurb: nk.blurb, visible: true, sort: (rows.length + 1) * 10 }]); setNk({ name: "", blurb: "" });
  };
  return (
    <div className="grid gap-3">
      {rows.map((c, i) => (
        <div key={c.key} className="card-surface grid items-center gap-2 p-4 md:grid-cols-[1fr_2fr_90px_auto_auto]">
          <Input aria-label={`Name for ${c.key}`} value={c.name} onChange={(e) => setRows(rows.map((r, j) => j === i ? { ...r, name: e.target.value } : r))} />
          <Input aria-label={`Description for ${c.key}`} value={c.blurb} onChange={(e) => setRows(rows.map((r, j) => j === i ? { ...r, blurb: e.target.value } : r))} />
          <Input aria-label={`Sort for ${c.key}`} type="number" value={c.sort} onChange={(e) => setRows(rows.map((r, j) => j === i ? { ...r, sort: parseInt(e.target.value) || 0 } : r))} />
          <label className="flex items-center gap-2 text-sm"><Switch checked={c.visible} onCheckedChange={(v) => setRows(rows.map((r, j) => j === i ? { ...r, visible: v } : r))} />Visible</label>
          <Button size="sm" variant="outline" onClick={() => save(rows[i])}>Save</Button>
        </div>
      ))}
      <div className="card-surface grid gap-2 p-4 md:grid-cols-[1fr_2fr_auto]">
        <Input aria-label="New category name" placeholder="New category name" value={nk.name} onChange={(e) => setNk({ ...nk, name: e.target.value })} />
        <Input aria-label="New category description" placeholder="Description" value={nk.blurb} onChange={(e) => setNk({ ...nk, blurb: e.target.value })} />
        <Button onClick={add}>Add category</Button>
      </div>
    </div>
  );
}

function Fees({ services, onDone }: { services: MergedService[]; onDone: () => void }) {
  const [vals, setVals] = useState<Record<string, { amt: string; note: string }>>(
    Object.fromEntries(services.map((s) => [s.slug, { amt: s.fee?.fee_paise != null ? String(s.fee.fee_paise / 100) : "", note: s.fee?.note ?? "" }])),
  );
  const save = async (slug: string) => {
    const v = vals[slug];
    const amt = v.amt.trim() === "" ? null : Math.round(parseFloat(v.amt) * 100);
    if (amt != null && (isNaN(amt) || amt < 0)) return toast.error("Enter a valid amount or leave blank for 'To be announced'");
    const { error } = await supabase.from("platform_fees").upsert({ service_slug: slug, fee_paise: amt, note: v.note.trim() || null, updated_at: new Date().toISOString() });
    if (error) return toast.error(error.message);
    toast.success("Fee saved"); onDone();
  };
  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">LegalSetu's own platform fee per service, in ₹. Leave blank to show "To be announced". Professional fees are quoted separately by the professional and are never set here.</p>
      <div className="card-surface divide-y">{services.map((s) => (
        <div key={s.slug} className="grid items-center gap-2 p-4 md:grid-cols-[1.4fr_140px_1.4fr_auto]">
          <div><p className="font-medium">{s.name}</p><p className="text-xs text-muted-foreground">Current: {formatFee(s.fee)}</p></div>
          <Input aria-label={`Platform fee for ${s.name}`} type="number" min={0} placeholder="₹ (blank = TBA)" value={vals[s.slug]?.amt ?? ""} onChange={(e) => setVals({ ...vals, [s.slug]: { ...vals[s.slug], amt: e.target.value } })} />
          <Input aria-label={`Fee note for ${s.name}`} placeholder="Note (e.g. excl. GST)" value={vals[s.slug]?.note ?? ""} onChange={(e) => setVals({ ...vals, [s.slug]: { ...vals[s.slug], note: e.target.value } })} />
          <Button size="sm" variant="outline" onClick={() => save(s.slug)}>Save</Button>
        </div>
      ))}</div>
    </>
  );
}
