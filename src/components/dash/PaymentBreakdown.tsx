import { inr } from "@/lib/fees";

type P = { professional_fee_paise: number; professional_tax_paise: number; platform_fee_paise: number; platform_tax_paise: number; government_fee_paise: number; total_paise: number; refunded_paise?: number; tax_note?: string | null };

export function TestModeBadge() {
  return <span className="inline-flex items-center rounded-full border border-warning/50 bg-warning/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-warning">Test mode</span>;
}

export function PaymentBreakdown({ p, proName }: { p: P; proName?: string | null }) {
  const rows: [string, number, string?][] = [
    [`Professional fee${proName ? ` · ${proName}` : ""}`, p.professional_fee_paise, "Paid to the professional in full — no commission is deducted."],
    ["Tax on professional fee", p.professional_tax_paise],
    ["LegalSetu platform fee", p.platform_fee_paise],
    ["GST on platform fee", p.platform_tax_paise],
    ["Government / statutory fees", p.government_fee_paise],
  ];
  return (
    <dl className="divide-y text-sm">
      {rows.map(([k, v, hint]) => (
        <div key={k} className="flex justify-between gap-4 py-2"><dt><span>{k}</span>{hint && <span className="block text-xs text-muted-foreground">{hint}</span>}</dt><dd className="font-medium tabular-nums">{inr(v)}</dd></div>
      ))}
      <div className="flex justify-between gap-4 py-3 text-base font-bold"><dt>Total payable</dt><dd className="tabular-nums">{inr(p.total_paise)}</dd></div>
      {!!p.refunded_paise && <div className="flex justify-between gap-4 py-2 text-sm"><dt>Refunded</dt><dd className="tabular-nums">−{inr(p.refunded_paise)}</dd></div>}
      {p.tax_note && <p className="pt-2 text-xs text-muted-foreground">{p.tax_note}</p>}
    </dl>
  );
}
