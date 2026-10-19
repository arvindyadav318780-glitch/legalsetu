import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { CheckCircle2, FileText, UserCheck, AlertTriangle, ArrowRight } from "lucide-react";
import { catalogQuery, mergeCatalog, useCatalog, formatFee } from "@/lib/catalog-live";
import { PageHero, ServiceCard } from "@/components/site/bits";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const Route = createFileRoute("/services/$slug")({
  loader: async ({ params, context }) => {
    const live = await context.queryClient.ensureQueryData(catalogQuery);
    const service = mergeCatalog(live).getService(params.slug);
    if (!service) throw notFound();
    return { slug: service.slug, name: service.name, short: service.short, overview: service.overview };
  },
  head: ({ loaderData }) => {
    const s = loaderData;
    if (!s) return { meta: [{ title: "Service not found — LegalSetu" }, { name: "robots", content: "noindex" }] };
    return {
      meta: [
        { title: `${s.name} — LegalSetu` },
        { name: "description", content: s.short + " " + s.overview.slice(0, 100) },
        { property: "og:title", content: `${s.name} — LegalSetu` },
        { property: "og:description", content: s.short },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="container-page py-24 text-center">
      <h1 className="text-3xl font-bold">Service not found</h1>
      <Button asChild className="mt-6"><Link to="/services">Browse all services</Link></Button>
    </div>
  ),
  component: ServiceDetail,
});

function ServiceDetail() {
  const { slug } = Route.useLoaderData();
  const { getService, categoryName, SERVICES } = useCatalog();
  const s = getService(slug);
  if (!s) return null;
  const related = SERVICES.filter((x) => x.category === s.category && x.slug !== s.slug).slice(0, 3);
  return (
    <>
      <PageHero eyebrow={categoryName(s.category)} title={s.name} subtitle={s.short}>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="accent" size="lg"><Link to="/request/$slug" params={{ slug: s.slug }}>Request this service <ArrowRight /></Link></Button>
          <Button asChild variant="outline-inverted" size="lg"><Link to="/professionals">Find a Professional</Link></Button>
        </div>
      </PageHero>
      <div className="container-page grid gap-8 py-12 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Block title="Overview"><p className="text-muted-foreground">{s.overview}</p></Block>
          <Block title="Who needs this service">
            <ul className="grid gap-2 sm:grid-cols-2">{s.whoNeeds.map((w) => <li key={w} className="flex gap-2 text-sm"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{w}</li>)}</ul>
          </Block>
          <Block title="Documents typically required">
            <ul className="space-y-2">{s.documents.map((d) => <li key={d} className="flex gap-2 text-sm"><FileText className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{d}</li>)}</ul>
            <p className="mt-3 text-xs text-muted-foreground">Only share what's needed. Requirements may vary; the professional will confirm.</p>
          </Block>
          <Block title="Service workflow">
            <ol className="space-y-3">{s.workflow.map((w, i) => (
              <li key={w} className="flex items-start gap-3 text-sm"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-navy text-xs font-bold text-navy-foreground">{i + 1}</span><span className="pt-0.5">{w}</span></li>
            ))}</ol>
          </Block>
          <Block title="Professional involvement">
            <p className="flex gap-2 text-sm text-muted-foreground"><UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{s.professional}</p>
          </Block>
          <Block title="FAQs">
            <Accordion type="single" collapsible>
              {s.faqs.map((f, i) => (
                <AccordionItem key={i} value={String(i)}>
                  <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Block>
          <div className="flex gap-3 rounded-xl border border-warning/40 bg-warning-soft p-4 text-sm text-warning">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p>This page is general information, not professional advice. LegalSetu does not submit returns, filings or applications itself — an authorised professional acts only with your consent.</p>
          </div>
        </div>
        <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
          <div className="card-surface p-5">
            <p className="text-sm text-muted-foreground">Pricing</p>
            <p className="mt-1 text-2xl font-bold">Request a Quote</p>
            <p className="mt-2 text-sm text-muted-foreground">Professional fees are quoted by the professional after reviewing your request, shown separately from any platform fee.</p>
            <p className="mt-3 text-sm"><span className="text-muted-foreground">LegalSetu platform fee:</span> {formatFee(s.fee)}</p>
            <p className="text-sm"><span className="text-muted-foreground">Timeline:</span> confirmed in your quote</p>
            <p className="text-sm"><span className="text-muted-foreground">Mode:</span> {s.modes.join(" / ")}</p>
            <Button asChild variant="accent" className="mt-5 w-full"><Link to="/request/$slug" params={{ slug: s.slug }}>Request this service</Link></Button>
          </div>
        </aside>
      </div>
      {related.length > 0 && (
        <section className="container-page">
          <h2 className="mb-5 text-xl font-bold">Related services</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{related.map((r) => <ServiceCard key={r.slug} s={r} />)}</div>
        </section>
      )}
    </>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="card-surface p-6"><h2 className="mb-4 text-lg font-semibold">{title}</h2>{children}</section>;
}
