import { createFileRoute, redirect } from "@tanstack/react-router";

// Advocate directory = the shared directory pre-filtered to Advocates.
export const Route = createFileRoute("/advocates")({
  beforeLoad: () => { throw redirect({ to: "/professionals", search: { cat: "Advocate" } }); },
});
