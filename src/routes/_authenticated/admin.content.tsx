import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DashHeader, fmtDate } from "@/components/dash/DashShell";
import { selectCls } from "@/components/site/LocationSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { BLOG_CATS } from "@/lib/faqs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FaqManager } from "@/components/dash/FaqManager";

export const Route = createFileRoute("/_authenticated/admin/content")({ component: Content });

const empty = { id: "", title: "", slug: "", excerpt: "", body: "", category: BLOG_CATS[0], published: false };

function Content() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [f, setF] = useState(empty);
  const { data = [] } = useQuery({
    queryKey: ["admin-posts"],
    queryFn: async () => (await supabase.from("blog_posts").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const save = async () => {
    const slug = (f.slug || f.title).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
    if (!f.title.trim() || !f.body.trim() || !slug) return toast.error("Title and body are required");
    const row = { title: f.title.trim(), slug, excerpt: f.excerpt || null, body: f.body, category: f.category, published: f.published, published_at: f.published ? new Date().toISOString() : null };
    const { error } = f.id ? await supabase.from("blog_posts").update(row).eq("id", f.id) : await supabase.from("blog_posts").insert(row);
    if (error) return toast.error(error.message);
    toast.success("Saved"); setF(empty); qc.invalidateQueries({ queryKey: ["admin-posts"] });
  };
  if (!isAdmin) return <p className="text-muted-foreground">Only administrators can manage content.</p>;
  return (
    <>
      <DashHeader title="Content management" subtitle="Guides for the Knowledge Center and FAQs shown on the homepage and Help Center. Services are managed under Services & fees." />
      <Tabs defaultValue="guides">
      <TabsList><TabsTrigger value="guides">Guides</TabsTrigger><TabsTrigger value="faqs">FAQs</TabsTrigger></TabsList>
      <TabsContent value="faqs" className="mt-4"><FaqManager /></TabsContent>
      <TabsContent value="guides" className="mt-4">
      <div className="card-surface grid gap-3 p-5">
        <div className="grid gap-3 md:grid-cols-2"><Input placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /><Input placeholder="Slug (optional)" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} /></div>
        <div className="grid gap-3 md:grid-cols-2"><Input placeholder="Excerpt" value={f.excerpt} onChange={(e) => setF({ ...f, excerpt: e.target.value })} /><select className={selectCls} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{BLOG_CATS.map((c) => <option key={c}>{c}</option>)}</select></div>
        <Textarea rows={8} placeholder="Body (separate paragraphs with a blank line)" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
        <div className="flex items-center gap-3"><Switch checked={f.published} onCheckedChange={(v) => setF({ ...f, published: v })} /><span className="text-sm">Published</span></div>
        <div className="flex gap-2"><Button variant="accent" onClick={save}>{f.id ? "Update" : "Create"} article</Button>{f.id && <Button variant="outline" onClick={() => setF(empty)}>Cancel edit</Button>}</div>
      </div>
      <div className="card-surface mt-6 divide-y">{data.map((p) => (
        <div key={p.id} className="flex items-center gap-3 p-4">
          <div className="min-w-0 flex-1"><p className="font-medium">{p.title}</p><p className="text-xs text-muted-foreground">{p.category} · {p.published ? "Published" : "Draft"} · {fmtDate(p.created_at)}</p></div>
          <Button variant="outline" size="sm" onClick={() => setF({ id: p.id, title: p.title, slug: p.slug, excerpt: p.excerpt ?? "", body: p.body, category: p.category, published: p.published })}>Edit</Button>
        </div>
      ))}</div>
      </TabsContent>
      </Tabs>
    </>
  );
}
