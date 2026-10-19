import { describe, expect, it } from "vitest";
import { canPay, computeFees, isPaidState, isTestKey, refundableRemaining } from "./fees";

describe("fee model", () => {
  it("never deducts from the professional fee and itemises every line", () => {
    const f = computeFees({ professionalFeePaise: 500000, professionalTaxPaise: 90000, governmentFeePaise: 10000, platformFeePaise: 49900, platformGstPercent: 18 });
    expect(f.professional_fee_paise).toBe(500000);
    expect(f.platform_tax_paise).toBe(8982);
    expect(f.total_paise).toBe(500000 + 90000 + 10000 + 49900 + 8982);
  });
  it("rejects negative values", () => {
    expect(computeFees({ professionalFeePaise: -5, professionalTaxPaise: 0, governmentFeePaise: 0, platformFeePaise: 0, platformGstPercent: 18 }).total_paise).toBe(0);
  });
});

describe("payment rules", () => {
  it("paid records cannot be paid again", () => {
    expect(canPay("successful")).toBe(false);
    expect(canPay("failed")).toBe(true);
    expect(isPaidState("refunded")).toBe(true);
  });
  it("refund cannot exceed the remaining paid amount", () => {
    expect(refundableRemaining({ total_paise: 1000, refunded_paise: 400 })).toBe(600);
  });
  it("only Razorpay test keys are accepted", () => {
    expect(isTestKey("rzp_test_abc")).toBe(true);
    expect(isTestKey("rzp_live_abc")).toBe(false);
  });
});
