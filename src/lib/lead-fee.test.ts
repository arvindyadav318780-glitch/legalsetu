import { describe, expect, it } from "vitest";
import { leadId, redact } from "@/components/dash/ConnectionFees";
import { CONNECTION_FEE_PAISE } from "@/lib/marketplace";

describe("lead unlock fee", () => {
  it("fee is ₹99", () => expect(CONNECTION_FEE_PAISE).toBe(9900));
  it("same client-pro pair gives the same lead id", () => expect(leadId("a|b")).toBe(leadId("a|b")));
  it("different pairs give different lead ids", () => expect(leadId("a|b")).not.toBe(leadId("a|c")));
  it("hides email, phone and links in summaries", () => {
    const out = redact("Need GST help, mail me@x.com or call +91 98765 43210 https://wa.me/1");
    expect(out).not.toMatch(/me@x\.com|98765|wa\.me/);
  });
});
