import { describe, expect, it } from "vitest";
import { customerCanCancel, customerCanClose, proNextStatuses, statusLabel, validateDocument } from "./status";
import { canBeListed } from "./verification";

describe("request rules", () => {
  it("customers cannot cancel once work is in progress", () => {
    expect(customerCanCancel("submitted")).toBe(true);
    expect(customerCanCancel("customer_action_required")).toBe(true);
    expect(customerCanCancel("in_progress")).toBe(false);
    expect(customerCanCancel("completed")).toBe(false);
  });
  it("customers can close only completed requests", () => {
    expect(customerCanClose("completed")).toBe(true);
    expect(customerCanClose("in_progress")).toBe(false);
  });
  it("professionals must accept before any other change", () => {
    expect(proNextStatuses("professional_assigned", false)).toEqual(["in_progress"]);
    expect(proNextStatuses("in_progress", false)).toEqual([]);
  });
  it("professionals can request customer action or complete, never close", () => {
    expect(proNextStatuses("in_progress", true)).toEqual(["customer_action_required", "completed"]);
    expect(proNextStatuses("completed", true)).toEqual([]);
  });
  it("shows submitted as New Request", () => {
    expect(statusLabel("submitted")).toBe("New Request");
  });
});

describe("listing rule", () => {
  const full = { verification_status: "approved", suspended: false, qualifications: "CA", registration_details: "ICAI 1", category: "ca", city: "Pune", state: "Maharashtra" };
  it("only complete, approved, active profiles can be listed", () => {
    expect(canBeListed(full)).toBe(true);
    expect(canBeListed({ ...full, verification_status: "pending" })).toBe(false);
    expect(canBeListed({ ...full, suspended: true })).toBe(false);
    expect(canBeListed({ ...full, registration_details: "" })).toBe(false);
  });
});

describe("document rules", () => {
  it("rejects non PDF/JPG/PNG files", () => {
    expect(validateDocument({ type: "application/zip", size: 100 })).not.toBeNull();
    expect(validateDocument({ type: "application/pdf", size: 100 })).toBeNull();
  });
  it("rejects files above 10 MB", () => {
    expect(validateDocument({ type: "image/png", size: 10 * 1024 * 1024 + 1 })).not.toBeNull();
  });
});
