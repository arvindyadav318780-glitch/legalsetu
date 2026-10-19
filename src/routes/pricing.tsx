import { createFileRoute, redirect } from "@tanstack/react-router";

// Public pricing was retired: the professional fee is shown only inside professional dashboards.
export const Route = createFileRoute("/pricing")({
  beforeLoad: () => { throw redirect({ to: "/", statusCode: 301 }); },
});
