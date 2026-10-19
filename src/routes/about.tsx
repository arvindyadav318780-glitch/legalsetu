import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero } from "@/components/site/bits";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Us — LegalSetu" },
      { name: "description", content: "LegalSetu is a technology platform helping Indian individuals and businesses discover professionals for tax, legal and business services." },
      { property: "og:title", content: "About LegalSetu" },
      { property: "og:description", content: "Our mission, our role as a platform, and the principles we follow." },
    ],
  }),
  component: About,
});

function About() {
  return (
    <>
      <PageHero eyebrow="About LegalSetu" title="A bridge between businesses and professional support" subtitle="'Setu' means bridge. We build software that makes finding and working with professionals simpler, safer and more transparent." />
      <div className="container-page grid gap-6 py-14 md:grid-cols-3">
        {[
          { t: "Our mission", d: "Make tax, legal and compliance support accessible to every shopkeeper, freelancer, startup and company in India." },
          { t: "Our role", d: "LegalSetu is a technology platform. We are not a law firm, CA firm or government body, and we don't provide legal or tax advice." },
          { t: "Our principles", d: "Honest information, privacy by default, clear separation of platform and professional fees, and respect for professional independence." },
        ].map((x) => <div key={x.t} className="card-surface p-6"><h2 className="text-lg font-semibold">{x.t}</h2><p className="mt-2 text-muted-foreground">{x.d}</p></div>)}
      </div>
      <div className="container-page">
        <div className="card-surface p-8">
          <h2 className="text-xl font-semibold">What we will never do</h2>
          <ul className="mt-4 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
            <li>• Invent professional profiles, reviews or credentials</li>
            <li>• Claim government approval or regulatory affiliation</li>
            <li>• Take a percentage of, or share in, professional fees</li>
            <li>• File anything on your behalf without an authorised professional and your consent</li>
          </ul>
          <div className="mt-6 flex gap-3"><Button asChild><Link to="/contact">Contact us</Link></Button><Button asChild variant="outline"><Link to="/legal/$page" params={{ page: "platform-role" }}>Platform role</Link></Button></div>
        </div>
      </div>
    </>
  );
}
