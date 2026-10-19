/** Pure helpers for the admin CRM. Money is only "collected" when a verified provider payment exists. */
export const PAID_PAYMENT = ["paid", "partially_refunded", "refunded"];
export const PAID_ORDER = ["successful", "refunded"];
export const OPEN_REQUEST_EXCLUDED = ["completed", "cancelled", "closed"];

export type FinRow = {
  kind: "service_payment" | "credit_order";
  amount_paise: number;
  refunded_paise: number;
  status: string;
  provider_payment_id: string | null;
  test_mode: boolean;
};

export type FinBucket = "collected" | "pending" | "failed" | "other";

export function bucket(r: FinRow): FinBucket {
  const paid = r.kind === "service_payment" ? PAID_PAYMENT : PAID_ORDER;
  if (paid.includes(r.status)) return r.provider_payment_id ? "collected" : "other";
  if (["pending", "initiated", "created", "amount_confirmed", "awaiting_payment"].includes(r.status)) return "pending";
  if (["failed", "cancelled"].includes(r.status)) return "failed";
  return "other";
}

export function needsReconciliation(r: FinRow): boolean {
  const paid = (r.kind === "service_payment" ? PAID_PAYMENT : PAID_ORDER).includes(r.status);
  return r.refunded_paise > r.amount_paise || (paid && !r.provider_payment_id);
}

export function summarise(rows: FinRow[]) {
  const s = { collected: 0, pending: 0, failed: 0, refunded: 0, reconcile: 0 };
  for (const r of rows) {
    const b = bucket(r);
    if (b === "collected") s.collected += r.amount_paise;
    if (b === "pending") s.pending += r.amount_paise;
    if (b === "failed") s.failed += r.amount_paise;
    s.refunded += r.refunded_paise;
    if (needsReconciliation(r)) s.reconcile += 1;
  }
  return s;
}

export function daysSince(iso: string, now = Date.now()): number {
  return Math.floor((now - new Date(iso).getTime()) / 86_400_000);
}

export function isOverdue(status: string, updatedAt: string, thresholdDays: number, now = Date.now()): boolean {
  return !OPEN_REQUEST_EXCLUDED.includes(status) && now - new Date(updatedAt).getTime() > thresholdDays * 86_400_000;
}

export const isTestRecord = (...vals: (string | null | undefined)[]) => vals.some((v) => (v ?? "").toUpperCase().includes("TEST"));

export const inr = (paise: number) => "₹" + (paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
