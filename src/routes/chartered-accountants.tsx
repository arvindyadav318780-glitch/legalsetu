import { createFileRoute, redirect } from "@tanstack/react-router";

// CA directory = the shared directory pre-filtered to Chartered Accountants.
export const Route = createFileRoute("/chartered-accountants")({
  beforeLoad: () => { throw redirect({ to: "/professionals", search: { cat: "Chartered Accountant" } }); },
});
