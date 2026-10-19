import { describe, expect, it } from "vitest";
import { VERIFICATION_STAGES, canSubmitForVerification, isAssignable, verificationLabel } from "./verification";

describe("verification stages", () => {
  it("has exactly the five review stages", () => {
    expect([...VERIFICATION_STAGES].sort()).toEqual(["approved", "more_info_required", "pending", "rejected", "under_review"]);
  });
  it("labels More Information Required", () => {
    expect(verificationLabel("more_info_required")).toBe("More Information Required");
  });
  it("lets professionals resubmit only after rejection or a request for more information", () => {
    expect(canSubmitForVerification("more_info_required")).toBe(true);
    expect(canSubmitForVerification("rejected")).toBe(true);
    expect(canSubmitForVerification("under_review")).toBe(false);
    expect(canSubmitForVerification("approved")).toBe(false);
  });
  it("only approved, non-suspended professionals are assignable", () => {
    expect(isAssignable({ verification_status: "approved" })).toBe(true);
    expect(isAssignable({ verification_status: "approved", suspended: true })).toBe(false);
    expect(isAssignable({ verification_status: "under_review" })).toBe(false);
  });
});
