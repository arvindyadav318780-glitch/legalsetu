import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Search, ShieldCheck, MapPin, Eye, Lock, Headphones, Globe2, ListChecks, ArrowRight, CheckCircle2,
  Briefcase, CalendarDays, FolderLock, CreditCard, MessageSquareQuote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCatalog } from "@/lib/catalog-live";
import { ServiceCard, SectionHeading, StatusPill } from "@/components/site/bits";
import { LocationSelect } from "@/components/site/LocationSelect";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { STEPS } from "@/lib/faqs";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LegalSetu — Everything Your Business Needs. All in One Place." },
      { name: "description", content: "Connect with qualified professionals for GST, taxation, legal support and business compliance — wherever you are in India." },
      { property: "og:title", content: "LegalSetu — Tax, Legal & Business Services Across India" },
      { property: "og:description", content: "GST, ITR, company registration, trademarks, contracts and compliance support from independent professionals." },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <>
      <Hero />
      <Popular />
      <Categories />
      <HowItWorks />
      <WhyUs />
      <ForPros />
      <Nationwide />
      <Reviews />
      <Faq />
      <FinalCta />
    </>
  );
}

function Hero() {
  const { SERVICES } = useCatalog();
  const [q, setQ] = useState("");
  const [loc, setLoc] = useState({ state: "", city: "" });
  const [focus, setFocus] = useState(false);
  const navigate = useNavigate();
  const suggestions = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return SERVICES.filter((s) => s.popular).slice(0, 5);
    return SERVICES.filter((s) => (s.name + " " + s.short).toLowerCase().includes(t)).slice(0, 6);
  }, [q, SERVICES]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/services", search: { q: q || undefined, state: loc.state || undefined, city: loc.city || undefined } });
  };

  return (
    <section className="hero-navy relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-navy via-navy/90 to-navy/40" aria-hidden />
      <div className="container-page relative grid items-center gap-12 py-14 md:py-20 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="animate-rise">
          <p className="inline-flex items-center gap-2 rounded-full border border-navy-foreground/15 bg-navy-foreground/5 px-3 py-1 text-xs font-medium text-navy-foreground/80">
            <ShieldCheck className="h-3.5 w-3.5 text-accent" /> Your Business. Your Legal Support. One Platform.
          </p>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] text-navy-foreground md:text-6xl">
            Everything Your Business Needs. <span className="text-accent">All in One Place.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-navy-foreground/75">
            Connect with qualified professionals for GST, taxation, legal support and business compliance — wherever you are in India.
          </p>

          <form onSubmit={submit} className="relative mt-8 rounded-lg bg-card p-3 shadow-2xl">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                aria-label="Search services"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onFocus={() => setFocus(true)}
                onBlur={() => setTimeout(() => setFocus(false), 150)}
                placeholder="Search e.g. GST registration, ITR, trademark…"
                className="h-12 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {focus && suggestions.length > 0 && (
                <ul className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl border bg-popover shadow-xl">
                  {suggestions.map((s) => (
                    <li key={s.slug}>
                      <Link to="/services/$slug" params={{ slug: s.slug }} className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted">
                        <s.icon className="h-4 w-4 text-accent" /> {s.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <LocationSelect state={loc.state} city={loc.city} onChange={setLoc} className="flex-1" />
              <Button type="submit" variant="accent" className="h-10">Search</Button>
            </div>
          </form>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild variant="accent" size="lg"><Link to="/services">Explore Services <ArrowRight /></Link></Button>
            <Button asChild variant="outline-inverted" size="lg"><Link to="/professionals" search={{ cat: "Chartered Accountant" }}>Find a CA</Link></Button>
            <Button asChild variant="outline-inverted" size="lg"><Link to="/professionals" search={{ cat: "Advocate" }}>Find an Advocate</Link></Button>
          </div>
          <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-navy-foreground/70">
            {["Private document storage", "Transparent, separate fees", "Track every request"].map((t) => (
              <li key={t} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-accent" />{t}</li>
            ))}
          </ul>
        </div>

        <div className="relative hidden lg:block">
          <div className="rounded-2xl bg-gradient-to-br from-accent/15 via-navy-2/70 to-navy p-6 ring-1 ring-navy-foreground/10">
            <div className="card-surface p-5 text-foreground shadow-2xl">
            <p className="text-xs font-semibold text-muted-foreground">Request LS-8F2A91C0 · sample</p>
            <p className="mt-1 font-semibold">GST Registration</p>
            <ol className="mt-3 space-y-2 text-sm">
              {[["Submitted", "completed"], ["Under Review", "completed"], ["Customer Action Required", "customer_action_required"]].map(([l, s]) => (
                <li key={l} className="flex items-center justify-between"><span>{l}</span><StatusPill status={s} label={s === "completed" ? "Done" : "Action needed"} /></li>
              ))}
            </ol>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Popular() {
  const { SERVICES } = useCatalog();
  return (
    <section className="container-page py-20">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <SectionHeading eyebrow="Popular services" title="Start with what you need today" subtitle="Clear information on every service, with professional fees quoted separately and transparently." />
        <Button asChild variant="outline"><Link to="/services">All services <ArrowRight /></Link></Button>
      </div>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {SERVICES.filter((s) => s.popular).map((s) => <ServiceCard key={s.slug} s={s} />)}
      </div>
    </section>
  );
}

function Categories() {
  const { CATEGORIES } = useCatalog();
  return (
    <section className="paper border-y py-20">
      <div className="container-page">
        <SectionHeading eyebrow="Browse by category" title="Support for every stage of your business" center />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((c) => (
            <Link key={c.key} to="/services" search={{ category: c.key }} className="group card-surface card-interactive flex items-center gap-4 p-5">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-navy text-navy-foreground transition-colors group-hover:bg-accent"><c.icon className="h-5 w-5" /></span>
              <span className="flex-1">
                <span className="block font-semibold">{c.name}</span>
                <span className="block text-sm text-muted-foreground">{c.blurb}</span>
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-accent" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}


function HowItWorks() {
  return (
    <section className="container-page py-20">
      <SectionHeading eyebrow="How LegalSetu works" title="Four simple steps" center />
      <ol className="relative mt-12 grid gap-6 md:grid-cols-4">
        <div className="absolute left-0 right-0 top-6 hidden h-px bg-border md:block" aria-hidden />
        {STEPS.map((s, i) => (
          <li key={s.t} className="relative">
            <span className="relative grid h-12 w-12 place-items-center rounded-full border-4 border-background bg-navy text-sm font-bold text-navy-foreground">{i + 1}</span>
            <h3 className="mt-4 font-semibold">{s.t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function WhyUs() {
  const items = [
    { i: Globe2, t: "Convenient online access", d: "Request services and consultations from anywhere." },
    { i: ShieldCheck, t: "Credentials checked where applicable", d: "Verification status is shown honestly on every profile." },
    { i: Eye, t: "Transparent information", d: "Platform fees and professional fees are always shown separately." },
    { i: Lock, t: "Secure document workflows", d: "Private storage, access limited to people on your request." },
    { i: Headphones, t: "Customer support", d: "Raise a ticket any time and track its progress." },
    { i: MapPin, t: "Nationwide discovery", d: "Search across all states and union territories." },
    { i: ListChecks, t: "Easy request tracking", d: "A complete status history for every request." },
  ];
  return (
    <section className="paper border-y py-20">
      <div className="container-page grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <SectionHeading eyebrow="Why choose LegalSetu" title="Built for trust, not hype" subtitle="We focus on clarity, privacy and honest information — no unverified guarantees." />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((x) => (
            <div key={x.t} className="flex gap-4 rounded-lg border bg-card p-4">
              <x.i className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <div><h3 className="text-sm font-semibold">{x.t}</h3><p className="mt-1 text-sm text-muted-foreground">{x.d}</p></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ForPros() {
  const f = [
    { i: Briefcase, t: "Professional onboarding" },
    { i: FolderLock, t: "Secure client & document workflow" },
    { i: CalendarDays, t: "Appointment management" },
    { i: CreditCard, t: "Transparent workspace subscription" },
  ];
  return (
    <section className="container-page py-20">
      <div className="hero-navy relative overflow-hidden rounded-lg p-8 md:p-14">
        <div className="grid-lines pointer-events-none absolute inset-0 opacity-50" aria-hidden />
        <div className="relative grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="eyebrow">For CA firms, advocates & company secretaries</p>
            <h2 className="mt-3 text-3xl font-bold text-navy-foreground md:text-4xl">Grow Your Professional Workflow with LegalSetu.</h2>
            <p className="mt-4 text-navy-foreground/75">Software tools to manage engagements, documents and appointments. No lead selling, referral fees or fee-sharing — you keep full professional independence.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild variant="accent" size="lg"><Link to="/auth" search={{ mode: "signup", type: "professional" }}>Join as a Professional</Link></Button>
              <Button asChild variant="outline-inverted" size="lg"><Link to="/for-professionals">Learn more</Link></Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {f.map((x) => (
              <div key={x.t} className="rounded-xl border border-navy-foreground/10 bg-navy-foreground/5 p-5">
                <x.i className="h-5 w-5 text-accent" />
                <p className="mt-3 font-semibold text-navy-foreground">{x.t}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Nationwide() {
  const [loc, setLoc] = useState({ state: "", city: "" });
  return (
    <section className="hero-navy py-20">
      <div className="container-page grid gap-10 lg:grid-cols-2 lg:items-center">
        <SectionHeading eyebrow="Nationwide access" title="Professional Support, Across India." subtitle="Search across all 28 states and 8 union territories. Local availability depends on registered professionals in each area." />
        <div className="card-surface p-6">
          <p className="text-sm font-semibold">Find support near you</p>
          <LocationSelect state={loc.state} city={loc.city} onChange={setLoc} className="mt-3" />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button asChild variant="outline"><Link to="/services" search={{ state: loc.state || undefined, city: loc.city || undefined }}>Services</Link></Button>
            <Button asChild><Link to="/professionals" search={{ state: loc.state || undefined, city: loc.city || undefined }}>Professionals</Link></Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Many services are available online regardless of your location.</p>
        </div>
      </div>
    </section>
  );
}

function Reviews() {
  return (
    <section className="container-page py-20">
      <div className="card-surface flex flex-col items-center gap-3 p-10 text-center">
        <MessageSquareQuote className="h-8 w-8 text-accent" />
        <h2 className="text-xl font-semibold">Verified reviews will appear here after launch</h2>
        <p className="max-w-lg text-sm text-muted-foreground">We only publish reviews from customers with completed requests. We never display invented testimonials.</p>
      </div>
    </section>
  );
}

function Faq() {
  const { FAQS: HOME_FAQS } = useCatalog();
  return (
    <section className="container-page grid gap-10 pb-20 lg:grid-cols-[0.8fr_1.2fr]">
      <SectionHeading eyebrow="FAQ" title="Common questions" subtitle="Can't find your answer? Visit the Help Center or contact us." />
      <Accordion type="single" collapsible className="card-surface px-5">
        {HOME_FAQS.map((f, i) => (
          <AccordionItem key={f.q} value={String(i)}>
            <AccordionTrigger className="text-left font-semibold">{f.q}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="container-page">
      <div className="card-surface flex flex-col items-center gap-5 px-6 py-14 text-center">
        <h2 className="max-w-2xl text-3xl font-bold md:text-4xl">Let's Make Business Compliance Simpler.</h2>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild variant="accent" size="lg"><Link to="/services">Explore Services</Link></Button>
          <Button asChild variant="outline" size="lg"><Link to="/auth" search={{ mode: "signup" }}>Create Your Account</Link></Button>
        </div>
      </div>
    </section>
  );
}
