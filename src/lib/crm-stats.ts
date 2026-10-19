/** Replies faster than this are treated as automated/test activity and excluded. */
export const MIN_REPLY_SECONDS = 60;

/** Professional work statistics computed only from recorded timestamps; null when no data. */
type Req = { status: string; accepted_at: string | null; created_at: string; completed_at?: string | null };
type Contact = { created_at: string; decided_at: string | null };

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function proStats(reqs: Req[], contacts: Contact[]) {
  const reply = contacts.filter((c) => c.decided_at).map((c) => (new Date(c.decided_at!).getTime() - new Date(c.created_at).getTime()) / 1000).filter((sec) => sec >= MIN_REPLY_SECONDS).map((sec) => sec / 3600);
  const comp = reqs.filter((r) => r.completed_at).map((r) => (new Date(r.completed_at!).getTime() - new Date(r.created_at).getTime()) / 86_400_000);
  const mr = median(reply); const mc = median(comp);
  return {
    assigned: reqs.length,
    accepted: reqs.filter((r) => r.accepted_at).length,
    inProgress: reqs.filter((r) => r.status === "in_progress").length,
    completed: reqs.filter((r) => r.status === "completed" || r.status === "closed").length,
    cancelled: reqs.filter((r) => r.status === "cancelled").length,
    medianReplyHours: mr == null ? null : Math.round(mr * 10) / 10,
    medianCompletionDays: mc == null ? null : Math.round(mc * 10) / 10,
  };
}
