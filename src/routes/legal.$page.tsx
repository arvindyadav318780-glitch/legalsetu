import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageHero, LegalReviewNote } from "@/components/site/bits";
import { Button } from "@/components/ui/button";

const PAGES: Record<string, { title: string; sections: [string, string][] }> = {
  terms: { title: "Terms of Use", sections: [
    ["Platform role", "LegalSetu provides software that helps users discover and communicate with independent professionals. LegalSetu is not a law firm, CA firm or government body and does not provide legal or tax advice."],
    ["Accounts", "You are responsible for keeping your login credentials secure and for information you submit."],
    ["Professional services", "Professional services are contracted directly between you and the professional, who is responsible for their advice and work."],
    ["Private messaging (draft — pending legal review)", "Clients contact verified professionals first. Conversations are private to the two participants; LegalSetu staff read a conversation only when it has been reported. Spam, harassment and sharing of passwords, OTPs or card details are prohibited. Rate limits apply, and accounts may be suspended after review, with a right of appeal."],
    ["Acceptable use", "Do not upload unlawful content, impersonate others or attempt to access data that isn't yours."],
  ] },
  privacy: { title: "Privacy Policy", sections: [
    ["Data we collect", "Account details, request details, documents you upload and usage information needed to operate the service."],
    ["How we use it", "To provide the platform, route requests, enable communication and meet legal obligations. We do not sell personal data."],
    ["Sharing", "Your request data and documents are shared only with professionals assigned to your request and authorised support staff."],
    ["Messages and reports (draft — pending legal review)", "We store messages you exchange with professionals, block lists and reports to operate the service and keep it safe. Reported conversations may be reviewed by authorised staff."],
    ["Your rights", "You may access, correct or delete your information subject to applicable law, including the Digital Personal Data Protection Act, 2023."],
  ] },
  refunds: { title: "Cancellation and Refund Policy", sections: [
    ["Cancelling requests", "You may cancel a request from your dashboard before work begins."],
    ["Platform fees", "Refund terms for platform subscription fees will be published when paid plans launch."],
    ["Contact credits (draft — pending legal review)", "Paid contact credits are currently switched off. If enabled after legal review, a credit is used only when a professional accepts a request and a conversation opens — never for declined or failed requests. Wrongly used credits can be returned by an administrator after review. Clients are never charged for contact."],
    ["Professional fees", "Refunds of professional fees are governed by the professional's own terms."],
  ] },
  cookies: { title: "Cookie Policy", sections: [["Essential storage", "We use essential browser storage to keep you signed in. We do not currently use advertising cookies."]] },
  disclaimer: { title: "Professional Disclaimer", sections: [
    ["No advice", "Content on LegalSetu is general information and not legal, tax or financial advice."],
    ["Verification", "A verified badge means submitted credentials were reviewed by our team; it is not an endorsement or guarantee of outcome."],
    ["No guarantees", "LegalSetu does not guarantee results, timelines or approvals by any authority."],
  ] },
  "data-protection": { title: "Data Processing and Consent Information", sections: [
    ["Consent", "We ask for your consent before you submit documents and before any professional acts on your behalf."],
    ["Sensitive documents", "Documents such as PAN, Aadhaar and GST records are stored in private storage, accessible via short-lived links only to authorised people."],
    ["Retention", "You can delete your documents at any time; some records may be retained where required by law."],
  ] },
  grievance: { title: "Grievance Redressal", sections: [
    ["Raising a grievance", "Submit a complaint via a support ticket in your dashboard or through the contact form."],
    ["Appeals", "You can appeal a suspension, hidden review or other moderation decision from your dashboard. An administrator records a written decision."],
    ["Grievance officer", "Grievance officer details will be published here before launch."],
  ] },
  "platform-role": { title: "Professional Independence and Platform Role", sections: [
    ["Independence", "Professionals decide independently whether to accept work and set their own fees."],
    ["No fee sharing", "LegalSetu does not take a percentage of or share in professional fees. Any proposed platform fee payable by professionals is disclosed in the professional dashboard and is not collected until legal review is complete."],
    ["Confidentiality", "Professionals see only requests assigned to them and must maintain client confidentiality."],
  ] },
};

export const Route = createFileRoute("/legal/$page")({
  loader: ({ params }) => { if (!PAGES[params.page]) throw notFound(); return { page: params.page }; },
  head: ({ loaderData }) => {
    const p = loaderData && PAGES[loaderData.page];
    if (!p) return { meta: [{ title: "Not found — LegalSetu" }, { name: "robots", content: "noindex" }] };
    return { meta: [
      { title: `${p.title} — LegalSetu` },
      { name: "description", content: `${p.title} for the LegalSetu platform.` },
      { property: "og:title", content: `${p.title} — LegalSetu` },
      { property: "og:description", content: `Read LegalSetu's ${p.title.toLowerCase()}.` },
    ] };
  },
  notFoundComponent: () => <div className="container-page py-24 text-center"><h1 className="text-2xl font-bold">Page not found</h1><Button asChild className="mt-6"><Link to="/">Home</Link></Button></div>,
  component: LegalPage,
});

function LegalPage() {
  const { page } = Route.useLoaderData();
  const p = PAGES[page];
  return (
    <>
      <PageHero eyebrow={["terms", "privacy", "refunds", "grievance"].includes(page) ? "Draft — Pending Legal Review" : "Legal"} title={p.title} />
      <div className="container-page max-w-3xl space-y-6 py-12">
        <LegalReviewNote />
        <div className="card-surface space-y-6 p-6 md:p-8">
          {p.sections.map(([h, b]) => <section key={h}><h2 className="text-lg font-semibold">{h}</h2><p className="mt-1 text-muted-foreground">{b}</p></section>)}
        </div>
      </div>
    </>
  );
}
