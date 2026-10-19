import { queryOptions, useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { FileText } from "lucide-react";
import { CATEGORIES, SERVICES, genericFaqs, type Service } from "./catalog";
import { HOME_FAQS } from "./faqs";

/**
 * The code catalogue (src/lib/catalog.ts) holds defaults, icons and intake questions.
 * Admins can override names/text/visibility and add services in the database; the site
 * shows the merged result. If the database is unreachable the code catalogue is used.
 */
export type LiveService = {
  slug: string; name: string; category: string; short: string | null; overview: string | null;
  who_needs: string[]; documents: string[]; workflow: string[]; professional: string | null;
  modes: string[]; popular: boolean; visible: boolean; sort: number;
};
export type LiveCategory = { key: string; name: string; blurb: string | null; visible: boolean; sort: number };
export type LiveFee = { service_slug: string; fee_paise: number | null; note: string | null };
export type LiveData = { services: LiveService[]; categories: LiveCategory[]; fees: LiveFee[]; faqs: { q: string; a: string }[] | null };

const EMPTY: LiveData = { services: [], categories: [], fees: [], faqs: null };

export const getLiveCatalog = createServerFn({ method: "GET" }).handler(async (): Promise<LiveData> => {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env["SUPABASE_URL"]!;
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const sb = createClient(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const [s, c, f, q] = await Promise.all([
      sb.from("services").select("slug,name,category,short,overview,who_needs,documents,workflow,professional,modes,popular,visible,sort"),
      sb.from("service_categories").select("key,name,blurb,visible,sort"),
      sb.from("platform_fees").select("service_slug,fee_paise,note"),
      sb.from("faqs").select("question,answer,sort").eq("published", true).order("sort"),
    ]);
    return {
      services: (s.data ?? []) as LiveService[],
      categories: (c.data ?? []) as LiveCategory[],
      fees: (f.data ?? []) as LiveFee[],
      faqs: q.error ? null : (q.data ?? []).map((x) => ({ q: x.question, a: x.answer })),
    };
  } catch (e) {
    console.error("live catalog unavailable", e);
    return EMPTY;
  }
});

export const catalogQuery = queryOptions({ queryKey: ["live-catalog"], queryFn: () => getLiveCatalog(), staleTime: 60_000 });

export type MergedCategory = { key: string; name: string; blurb: string; icon: typeof FileText; visible: boolean; sort: number; custom: boolean };
export type MergedService = Service & { visible: boolean; sort: number; custom: boolean; fee?: LiveFee };

export function mergeCatalog(live: LiveData | undefined, includeHidden = false) {
  const d = live ?? EMPTY;
  const catRows = new Map(d.categories.map((c) => [c.key, c]));
  const cats: MergedCategory[] = CATEGORIES.map((c, i) => {
    const r = catRows.get(c.key);
    return { key: c.key, name: r?.name ?? c.name, blurb: r?.blurb ?? c.blurb, icon: c.icon, visible: r?.visible ?? true, sort: r?.sort ?? (i + 1) * 10, custom: false };
  });
  for (const r of d.categories) if (!CATEGORIES.some((c) => c.key === r.key)) cats.push({ key: r.key, name: r.name, blurb: r.blurb ?? "", icon: FileText, visible: r.visible, sort: r.sort, custom: true });
  cats.sort((a, b) => a.sort - b.sort);
  const hiddenCats = new Set(cats.filter((c) => !c.visible).map((c) => c.key));

  const svcRows = new Map(d.services.map((s) => [s.slug, s]));
  const fees = new Map(d.fees.map((f) => [f.service_slug, f]));
  const svcs: MergedService[] = SERVICES.map((s, i) => {
    const r = svcRows.get(s.slug);
    const base = { ...s, visible: true, sort: (i + 1) * 10, custom: false, fee: fees.get(s.slug) };
    if (!r) return base;
    return {
      ...base, name: r.name, category: r.category as Service["category"], short: r.short ?? s.short, overview: r.overview ?? s.overview,
      whoNeeds: r.who_needs.length ? r.who_needs : s.whoNeeds, documents: r.documents.length ? r.documents : s.documents,
      workflow: r.workflow.length ? r.workflow : s.workflow, professional: r.professional ?? s.professional,
      modes: (r.modes.length ? r.modes : s.modes) as Service["modes"], popular: r.popular, visible: r.visible, sort: r.sort,
    };
  });
  for (const r of d.services) {
    if (SERVICES.some((s) => s.slug === r.slug)) continue;
    svcs.push({
      slug: r.slug, name: r.name, category: r.category as Service["category"], icon: FileText, short: r.short ?? "", overview: r.overview ?? "",
      whoNeeds: r.who_needs, documents: r.documents, workflow: r.workflow, professional: r.professional ?? "",
      modes: (r.modes.length ? r.modes : ["Online"]) as Service["modes"], popular: r.popular, questions: [], faqs: genericFaqs(r.name),
      visible: r.visible, sort: r.sort, custom: true, fee: fees.get(r.slug),
    });
  }
  svcs.sort((a, b) => a.sort - b.sort);
  const services = includeHidden ? svcs : svcs.filter((s) => s.visible && !hiddenCats.has(s.category));
  const categories = includeHidden ? cats : cats.filter((c) => c.visible);
  return {
    SERVICES: services,
    CATEGORIES: categories,
    FAQS: d.faqs ?? HOME_FAQS,
    getService: (slug: string) => services.find((s) => s.slug === slug),
    categoryName: (k: string) => cats.find((c) => c.key === k)?.name ?? k,
  };
}

export function useCatalog(includeHidden = false) {
  const { data } = useQuery(catalogQuery);
  return useMemo(() => mergeCatalog(data, includeHidden), [data, includeHidden]);
}

export const formatFee = (f?: LiveFee) =>
  !f || f.fee_paise == null ? "To be announced" : `₹${(f.fee_paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
