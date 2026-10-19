/** Current request lifecycle, in order. Older stages (professional_review, awaiting_documents,
 * quote_provided, awaiting_confirmation) are retired; the database rejects them for new changes. */
export const REQUEST_STATUSES = [
  "submitted", "under_review", "professional_assigned", "customer_action_required",
  "in_progress", "completed", "closed", "cancelled", "disputed",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

const LABELS: Record<string, string> = {
  submitted: "New Request",
  professional_assigned: "Professional Assigned",
  customer_action_required: "Customer Action Required",
};
export const statusLabel = (s: string) =>
  LABELS[s] ?? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export type Tone = "neutral" | "info" | "warning" | "success" | "danger";
export const statusTone = (s: string): Tone => {
  if (["completed", "closed", "verified", "approved", "resolved", "confirmed", "paid", "fulfilled", "successful", "processed"].includes(s)) return "success";
  if (["cancelled", "disputed", "rejected", "declined", "failed"].includes(s)) return "danger";
  if (["refund_requested", "initiated", "partially_refunded", "refunded"].includes(s)) return "warning";
  if (["customer_action_required", "awaiting_documents", "awaiting_confirmation", "quote_provided", "pending", "requested", "open", "more_info_required"].includes(s)) return "warning";
  if (["in_progress", "professional_assigned", "professional_review", "under_review", "submitted"].includes(s)) return "info";
  return "neutral";
};

/** Customers may only cancel while work hasn't started. */
export const customerCanCancel = (s: string) =>
  ["submitted", "under_review", "professional_assigned", "customer_action_required"].includes(s);

/** Customers may close a request once the professional has marked it completed. */
export const customerCanClose = (s: string) => s === "completed";

/** Statuses the assigned professional may move to (mirrors the database rule). */
export const proNextStatuses = (s: string, accepted: boolean): string[] => {
  if (s === "professional_assigned") return ["in_progress"];
  if (!accepted) return [];
  if (s === "in_progress") return ["customer_action_required", "completed"];
  if (s === "customer_action_required") return ["in_progress", "completed"];
  return [];
};

export const ALLOWED_DOC_TYPES = ["application/pdf", "image/jpeg", "image/png"];
export const MAX_DOC_BYTES = 10 * 1024 * 1024;
export const validateDocument = (f: { type: string; size: number }): string | null => {
  if (!ALLOWED_DOC_TYPES.includes(f.type)) return "Only PDF, JPG, JPEG and PNG files are allowed.";
  if (f.size > MAX_DOC_BYTES) return "Files must be 10 MB or smaller.";
  return null;
};
