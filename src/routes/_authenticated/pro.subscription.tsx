import { createFileRoute } from "@tanstack/react-router";
import { DashHeader } from "@/components/dash/DashShell";
import { FutureBadge } from "@/components/site/bits";

export const Route = createFileRoute("/_authenticated/pro/subscription")({ component: () => (
  <>
    <DashHeader title="Subscription" />
    <div className="card-surface max-w-xl p-6">
      <div className="flex items-center gap-2"><p className="text-xl font-bold">Professional Workspace</p><FutureBadge label="Launching soon" /></div>
      <p className="mt-2 text-sm text-muted-foreground">You're on early access at no charge. Paid subscriptions will open once payments are verified. The subscription is a software fee only — never a lead, referral or fee-sharing charge.</p>
    </div>
  </>
) });
