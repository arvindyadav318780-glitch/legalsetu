import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHero, EmptyState } from "@/components/site/bits";
import { selectCls } from "@/components/site/LocationSelect";
import { Skeleton } from "@/components/ui/skeleton";
import { BLOG_CATS } from "@/lib/faqs";


export const Route = createFileRoute("/resources/")({
  head: () => ({
    meta: [
      { title: "Resources & Knowledge Center — LegalSetu" },
      { name: "description", content: "Plain-language guides on GST, income tax, business registration, compliance and legal basics for Indian businesses." },
      { property: "og:title", content: "LegalSetu Knowledge Center" },
      { property: "og:description", content: "Educational guides for Indian small businesses." },
    ],
  }),
  component: Resources,
});

function Resources() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["posts"],
    queryFn: async () => (await supabase.from("blog_posts").select("slug,title,excerpt,category,author_name,published_at").eq("published", true).order("published_at", { ascending: false })).data ?? [],
  });
  const list = (data ?? []).filter((p) => (!cat || p.category === cat) && (p.title + (p.excerpt ?? "")).toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHero eyebrow="Knowledge center" title="Guides for running your business" subtitle="General educational content — not personalised professional advice." />
      <div className="container-page py-12">
        <div className="flex flex-col gap-3 md:flex-row">
          <input aria-label="Search articles" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search articles" className={selectCls + " md:max-w-sm"} />
          <select aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)} className={selectCls + " md:max-w-xs"}>
            <option value="">All categories</option>{BLOG_CATS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {isLoading && [1, 2, 3].map((i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
          {!isLoading && list.length === 0 && <div className="md:col-span-3"><EmptyState title="No articles found" /></div>}
          {list.map((p) => (
            <Link key={p.slug} to="/resources/$slug" params={{ slug: p.slug }} className="card-surface card-interactive flex flex-col p-6">
              <span className="eyebrow">{p.category}</span>
              <h2 className="mt-2 text-lg font-semibold">{p.title}</h2>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{p.excerpt}</p>
              <p className="mt-4 text-xs text-muted-foreground">{p.author_name} · {p.published_at ? new Date(p.published_at).toLocaleDateString("en-IN", { dateStyle: "medium" }) : ""}</p>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
