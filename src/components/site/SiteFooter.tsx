import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { useCatalog } from "@/lib/catalog-live";

export function SiteFooter() {
  const { CATEGORIES } = useCatalog();
  return (
    <footer className="hero-navy mt-24">
      <div className="container-page grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Logo inverted />
          <p className="mt-4 max-w-sm text-sm text-navy-foreground/70">
            Your Business. Your Legal Support. One Platform. LegalSetu is a technology platform that helps you discover independent professionals. It is not a law firm or CA firm and does not provide legal or tax advice.
          </p>
          <div className="mt-5 flex gap-3 text-sm text-navy-foreground/60">
            <span title="Social profiles will be linked after launch">LinkedIn · X · Instagram — coming soon</span>
          </div>
        </div>
        <FooterCol title="Services" links={CATEGORIES.map((c) => ({ label: c.name, to: "/services", search: { category: c.key } }))} />
        <FooterCol title="Company" links={[
          { label: "About LegalSetu", to: "/about" },
          { label: "For Professionals", to: "/for-professionals" },
          { label: "Resources", to: "/resources" },
          { label: "Help Center", to: "/help" },
          { label: "Contact", to: "/contact" },
        ]} />
        <FooterCol title="Legal" links={[
          { label: "Privacy Policy", to: "/legal/$page", params: { page: "privacy" } },
          { label: "Terms and Conditions", to: "/legal/$page", params: { page: "terms" } },
          { label: "Refund and Cancellation", to: "/legal/$page", params: { page: "refunds" } },
          { label: "Professional Disclaimer", to: "/legal/$page", params: { page: "disclaimer" } },
          { label: "Data Protection", to: "/legal/$page", params: { page: "data-protection" } },
          { label: "Cookie Policy", to: "/legal/$page", params: { page: "cookies" } },
          { label: "Grievance Redressal", to: "/legal/$page", params: { page: "grievance" } },
          { label: "Platform Role", to: "/legal/$page", params: { page: "platform-role" } },
        ]} />
      </div>
      <div className="border-t border-navy-foreground/10">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-navy-foreground/60 md:flex-row md:justify-between">
          <span>© {new Date().getFullYear()} LegalSetu. All rights reserved.</span>
          <span>Not affiliated with any government body or regulator.</span>
        </div>
      </div>
    </footer>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FooterCol({ title, links }: { title: string; links: { label: string; to: any; search?: any; params?: any }[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-navy-foreground">{title}</h3>
      <ul className="mt-4 space-y-2.5">
        {links.map((l) => (
          <li key={l.label}>
            <Link to={l.to} search={l.search} params={l.params} className="text-sm text-navy-foreground/70 transition-colors hover:text-navy-foreground">{l.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
