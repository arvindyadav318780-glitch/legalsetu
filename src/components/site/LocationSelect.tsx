import { useId } from "react";
import { INDIA_LOCATIONS, STATES } from "@/lib/india";
import { cn } from "@/lib/utils";

const sel = "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function LocationSelect({ state, city, onChange, className, allLabel = "All states" }: {
  state: string; city: string; onChange: (v: { state: string; city: string }) => void; className?: string; allLabel?: string;
}) {
  const cities = state ? INDIA_LOCATIONS[state] ?? [] : [];
  const uid = useId();
  return (
    <div className={cn("grid grid-cols-2 gap-2", className)}>
      <label className="sr-only" htmlFor={uid + "-state"}>State</label>
      <select id={uid + "-state"} className={sel} value={state} onChange={(e) => onChange({ state: e.target.value, city: "" })}>
        <option value="">{allLabel}</option>
        {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <label className="sr-only" htmlFor={uid + "-city"}>City</label>
      <select id={uid + "-city"} className={sel} value={city} disabled={!state} onChange={(e) => onChange({ state, city: e.target.value })}>
        <option value="">{state ? "All cities" : "Select state first"}</option>
        {cities.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  );
}

export const selectCls = sel;
