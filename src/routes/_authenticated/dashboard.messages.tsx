import { createFileRoute } from "@tanstack/react-router";
import { DashHeader } from "@/components/dash/DashShell";
import { Conversations } from "@/components/dash/Conversations";

export const Route = createFileRoute("/_authenticated/dashboard/messages")({
  head: () => ({ meta: [{ title: "Messages — LegalSetu" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <>
      <DashHeader title="Professional contacts & messages" subtitle="Contact requests you've sent to verified professionals and your private conversations. Clients never pay for contact." />
      <Conversations role="client" />
    </>
  ),
});
