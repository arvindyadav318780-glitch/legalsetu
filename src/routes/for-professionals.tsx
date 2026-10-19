import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, CalendarDays, FolderLock, MessageSquare, ShieldAlert, Workflow } from "lucide-react";
import { PageHero } from "@/components/site/bits";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/for-professionals")({
  head: () => ({
    meta: [
      { title: "For Professionals — LegalSetu" },
      { name: "description", content: "A secure workspace for CAs, advocates and company secretaries: engagements, documents, appointments and credential verification." },
      { property: "og:title", content: "LegalSetu for Professionals" },
      { property: "og:description", content: "Grow your professional workflow — without lead selling or referral fees." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <>
      <PageHero eyebrow="For professionals" title="Grow Your Professional Workflow with LegalSetu." subtitle="Software for CA firms, advocates, company secretaries and eligible service providers.">
        <Button asChild variant="accent" size="lg"><Link to="/auth" search={{ mode: "signup", type: "professional" }}>Join as a Professional</Link></Button>
      </PageHero>
      <div className="container-page grid gap-5 py-14 md:grid-cols-3">
        {[
          { i: BadgeCheck, t: "Credential verification", d: "Submit registration details; a verified badge shows only after review." },
          { i: Workflow, t: "Engagement workflow", d: "Track assigned requests through clear statuses." },
          { i: FolderLock, t: "Secure documents", d: "Access only the documents linked to your assigned engagements." },
          { i: CalendarDays, t: "Appointments", d: "Confirm or decline appointment requests." },
          { i: MessageSquare, t: "Client messaging", d: "Request-specific, private conversations." },
          { i: ShieldAlert, t: "Independence safeguards", d: "You decide whether to accept work and set your own fees." },
        ].map((x) => <div key={x.t} className="card-surface p-6"><x.i className="h-5 w-5 text-accent" /><h2 className="mt-3 font-semibold">{x.t}</h2><p className="mt-1 text-sm text-muted-foreground">{x.d}</p></div>)}
      </div>
      <div className="container-page">
        <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          <strong className="text-foreground">Compliance note:</strong> Any proposed LegalSetu platform fee is shown only inside the professional dashboard and is currently not collected pending legal review. We do not guarantee clients, take any percentage of professional fees or share professional fees. Professionals remain responsible for complying with the rules of their respective professional bodies.
        </div>
      </div>
    </>
  );
}
