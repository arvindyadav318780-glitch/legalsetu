// Client-safe marketplace rules. The database enforces the same rules; these mirror them for UI and tests.
export type MarketSettings = {
  contact_price_paise: number;
  credits_enabled_ca: boolean;
  credits_enabled_advocate: boolean;
  pro_initiate_ca?: boolean;
  pro_initiate_advocate?: boolean;
  legal_review_note?: string | null;
  legal_review_completed_at?: string | null;
};

export const CREDIT_PACKS = [5, 10, 25] as const;
/** Single source of truth in code for the professional connection fee (₹99). The database setting mirrors it. */
export const CONNECTION_FEE_PAISE = 9900;
export const DEFAULT_CONTACT_PRICE_PAISE = CONNECTION_FEE_PAISE;
export const LIMITS = { contactsPerDay: 5, messagesPerMinute: 20, messagesPerDay: 300 } as const;

/** Credits apply only to CAs and Advocates, and only after the admin compliance switch is on. */
export function creditsRequired(category: string | null | undefined, s: MarketSettings | null | undefined) {
  if (!s) return false;
  if (category === "Chartered Accountant") return s.credits_enabled_ca;
  if (category === "Advocate") return s.credits_enabled_advocate;
  return false;
}

export function packPrice(credits: number, pricePaise: number) {
  if (!Number.isInteger(credits) || credits < 1 || credits > 500) throw new Error("Choose between 1 and 500 credits");
  if (!Number.isInteger(pricePaise) || pricePaise <= 0) throw new Error("Credit price is not configured");
  return credits * pricePaise;
}

export function pairKey(clientId: string, proId: string, requestId?: string | null) {
  return `${clientId}:${proId}:${requestId ?? "none"}`;
}

/** One charge at most per client/professional/request, and only when the conversation was actually created. */
export function shouldCharge(o: { required: boolean; conversationCreated: boolean; alreadyChargedForPair: boolean }) {
  return o.required && o.conversationCreated && !o.alreadyChargedForPair;
}

export function canEnableGate(note: string | null | undefined, completedAt: string | null | undefined) {
  return !!completedAt && (note ?? "").trim().length >= 20;
}

export type ReviewBasis =
  | { kind: "conversation"; professionalReplied: boolean; alreadyReviewed: boolean }
  | { kind: "request"; requestStatus: string; assignedToThisPro: boolean; alreadyReviewed: boolean };

export function reviewEligible(b: ReviewBasis) {
  if (b.alreadyReviewed) return false;
  if (b.kind === "conversation") return b.professionalReplied;
  return b.assignedToThisPro && (b.requestStatus === "completed" || b.requestStatus === "closed");
}

export function ledgerBalance(rows: { delta: number }[]) {
  return rows.reduce((a, r) => a + r.delta, 0);
}

/** Connection = one client + one professional, regardless of how many requests or messages. */
export function connectionKey(clientId: string, proId: string) {
  return `${clientId}:${proId}`;
}

export type FeeStatus = "billable" | "already_connected" | "not_billable";

type CR = { id: string; client_id: string; professional_id: string; status: string; created_at: string; decided_at?: string | null };

/** Labels each contact request: only the first accepted request per client-professional pair is billable. */
export function classifyConnections(requests: CR[]) {
  const sorted = [...requests].sort((a, b) => (a.decided_at ?? a.created_at).localeCompare(b.decided_at ?? b.created_at));
  const seen = new Set<string>();
  const out = new Map<string, FeeStatus>();
  for (const r of sorted) {
    if (r.status !== "accepted") { out.set(r.id, "not_billable"); continue; }
    const k = connectionKey(r.client_id, r.professional_id);
    out.set(r.id, seen.has(k) ? "already_connected" : "billable");
    seen.add(k);
  }
  return out;
}

export function summarizeConnections(requests: CR[], pricePaise: number) {
  const cls = classifyConnections(requests);
  const byPro = new Map<string, { pro: string; clients: number; billable: number; feePaise: number; declined: number; pending: number; repeat: number }>();
  const monthly = new Map<string, { month: string; billable: number; feePaise: number }>();
  for (const r of requests) {
    const row = byPro.get(r.professional_id) ?? { pro: r.professional_id, clients: 0, billable: 0, feePaise: 0, declined: 0, pending: 0, repeat: 0 };
    const s = cls.get(r.id);
    if (s === "billable") {
      row.clients++; row.billable++; row.feePaise += pricePaise;
      const m = (r.decided_at ?? r.created_at).slice(0, 7);
      const mm = monthly.get(m) ?? { month: m, billable: 0, feePaise: 0 };
      mm.billable++; mm.feePaise += pricePaise; monthly.set(m, mm);
    } else if (s === "already_connected") row.repeat++;
    else if (r.status === "pending") row.pending++;
    else row.declined++;
    byPro.set(r.professional_id, row);
  }
  return { perPro: [...byPro.values()], monthly: [...monthly.values()].sort((a, b) => b.month.localeCompare(a.month)) };
}
