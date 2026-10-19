/** Fee model: every component is a separate line. The professional fee is passed through
 * unchanged — LegalSetu never deducts a commission from it. */
export type FeeInput = {
  professionalFeePaise: number;
  professionalTaxPaise: number;
  governmentFeePaise: number;
  platformFeePaise: number;
  platformGstPercent: number;
};
export type FeeBreakdown = {
  professional_fee_paise: number;
  professional_tax_paise: number;
  platform_fee_paise: number;
  platform_tax_paise: number;
  government_fee_paise: number;
  total_paise: number;
};

const int = (n: number) => Math.max(0, Math.round(Number.isFinite(n) ? n : 0));

export function computeFees(i: FeeInput): FeeBreakdown {
  const professional_fee_paise = int(i.professionalFeePaise);
  const professional_tax_paise = int(i.professionalTaxPaise);
  const platform_fee_paise = int(i.platformFeePaise);
  const platform_tax_paise = int((platform_fee_paise * Math.max(0, i.platformGstPercent)) / 100);
  const government_fee_paise = int(i.governmentFeePaise);
  return {
    professional_fee_paise, professional_tax_paise, platform_fee_paise, platform_tax_paise, government_fee_paise,
    total_paise: professional_fee_paise + professional_tax_paise + platform_fee_paise + platform_tax_paise + government_fee_paise,
  };
}

export const PAYMENT_STATES = ["pending", "initiated", "successful", "failed", "cancelled", "refund_requested", "refunded", "partially_refunded"] as const;

/** Customer can (re)open checkout only from these states. */
export const canPay = (s: string) => ["pending", "failed", "cancelled"].includes(s);

/** Provider events may never downgrade a paid record. */
export const isPaidState = (s: string) => ["successful", "refund_requested", "refunded", "partially_refunded"].includes(s);

export const refundableRemaining = (p: { total_paise: number; refunded_paise: number }) => Math.max(0, p.total_paise - p.refunded_paise);

export const inr = (p: number) => `₹${(p / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Only Razorpay test keys are ever accepted. */
export const isTestKey = (k: string | undefined) => !!k && k.startsWith("rzp_test_");
