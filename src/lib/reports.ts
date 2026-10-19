/** Report reason codes — must match the list enforced by the guard_abuse_report database trigger. */
export const REPORT_REASONS = [
  { v: "fraud", label: "Fraud or scam" },
  { v: "impersonation", label: "Impersonation / fake identity" },
  { v: "misleading_credentials", label: "Misleading qualifications or credentials" },
  { v: "harassment", label: "Harassment or abusive behaviour" },
  { v: "spam", label: "Spam" },
  { v: "payment_dispute", label: "Payment dispute" },
  { v: "off_platform_solicitation", label: "Unsolicited or off-platform solicitation" },
  { v: "privacy_violation", label: "Misuse of personal information" },
  { v: "other", label: "Other" },
] as const;

export const reportReasonLabel = (v: string) => REPORT_REASONS.find((r) => r.v === v)?.label ?? v;

export function reportReasonError(code: string, details: string): string | null {
  if (!REPORT_REASONS.some((r) => r.v === code)) return "Choose a reason";
  if (code === "other" && details.trim().length < 10) return "Please describe the problem (at least 10 characters)";
  return null;
}

/** Temporary restriction durations offered to admins (hours). Database accepts 1 hour – 90 days. */
export const RESTRICTION_DURATIONS = [
  { h: 24, label: "24 hours" }, { h: 72, label: "3 days" }, { h: 168, label: "7 days" }, { h: 720, label: "30 days" }, { h: 2160, label: "90 days" },
];

export const isRestrictionActive = (r: { starts_at: string; ends_at: string; lifted_at: string | null }, now = Date.now()) =>
  !r.lifted_at && new Date(r.starts_at).getTime() <= now && new Date(r.ends_at).getTime() > now;

/** Credential check methods per profession — must match record_credential_check in the database. */
export const CHECK_METHODS: Record<string, { v: string; label: string }[]> = {
  "Chartered Accountant": [
    { v: "icai_online_member_verification", label: "ICAI online member verification (looked up by admin)" },
    { v: "icai_certificate_reviewed", label: "ICAI membership / COP certificate reviewed" },
    { v: "icai_written_confirmation", label: "Written confirmation received from ICAI" },
  ],
  Advocate: [
    { v: "bar_council_roll_verification", label: "State Bar Council roll / enrolment lookup (by admin)" },
    { v: "bar_council_certificate_reviewed", label: "Bar Council enrolment certificate reviewed" },
    { v: "bar_council_written_confirmation", label: "Written confirmation received from Bar Council" },
  ],
};
export const checkMethodsFor = (category: string) => CHECK_METHODS[category] ?? [{ v: "other_documented", label: "Other documented check" }];
export const CHECK_OUTCOMES = [
  { v: "confirmed", label: "Confirmed — details match" }, { v: "mismatch", label: "Mismatch" },
  { v: "not_found", label: "Not found" }, { v: "inconclusive", label: "Inconclusive" },
];
