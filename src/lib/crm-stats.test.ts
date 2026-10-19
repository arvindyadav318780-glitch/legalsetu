import { describe, it, expect } from "vitest";
import { proStats } from "./crm-stats";

describe("proStats", () => {
  it("reports no reply time when no decision timestamps exist", () => {
    expect(proStats([], [{ created_at: "2026-10-01T00:00:00Z", decided_at: null }]).medianReplyHours).toBeNull();
  });
  it("computes median reply hours from decided contacts only", () => {
    const s = proStats([], [
      { created_at: "2026-10-01T00:00:00Z", decided_at: "2026-10-01T02:00:00Z" },
      { created_at: "2026-10-01T00:00:00Z", decided_at: "2026-10-01T04:00:00Z" },
      { created_at: "2026-10-01T00:00:00Z", decided_at: null },
    ]);
    expect(s.medianReplyHours).toBe(3);
  });
  it("ignores replies under 60 seconds (automated tests) and shows no data", () => {
    expect(proStats([], [{ created_at: "2026-10-01T00:00:00Z", decided_at: "2026-10-01T00:00:05Z" }]).medianReplyHours).toBeNull();
  });
  it("keeps a genuine reply of exactly 60 seconds", () => {
    expect(proStats([], [{ created_at: "2026-10-01T00:00:00Z", decided_at: "2026-10-01T00:01:00Z" }]).medianReplyHours).not.toBeNull();
  });
  it("counts accepted, in-progress, completed and cancelled from statuses", () => {
    const s = proStats([
      { status: "in_progress", accepted_at: "x", created_at: "2026-10-01T00:00:00Z" },
      { status: "completed", accepted_at: "x", created_at: "2026-10-01T00:00:00Z", completed_at: "2026-10-03T00:00:00Z" },
      { status: "cancelled", accepted_at: null, created_at: "2026-10-01T00:00:00Z" },
    ], []);
    expect(s).toMatchObject({ assigned: 3, accepted: 2, inProgress: 1, completed: 1, cancelled: 1, medianCompletionDays: 2 });
  });
});
