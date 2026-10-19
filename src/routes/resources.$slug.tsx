import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

async function fetchPost(slug: string) {
  const sb = createClient<Database>(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { data } = await sb.from("blog_posts").select("slug,title,excerpt,body,category,author_name,published_at").eq("slug", slug).eq("published", true).maybeSingle();
  if (!data) return null;
  const { data: related } = await sb.from("blog_posts").select("slug,title").eq("published", true).eq("category", data.category).neq("slug", slug).limit(3);
  return { post: data, related: related ?? [] };
}

export const Route = createFileRoute("/resources/$slug")({
  loader: async ({ params }) => {
    const r = await fetchPost(params.slug);
    if (!r) throw notFound();
    return r;
  },
  head: ({ loaderData }) => loaderData ? {
    meta: [
      { title: `${loaderData.post.title} — LegalSetu` },
      { name: "description", content: loaderData.post.excerpt ?? "" },
      { property: "og:title", content: loaderData.post.title },
      { property: "og:description", content: loaderData.post.excerpt ?? "" },
      { property: "og:type", content: "article" },
    ],
  } : { meta: [{ title: "Article unavailable — LegalSetu" }, { name: "robots", content: "noindex" }] },
  notFoundComponent: () => <div className="container-page py-24 text-center"><h1 className="text-2xl font-bold">Article not found</h1><Button asChild className="mt-6"><Link to="/resources">All resources</Link></Button></div>,
  errorComponent: () => <div className="container-page py-24 text-center"><h1 className="text-2xl font-bold">Couldn't load this article</h1><Button asChild className="mt-6"><Link to="/resources">All resources</Link></Button></div>,
  component: Article,
});

function Article() {
  const { post, related } = Route.useLoaderData();
  return (
    <article className="container-page max-w-3xl py-14">
      <Link to="/resources" className="text-sm text-accent hover:underline">← Resources</Link>
      <p className="eyebrow mt-6">{post.category}</p>
      <h1 className="mt-2 text-3xl font-bold md:text-4xl">{post.title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">By {post.author_name} · {post.published_at ? new Date(post.published_at).toLocaleDateString("en-IN", { dateStyle: "long" }) : ""}</p>
      <div className="card-surface mt-8 space-y-4 p-6 leading-relaxed md:p-8">
        {post.body.split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>)}
      </div>
      <div className="mt-6 flex gap-3 rounded-xl border border-warning/40 bg-warning-soft p-4 text-sm text-warning">
        <AlertTriangle className="h-5 w-5 shrink-0" /> This article is general educational information, not personalised legal or tax advice. Rules change — consult a qualified professional.
      </div>
      {related.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold">Related articles</h2>
          <ul className="mt-3 space-y-2">{related.map((r) => <li key={r.slug}><Link to="/resources/$slug" params={{ slug: r.slug }} className="text-accent hover:underline">{r.title}</Link></li>)}</ul>
        </div>
      )}
    </article>
  );
}
