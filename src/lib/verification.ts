/** Professional verification stages, in review order. */
export const VERIFICATION_STAGES = ["pending", "under_review", "more_info_required", "approved", "rejected"] as const;

const LABELS: Record<string, string> = {
  not_submitted: "Not submitted",
  pending: "Pending",
  under_review: "Under Review",
  approved: "Approved",
  rejected: "Rejected",
  more_info_required: "More Information Required",
};
export const verificationLabel = (s: string) => LABELS[s] ?? s;

/** A professional may (re)submit for review from these states only. */
export const canSubmitForVerification = (s: string) => ["not_submitted", "rejected", "more_info_required"].includes(s);

/** Only approved, non-suspended professionals can receive requests or appear publicly. */
export const isAssignable = (p: { verification_status: string; suspended?: boolean | null }) => p.verification_status === "approved" && !p.suspended;

type ListingFields = { verification_status: string; suspended?: boolean | null; qualifications?: string | null; registration_details?: string | null; category?: string | null; city?: string | null; state?: string | null };
/** Public listing needs approval, an active account and complete credentials (mirrors the database rule). */
export const canBeListed = (p: ListingFields) =>
  isAssignable(p) && [p.qualifications, p.registration_details, p.category, p.city, p.state].every((v) => !!v && v.trim() !== "");
