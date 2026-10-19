import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useMemo } from "react";
import { Search } from "lucide-react";
import { useCatalog } from "@/lib/catalog-live";
import { PageHero, ServiceCard, EmptyState } from "@/components/site/bits";
import { LocationSelect, selectCls } from "@/components/site/LocationSelect";
import { Button } from "@/components/ui/button";

const searchSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  mode: z.enum(["Online", "In-person"]).optional(),
  state: z.string().optional(),
  city: z.string().optional(),
});

export const Route = createFileRoute("/services/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Services Directory — LegalSetu" },
      { name: "description", content: "Browse GST, income tax, company registration, trademark, contract and compliance services available through LegalSetu." },
      { property: "og:title", content: "Services Directory — LegalSetu" },
      { property: "og:description", content: "Search and filter tax, legal and business services across India." },
    ],
  }),
  component: ServicesPage,
});

function ServicesPage() {
  const { SERVICES, CATEGORIES } = useCatalog();
  const s = Route.useSearch();
  const navigate = useNavigate({ from: "/services/" });
  const set = (patch: Partial<z.infer<typeof searchSchema>>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });

  const list = useMemo(() => {
    const t = (s.q ?? "").toLowerCase();
    return SERVICES.filter((x) =>
      (!s.category || x.category === s.category) &&
      (!s.mode || x.modes.includes(s.mode)) &&
      (!t || (x.name + x.short + x.overview).toLowerCase().includes(t)),
    );
  }, [s.q, s.category, s.mode, SERVICES]);

  return (
    <>
      <PageHero eyebrow="Services directory" title="Find the right service" subtitle="Clear service information, documents you'll need and how the process works. Professional fees are quoted per request." />
      <div className="container-page grid gap-8 py-12 lg:grid-cols-[280px_1fr]">
        <aside className="card-surface h-fit space-y-5 p-5 lg:sticky lg:top-24">
          <div>
            <label className="text-sm font-semibold" htmlFor="svc-q">Search</label>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input id="svc-q" value={s.q ?? ""} onChange={(e) => set({ q: e.target.value || undefined })} placeholder="e.g. GST" className={selectCls + " pl-9"} />
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold">Category</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Chip active={!s.category} onClick={() => set({ category: undefined })}>All</Chip>
              {CATEGORIES.map((c) => <Chip key={c.key} active={s.category === c.key} onClick={() => set({ category: c.key })}>{c.name}</Chip>)}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold">Mode</p>
            <div className="mt-2 flex gap-2">
              <Chip active={!s.mode} onClick={() => set({ mode: undefined })}>Any</Chip>
              <Chip active={s.mode === "Online"} onClick={() => set({ mode: "Online" })}>Online</Chip>
              <Chip active={s.mode === "In-person"} onClick={() => set({ mode: "In-person" })}>In-person</Chip>
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold">Location</p>
            <LocationSelect className="mt-2 grid-cols-1" state={s.state ?? ""} city={s.city ?? ""} onChange={(v) => set({ state: v.state || undefined, city: v.city || undefined })} />
            <p className="mt-2 text-xs text-muted-foreground">Your location is saved with your request. Local availability isn't guaranteed.</p>
          </div>
          <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">Price and availability filters will appear once verified pricing and availability data exist.</p>
          <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate({ search: {} })}>Clear filters</Button>
        </aside>
        <div>
          <p className="mb-4 text-sm text-muted-foreground">{list.length} service{list.length === 1 ? "" : "s"}</p>
          {list.length ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{list.map((x) => <ServiceCard key={x.slug} s={x} />)}</div>
          ) : (
            <EmptyState title="No services match" body="Try a different search or clear filters." action={<Button asChild variant="outline"><Link to="/services">Clear filters</Link></Button>} />
          )}
        </div>
      </div>
    </>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={"rounded-full border px-3 py-1 text-xs font-medium transition-colors " + (active ? "border-navy bg-navy text-navy-foreground" : "bg-card text-muted-foreground hover:border-accent hover:text-foreground")}>
      {children}
    </button>
  );
}
