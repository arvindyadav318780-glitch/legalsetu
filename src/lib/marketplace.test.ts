import { describe, expect, it } from "vitest";
import { canEnableGate, creditsRequired, ledgerBalance, packPrice, pairKey, reviewEligible, shouldCharge } from "./marketplace";

const off = { contact_price_paise: 2000, credits_enabled_ca: false, credits_enabled_advocate: false };

describe("contact credits", () => {
  it("are off by default for CAs and Advocates", () => {
    expect(creditsRequired("Chartered Accountant", off)).toBe(false);
    expect(creditsRequired("Advocate", off)).toBe(false);
  });
  it("apply only to the profession whose switch is on", () => {
    const s = { ...off, credits_enabled_ca: true };
    expect(creditsRequired("Chartered Accountant", s)).toBe(true);
    expect(creditsRequired("Advocate", s)).toBe(false);
    expect(creditsRequired("Company Secretary", s)).toBe(false);
  });
  it("10 credits at ₹20 cost ₹200", () => {
    expect(packPrice(10, 2000)).toBe(20000);
  });
  it("rejects zero or fractional packs", () => {
    expect(() => packPrice(0, 2000)).toThrow();
    expect(() => packPrice(1.5, 2000)).toThrow();
  });
  it("charge once per pair and request, only after the chat is created", () => {
    expect(shouldCharge({ required: true, conversationCreated: true, alreadyChargedForPair: false })).toBe(true);
    expect(shouldCharge({ required: true, conversationCreated: true, alreadyChargedForPair: true })).toBe(false);
    expect(shouldCharge({ required: true, conversationCreated: false, alreadyChargedForPair: false })).toBe(false);
    expect(shouldCharge({ required: false, conversationCreated: true, alreadyChargedForPair: false })).toBe(false);
  });
  it("pair key differs per request", () => {
    expect(pairKey("c", "p", "r1")).not.toBe(pairKey("c", "p", "r2"));
    expect(pairKey("c", "p")).toBe("c:p:none");
  });
  it("balance is the sum of ledger entries", () => {
    expect(ledgerBalance([{ delta: 10 }, { delta: -1 }, { delta: 1 }])).toBe(10);
  });
  it("enabling needs a dated legal review note of 20+ characters", () => {
    expect(canEnableGate("short", "2026-10-01")).toBe(false);
    expect(canEnableGate("Reviewed by counsel for BCI and ICAI", null)).toBe(false);
    expect(canEnableGate("Reviewed by counsel for BCI and ICAI", "2026-10-01")).toBe(true);
  });
});

describe("reviews", () => {
  it("need a professional reply in the conversation", () => {
    expect(reviewEligible({ kind: "conversation", professionalReplied: false, alreadyReviewed: false })).toBe(false);
    expect(reviewEligible({ kind: "conversation", professionalReplied: true, alreadyReviewed: false })).toBe(true);
  });
  it("only one review per interaction", () => {
    expect(reviewEligible({ kind: "conversation", professionalReplied: true, alreadyReviewed: true })).toBe(false);
  });
  it("request reviews need a completed request by this professional", () => {
    expect(reviewEligible({ kind: "request", requestStatus: "in_progress", assignedToThisPro: true, alreadyReviewed: false })).toBe(false);
    expect(reviewEligible({ kind: "request", requestStatus: "closed", assignedToThisPro: false, alreadyReviewed: false })).toBe(false);
    expect(reviewEligible({ kind: "request", requestStatus: "completed", assignedToThisPro: true, alreadyReviewed: false })).toBe(true);
  });
});
