import { describe, expect, it } from "vitest";
import { classifyConnections, summarizeConnections, CONNECTION_FEE_PAISE } from "./marketplace";

const r = (id: string, client: string, pro: string, status: string, at: string) => ({ id, client_id: client, professional_id: pro, status, created_at: at, decided_at: at });

describe("₹99 per unique client connection", () => {
  it("fee is ₹99", () => expect(CONNECTION_FEE_PAISE).toBe(9900));
  it("charges once per client-professional pair, even across requests", () => {
    const c = classifyConnections([r("a", "c1", "p1", "accepted", "2026-10-01"), r("b", "c1", "p1", "accepted", "2026-10-05")]);
    expect(c.get("a")).toBe("billable");
    expect(c.get("b")).toBe("already_connected");
  });
  it("same client with a different professional is a new ₹99 connection", () => {
    const s = summarizeConnections([r("a", "c1", "p1", "accepted", "2026-10-01"), r("b", "c1", "p2", "accepted", "2026-10-02")], 9900);
    expect(s.perPro.map((p) => p.feePaise)).toEqual([9900, 9900]);
  });
  it("declined and pending requests are never billable", () => {
    const s = summarizeConnections([r("a", "c1", "p1", "declined", "2026-10-01"), r("b", "c2", "p1", "pending", "2026-10-01")], 9900);
    expect(s.perPro[0].feePaise).toBe(0);
  });
  it("monthly totals count only billable connections", () => {
    const s = summarizeConnections([r("a", "c1", "p1", "accepted", "2026-09-30"), r("b", "c2", "p1", "accepted", "2026-10-01"), r("c", "c2", "p1", "accepted", "2026-10-02")], 9900);
    expect(s.monthly).toEqual([{ month: "2026-10", billable: 1, feePaise: 9900 }, { month: "2026-09", billable: 1, feePaise: 9900 }]);
  });
});
