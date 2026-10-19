import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ArrowRight, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { statusLabel, statusTone, type Tone } from "@/lib/status";
import { type Service } from "@/lib/catalog";
import { useCatalog } from "@/lib/catalog-live";
import { Button } from "@/components/ui/button";

export function PageHero({ eyebrow, title, subtitle, children }: { eyebrow?: string; title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <section className="hero-navy relative overflow-hidden">
      <div className="grid-lines pointer-events-none absolute inset-0 opacity-60" aria-hidden />
      <div className="container-page relative py-14 md:py-20">
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h1 className="max-w-3xl text-3xl font-bold text-navy-foreground md:text-5xl">{title}</h1>
        {subtitle && <p className="mt-4 max-w-2xl text-base text-navy-foreground/75 md:text-lg">{subtitle}</p>}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  );
}

export function SectionHeading({ eyebrow, title, subtitle, center }: { eyebrow?: string; title: string; subtitle?: string; center?: boolean }) {
  return (
    <div className={cn("max-w-2xl", center && "mx-auto text-center")}>
      {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
      <h2 className="text-2xl font-bold md:text-4xl">{title}</h2>
      {subtitle && <p className="mt-3 text-muted-foreground md:text-lg">{subtitle}</p>}
    </div>
  );
}

const toneCls: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-teal-soft text-accent",
  warning: "bg-warning-soft text-warning",
  success: "bg-success-soft text-success",
  danger: "bg-destructive/10 text-destructive",
};

export function StatusPill({ status, label }: { status: string; label?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", toneCls[statusTone(status)])}>
      {label ?? statusLabel(status)}
    </span>
  );
}

export function DemoBadge() {
  return <span className="inline-flex items-center rounded-md border border-warning/40 bg-warning-soft px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-warning">Demo</span>;
}

export function FutureBadge({ label = "Coming soon" }: { label?: string }) {
  return <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>;
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="card-surface flex flex-col items-center px-6 py-14 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-teal-soft text-accent"><Inbox className="h-5 w-5" /></span>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      {body && <p className="mt-1 max-w-md text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ServiceCard({ s }: { s: Service }) {
  const { categoryName } = useCatalog(true);
  return (
    <article className="card-surface card-interactive flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-teal-soft text-accent"><s.icon className="h-5 w-5" /></span>
        <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{categoryName(s.category)}</span>
      </div>
      <h3 className="mt-4 text-base font-semibold">{s.name}</h3>
      <p className="mt-1.5 flex-1 text-sm text-muted-foreground">{s.short}</p>
      <div className="mt-5 flex items-center gap-2">
        <Button asChild variant="outline" size="sm" className="flex-1"><Link to="/services/$slug" params={{ slug: s.slug }}>View Details</Link></Button>
        <Button asChild variant="accent" size="sm" className="flex-1"><Link to="/request/$slug" params={{ slug: s.slug }}>Request <ArrowRight /></Link></Button>
      </div>
    </article>
  );
}

export function LegalReviewNote() {
  return (
    <div className="rounded-lg border border-warning/40 bg-warning-soft p-4 text-sm text-warning">
      <strong>Legal review placeholder.</strong> This text is a draft and must be reviewed by a qualified Indian legal professional before production use.
    </div>
  );
}
