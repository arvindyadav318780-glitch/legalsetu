import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search } from "lucide-react";
import { PageHero, EmptyState } from "@/components/site/bits";
import { useCatalog } from "@/lib/catalog-live";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { selectCls } from "@/components/site/LocationSelect";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help Center — LegalSetu" },
      { name: "description", content: "Search answers to common questions about LegalSetu requests, documents, pricing and professionals." },
      { property: "og:title", content: "LegalSetu Help Center" },
      { property: "og:description", content: "FAQs and support for LegalSetu users." },
    ],
  }),
  component: Help,
});

function Help() {
  const { FAQS: HOME_FAQS } = useCatalog();
  const [q, setQ] = useState("");
  const list = HOME_FAQS.filter((f) => (f.q + f.a).toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHero eyebrow="Help Center" title="How can we help?">
        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input aria-label="Search FAQs" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search questions" className={selectCls + " h-12 pl-10"} />
        </div>
      </PageHero>
      <div className="container-page max-w-3xl py-12">
        {list.length ? (
          <Accordion type="single" collapsible className="card-surface px-5">
            {list.map((f, i) => <AccordionItem key={f.q} value={String(i)}><AccordionTrigger className="text-left font-semibold">{f.q}</AccordionTrigger><AccordionContent className="text-muted-foreground">{f.a}</AccordionContent></AccordionItem>)}
          </Accordion>
        ) : <EmptyState title="No matching answers" body="Try different words, or contact us." />}
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild><Link to="/dashboard/support">Create a support ticket</Link></Button>
          <Button asChild variant="outline"><Link to="/contact">Contact us</Link></Button>
        </div>
      </div>
    </>
  );
}
