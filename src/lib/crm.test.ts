import { describe, it, expect } from "vitest";
import { bucket, needsReconciliation, summarise, isOverdue } from "./crm";

const row = (o: Partial<Parameters<typeof bucket>[0]>) => ({ kind: "service_payment" as const, amount_paise: 10000, refunded_paise: 0, status: "paid", provider_payment_id: "pay_1", test_mode: true, ...o });

describe("crm finance", () => {
  it("counts paid with a provider payment ID as collected", () => expect(bucket(row({}))).toBe("collected"));
  it("never counts paid without a payment ID as collected", () => expect(bucket(row({ provider_payment_id: null }))).toBe("other"));
  it("pending attempts are not collected", () => expect(summarise([row({ status: "pending" })]).collected).toBe(0));
  it("failed credit orders are failed", () => expect(bucket(row({ kind: "credit_order", status: "failed" }))).toBe("failed"));
  it("flags refund larger than payment", () => expect(needsReconciliation(row({ refunded_paise: 20000 }))).toBe(true));
});

describe("crm overdue", () => {
  const now = new Date("2026-10-15T12:00:00Z").getTime();
  it("open request untouched 4 days is overdue at 3-day threshold", () => expect(isOverdue("submitted", "2026-10-11T12:00:00Z", 3, now)).toBe(true));
  it("open request touched 2 days ago is not overdue", () => expect(isOverdue("submitted", "2026-10-13T12:00:00Z", 3, now)).toBe(false));
  it("completed requests are never overdue", () => expect(isOverdue("completed", "2026-01-01T00:00:00Z", 3, now)).toBe(false));
});
