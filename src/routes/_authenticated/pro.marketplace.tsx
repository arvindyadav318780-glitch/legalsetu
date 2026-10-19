import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Inbox, CheckCircle2, XCircle, MessagesSquare, Coins, Star, Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DashHeader, Stat, fmtDateTime } from "@/components/dash/DashShell";
import { EmptyState, StatusPill } from "@/components/site/bits";
import { Button } from "@/components/ui/button";
import { inr } from "@/lib/fees";

export const Route = createFileRoute("/_authenticated/pro/marketplace")({ component: ProMarketplace });

function ProMarketplace() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["pro-mkt", user?.id], enabled: !!user,
    queryFn: async () => {
      const uid = user!.id;
      const [cr, cv, bal, ord, rv, rep, refunds, tickets] = await Promise.all([
        supabase.from("contact_requests").select("status,initiated_by").eq("professional_id", uid),
        supabase.from("conversations").select("id").eq("professional_id", uid),
        supabase.rpc("credit_balance", { _uid: uid }),
        supabase.from("credit_orders").select("*").eq("professional_id", uid).order("created_at", { ascending: false }).limit(20),
        supabase.from("reviews").select("*").eq("professional_id", uid).order("created_at", { ascending: false }).limit(50),
        supabase.rpc("reports_about_me"),
        supabase.from("credit_refunds").select("*").eq("professional_id", uid).order("created_at", { ascending: false }),
        supabase.from("support_tickets").select("id,subject,status,kind,created_at").eq("user_id", uid).eq("kind", "complaint").order("created_at", { ascending: false }).limit(20),
      ]);
      return { cr: cr.data ?? [], convs: cv.data ?? [], balance: (bal.data as number) ?? 0, orders: ord.data ?? [], reviews: rv.data ?? [], reports: rep.data?.[0], refunds: refunds.data ?? [], tickets: tickets.data ?? [] };
    },
  });
  const cr = data?.cr ?? [];
  const pub = (data?.reviews ?? []).filter((r) => r.status === "published");
  const avg = pub.length ? (pub.reduce((a, r) => a + r.rating, 0) / pub.length).toFixed(1) : "—";
  return (
    <>
      <DashHeader title="Marketplace overview" subtitle="Your contact requests, conversations, credits, reviews and reports — all from real records." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Pending requests" value={cr.filter((r) => r.status === "pending").length} icon={Inbox} />
        <Stat label="Accepted" value={cr.filter((r) => r.status === "accepted").length} icon={CheckCircle2} />
        <Stat label="Declined / withdrawn" value={cr.filter((r) => r.status === "declined" || r.status === "withdrawn").length} icon={XCircle} />
        <Stat label="Conversations" value={data?.convs.length ?? 0} icon={MessagesSquare} />
        <Stat label="Credit balance" value={data?.balance ?? 0} icon={Coins} />
        <Stat label="Average rating" value={`${avg} (${pub.length})`} icon={Star} />
        <Stat label="Open reports about you" value={data?.reports?.open_count ?? 0} icon={Flag} />
        <Stat label="Total reports about you" value={data?.reports?.total_count ?? 0} icon={Flag} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2"><Button asChild variant="outline"><Link to="/pro/messages">Open client contacts</Link></Button><Button asChild variant="outline"><Link to="/pro/credits">Credits & purchases</Link></Button></div>

      <h2 className="mb-2 mt-8 font-semibold">Recent credit purchases</h2>
      {(data?.orders ?? []).length === 0 ? <EmptyState title="No purchases" /> : (
        <div className="card-surface divide-y text-sm">{data!.orders.map((o) => <div key={o.id} className="flex flex-wrap items-center gap-3 p-3"><span className="flex-1">{o.credits} credits · {inr(o.amount_paise)}{o.test_mode ? " · TEST" : ""}</span><StatusPill status={o.status} /><span className="text-xs text-muted-foreground">{fmtDateTime(o.created_at)}</span></div>)}</div>
      )}
      {(data?.refunds ?? []).length > 0 && (<>
        <h2 className="mb-2 mt-8 font-semibold">Credit-pack refunds</h2>
        <div className="card-surface divide-y text-sm">{data!.refunds.map((r) => <div key={r.id} className="flex flex-wrap items-center gap-3 p-3"><span className="flex-1">{r.credits_reversed} credits · {inr(r.amount_paise)}{r.failure_reason ? ` · ${r.failure_reason}` : ""}</span><StatusPill status={r.status} /></div>)}</div>
      </>)}

      <h2 className="mb-2 mt-8 font-semibold">Reviews from clients</h2>
      {(data?.reviews ?? []).length === 0 ? <EmptyState title="No reviews yet" body="Only clients who had a real conversation or completed request with you can review you." /> : (
        <div className="card-surface divide-y text-sm">{data!.reviews.map((r) => <div key={r.id} className="p-3"><p>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)} {r.status === "hidden" && <span className="text-xs text-muted-foreground">(hidden by moderation{r.moderation_note ? `: ${r.moderation_note}` : ""})</span>}</p>{r.body && <p className="text-muted-foreground">{r.body}</p>}<p className="text-xs text-muted-foreground">{fmtDateTime(r.created_at)}</p></div>)}</div>
      )}

      <h2 className="mb-2 mt-8 font-semibold">Your complaints & disputes</h2>
      {(data?.tickets ?? []).length === 0 ? <EmptyState title="None raised" /> : (
        <div className="card-surface divide-y text-sm">{data!.tickets.map((t) => <div key={t.id} className="flex flex-wrap items-center gap-3 p-3"><span className="flex-1">{t.subject}</span><StatusPill status={t.status} /></div>)}</div>
      )}
      <p className="mt-6 text-xs text-muted-foreground">Reporters' identities are never shown to you. If you disagree with a moderation decision, use the appeal option on your client contacts page.</p>
    </>
  );
}
