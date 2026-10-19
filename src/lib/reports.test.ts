import { describe, expect, it } from "vitest";
import { checkMethodsFor, isRestrictionActive, reportReasonError } from "./reports";

describe("report reasons", () => {
  it("requires a known reason code", () => expect(reportReasonError("bogus", "")).toBe("Choose a reason"));
  it("details optional for a specific reason", () => expect(reportReasonError("spam", "")).toBeNull());
  it("'other' needs 10+ characters of detail", () => expect(reportReasonError("other", "short")).not.toBeNull());
});

describe("temporary restrictions", () => {
  const now = Date.parse("2026-10-14T12:00:00Z");
  it("active inside the window", () => expect(isRestrictionActive({ starts_at: "2026-10-14T00:00:00Z", ends_at: "2026-10-15T00:00:00Z", lifted_at: null }, now)).toBe(true));
  it("stops applying after expiry", () => expect(isRestrictionActive({ starts_at: "2026-10-13T00:00:00Z", ends_at: "2026-10-14T11:00:00Z", lifted_at: null }, now)).toBe(false));
  it("lifted restriction no longer applies", () => expect(isRestrictionActive({ starts_at: "2026-10-14T00:00:00Z", ends_at: "2026-10-15T00:00:00Z", lifted_at: "2026-10-14T06:00:00Z" }, now)).toBe(false));
});

describe("credential check methods", () => {
  it("CAs use ICAI methods only", () => expect(checkMethodsFor("Chartered Accountant").every((m) => m.v.startsWith("icai_"))).toBe(true));
  it("Advocates use Bar Council methods only", () => expect(checkMethodsFor("Advocate").every((m) => m.v.startsWith("bar_council_"))).toBe(true));
});
