// Client-request helpers: urgency, contact preference and duplicate detection (warning only, never a block).
export const URGENCY = [
  { v: "urgent", label: "Urgent — within 48 hours" },
  { v: "this_week", label: "This week" },
  { v: "this_month", label: "This month" },
  { v: "flexible", label: "Flexible / just exploring" },
] as const;
export const CONTACT_PREFS = [
  { v: "phone", label: "Phone call" },
  { v: "email", label: "Email" },
  { v: "whatsapp", label: "WhatsApp" },
  { v: "in_app", label: "LegalSetu messages only" },
] as const;
export const labelOf = (list: readonly { v: string; label: string }[], v?: string | null) => list.find((x) => x.v === v)?.label ?? "—";

export const DUPLICATE_WINDOW_DAYS = 30;
const OPEN_DONE = new Set(["completed", "closed", "cancelled"]);

const words = (s: string) => new Set(s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 2));
export function similarity(a: string, b: string) {
  const A = words(a), B = words(b);
  if (A.size === 0 && B.size === 0) return 1;
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0; for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

type Existing = { id: string; reference: string; service_slug: string; status: string; created_at: string; details: string | null; answers: unknown };
export const requestText = (details: string | null | undefined, answers: unknown) =>
  [details ?? "", ...Object.values((answers as Record<string, string>) ?? {})].join(" ");

/** Same client + same service + still open + within 30 days + similar details (≥ 50% word overlap). */
export function findLikelyDuplicate(draft: { service_slug: string; text: string }, existing: Existing[], now = Date.now()) {
  return existing.find((e) =>
    e.service_slug === draft.service_slug &&
    !OPEN_DONE.has(e.status) &&
    now - new Date(e.created_at).getTime() <= DUPLICATE_WINDOW_DAYS * 864e5 &&
    similarity(draft.text, requestText(e.details, e.answers)) >= 0.5,
  ) ?? null;
}
