import { describe, expect, it } from "vitest";
import { filterHealth, type HealthRow } from "./security-events";

const rows: HealthRow[] = [
  { id: "1", at: "2026-10-10T10:00:00Z", type: "permission_denied", severity: "medium", title: "", detail: "", test: false },
  { id: "2", at: "2026-10-12T10:00:00Z", type: "payment_failure", severity: "high", title: "", detail: "", test: true },
  { id: "3", at: "2026-10-13T10:00:00Z", type: "app_error", severity: "low", title: "", detail: "", test: false },
];

describe("security filters", () => {
  it("minimum severity high keeps only high", () => expect(filterHealth(rows, { severity: "high" }).map((r) => r.id)).toEqual(["2"]));
  it("real-only hides test events", () => expect(filterHealth(rows, { test: "real" }).map((r) => r.id)).toEqual(["3", "1"]));
  it("date range is inclusive", () => expect(filterHealth(rows, { from: "2026-10-12", to: "2026-10-12" }).map((r) => r.id)).toEqual(["2"]));
  it("type filter", () => expect(filterHealth(rows, { type: "app_error" }).map((r) => r.id)).toEqual(["3"]));
});
