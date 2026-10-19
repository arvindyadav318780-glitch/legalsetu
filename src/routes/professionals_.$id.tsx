import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BadgeCheck, Languages, MapPin, MessageSquare, Star, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/site/bits";
import { ProAvatar } from "@/components/site/ProAvatar";
import { ContactDialog, feeText } from "@/components/site/ProContact";
import { Button } from "@/components/ui/button";
import { ReportButton } from "@/components/site/ReportButton";
import type { DirectoryPro } from "@/lib/demo-pros";

export const Route = createFileRoute("/professionals_/$id")({
  head: () => ({
    meta: [
      { title: "Professional profile — LegalSetu" },
      { name: "description", content: "Verified CA or Advocate profile on LegalSetu: qualifications, registration, experience, self-declared fees and genuine reviews." },
      { property: "og:title", content: "Professional profile — LegalSetu" },
      { property: "og:description", content: "Verified professional profile with genuine, interaction-based reviews." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { id } = Route.useParams();
  const [contact, setContact] = useState<DirectoryPro | null>(null);
  const { data, isFetched } = useQuery({
    queryKey: ["pro-public", id],
    queryFn: async () => {
      const [p, st, rv] = await Promise.all([
        supabase.from("professional_profiles").select("*").eq("user_id", id).eq("is_listed", true).eq("verification_status", "approved").eq("suspended", false).maybeSingle(),
        supabase.rpc("pro_public_stats", { _pro: id }),
        supabase.from("reviews").select("id,rating,body,created_at").eq("professional_id", id).eq("status", "published").order("created_at", { ascending: false }).limit(20),
      ]);
      return { p: p.data, stats: st.data?.[0] ?? null, reviews: rv.data ?? [] };
    },
  });
  if (!isFetched) return <div className="container-page py-16" />;
  const p = data?.p;
  if (!p) return <div className="container-page py-16"><EmptyState title="Profile not available" body="This professional is not currently listed. Only verified, active profiles are shown." action={<Button asChild><Link to="/professionals">Back to directory</Link></Button>} /></div>;
  const dp: DirectoryPro = {
    key: p.user_id, name: p.display_name, category: p.category, qualifications: p.qualifications ?? "", registration: p.registration_details, verification: "verified",
    experience: p.years_experience, languages: p.languages ?? [], state: p.state ?? "", city: p.city ?? "", modes: p.consultation_modes ?? [], expertise: p.expertise ?? [],
    description: p.description ?? "", demo: false, membership: p.membership_number, cop: p.cop_number, availability: p.availability, feeFrom: p.fee_from_paise, feeTo: p.fee_to_paise, photo: p.photo_path,
  };
  const s = data?.stats;
  const row = (l: string, v: string | null | undefined) => v ? <div className="grid gap-1 sm:grid-cols-[220px_1fr]"><dt className="text-muted-foreground">{l}</dt><dd>{v}</dd></div> : null;
  return (
    <div className="container-page py-10">
      <Link to="/professionals" search={{ cat: p.category }} className="text-sm text-accent hover:underline">← Back to {p.category === "Advocate" ? "Advocates" : p.category === "Chartered Accountant" ? "Chartered Accountants" : "directory"}</Link>
      <div className="card-surface mt-4 p-6">
        <div className="flex flex-wrap items-start gap-5">
          <ProAvatar name={p.display_name} path={p.photo_path} size={96} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-semibold">{p.display_name}</h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success"><BadgeCheck className="h-3.5 w-3.5" />Verified by LegalSetu</span></div>
            <p className="text-muted-foreground">{p.category}{p.years_experience != null ? ` · ${p.years_experience} yrs experience` : ""}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {p.city && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{p.city}, {p.state}</span>}
              {(p.languages ?? []).length > 0 && <span className="flex items-center gap-1"><Languages className="h-4 w-4" />{p.languages!.join(", ")}</span>}
              {(p.consultation_modes ?? []).length > 0 && <span className="flex items-center gap-1"><Video className="h-4 w-4" />{p.consultation_modes!.join(" / ")}</span>}
            </div>
            <p className="mt-2 flex items-center gap-1 text-sm"><Star className="h-4 w-4" />{s?.review_count ? `${s.avg_rating} from ${s.review_count} verified review${s.review_count === 1 ? "" : "s"}` : "No reviews yet"} · {s?.interaction_count ?? 0} verified interactions</p>
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={() => setContact(dp)}><MessageSquare /> Send contact request</Button>
            <Button asChild variant="outline"><Link to="/dashboard/appointments" search={{ pro: p.user_id }}>Request appointment</Link></Button>
            <ReportButton targetId={p.user_id} label="Report profile" />
          </div>
        </div>
        {p.description && <p className="mt-6 text-sm leading-relaxed">{p.description}</p>}
        <dl className="mt-6 grid gap-3 border-t pt-6 text-sm">
          {row("Qualifications", p.qualifications)}
          {row("Registration details", p.registration_details)}
          {row(p.category === "Advocate" ? "Bar Council enrolment" : "ICAI membership", p.membership_number)}
          {row("Certificate of Practice", p.cop_number)}
          {row("Services & specialisations", (p.expertise ?? []).join(", "))}
          {row("Availability", p.availability)}
          {row("Fee (self-declared)", feeText(dp))}
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">Fees are set by the professional and agreed directly with them. LegalSetu takes no commission from professional fees. Verification means our team reviewed the submitted registration details; it is not an endorsement.</p>
      </div>
      <h2 className="mb-3 mt-8 font-semibold">Client reviews</h2>
      {(data?.reviews ?? []).length === 0 ? <EmptyState title="No reviews yet" body="Only clients with a genuine interaction can leave a review." /> : (
        <div className="card-surface divide-y">{data!.reviews.map((r) => (
          <div key={r.id} className="p-4 text-sm"><p className="text-accent">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)} <span className="ml-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("en-IN")}</span></p>{r.body && <p className="mt-1">{r.body}</p>}</div>
        ))}</div>
      )}
      <ContactDialog pro={contact} onClose={() => setContact(null)} />
    </div>
  );
}
