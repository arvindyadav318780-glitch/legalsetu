import { describe, expect, it } from "vitest";
import { findLikelyDuplicate } from "./requests";

const now = new Date("2026-10-13T12:00:00Z").getTime();
const ex = (o: Partial<{ service_slug: string; status: string; created_at: string; details: string }>) => ({
  id: "1", reference: "LS-1", service_slug: "gst-registration", status: "submitted", created_at: "2026-10-10T00:00:00Z", details: "GST registration for my trading shop in Pune", answers: {}, ...o,
});
const draft = { service_slug: "gst-registration", text: "GST registration for trading shop Pune" };

describe("duplicate request warning", () => {
  it("warns for same service, similar details, open, within 30 days", () => expect(findLikelyDuplicate(draft, [ex({})], now)).not.toBeNull());
  it("no warning for a different service", () => expect(findLikelyDuplicate(draft, [ex({ service_slug: "itr-filing" })], now)).toBeNull());
  it("no warning for clearly different details", () => expect(findLikelyDuplicate({ ...draft, text: "Partnership firm registration in Delhi with three partners" }, [ex({})], now)).toBeNull());
  it("no warning after 30 days", () => expect(findLikelyDuplicate(draft, [ex({ created_at: "2026-09-01T00:00:00Z" })], now)).toBeNull());
  it("no warning when the old request is closed, completed or cancelled", () => {
    for (const status of ["closed", "completed", "cancelled"]) expect(findLikelyDuplicate(draft, [ex({ status })], now)).toBeNull();
  });
});
