import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock, MessageSquare, FileCheck2, Bell } from "lucide-react";
import { PageHero } from "@/components/site/bits";
import { Button } from "@/components/ui/button";
import { STEPS } from "@/lib/faqs";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How It Works — LegalSetu" },
      { name: "description", content: "Select a service, share requirements securely, review options and track your request — here's how LegalSetu works." },
      { property: "og:title", content: "How LegalSetu Works" },
      { property: "og:description", content: "A simple four-step process for tax, legal and business services." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <>
      <PageHero eyebrow="How it works" title="From request to resolution, clearly." subtitle="Every step is visible in your dashboard, and professionals act only with your consent." />
      <div className="container-page py-14">
        <ol className="grid gap-5 md:grid-cols-2">
          {STEPS.map((s, i) => (
            <li key={s.t} className="card-surface flex gap-5 p-6">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-navy text-lg font-bold text-navy-foreground">{i + 1}</span>
              <div><h2 className="text-lg font-semibold">{s.t}</h2><p className="mt-1 text-muted-foreground">{s.d}</p></div>
            </li>
          ))}
        </ol>
        <div className="mt-12 grid gap-4 md:grid-cols-4">
          {[
            { i: Lock, t: "Private documents", d: "Stored privately, shared only with your assigned professional." },
            { i: MessageSquare, t: "Request messaging", d: "Talk securely within each request." },
            { i: FileCheck2, t: "Consent first", d: "Nothing is filed without your review and approval." },
            { i: Bell, t: "Status updates", d: "Get notified as your request progresses." },
          ].map((x) => (
            <div key={x.t} className="rounded-xl border bg-card p-5"><x.i className="h-5 w-5 text-accent" /><h3 className="mt-3 font-semibold">{x.t}</h3><p className="mt-1 text-sm text-muted-foreground">{x.d}</p></div>
          ))}
        </div>
        <div className="mt-12 flex justify-center gap-3">
          <Button asChild variant="accent" size="lg"><Link to="/services">Explore Services</Link></Button>
          <Button asChild variant="outline" size="lg"><Link to="/auth" search={{ mode: "signup" }}>Create account</Link></Button>
        </div>
      </div>
    </>
  );
}
