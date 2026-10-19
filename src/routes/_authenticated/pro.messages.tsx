import { createFileRoute } from "@tanstack/react-router";
import { DashHeader } from "@/components/dash/DashShell";
import { Conversations } from "@/components/dash/Conversations";

export const Route = createFileRoute("/_authenticated/pro/messages")({
  component: () => (
    <>
      <DashHeader title="Client contacts & messages" subtitle="Clients contact you first. Accepting opens a private conversation. Declined requests are never charged." />
      <Conversations role="pro" />
    </>
  ),
});
