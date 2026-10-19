import { supabase } from "@/integrations/supabase/client";

export type SecurityKind = "permission_denied" | "app_error" | "suspicious_activity";

/** Records a sanitised event. Never pass passwords, tokens, emails or phone numbers;
 *  the database also redacts them and rate-limits each user. Failures are ignored. */
export async function logSecurityEvent(kind: SecurityKind, area: string, summary: string) {
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    await supabase.rpc("log_security_event", { _kind: kind, _area: area.slice(0, 80), _summary: summary.slice(0, 300) });
  } catch { /* logging must never break the page */ }
}

export type HealthRow = { id: string; at: string; type: string; severity: "low" | "medium" | "high"; title: string; detail: string; test: boolean };

export const SEVERITY_ORDER = { low: 0, medium: 1, high: 2 } as const;

/** Filters merged rows by type, minimum severity, date range (YYYY-MM-DD) and test flag. */
export function filterHealth(rows: HealthRow[], f: { type?: string; severity?: string; from?: string; to?: string; test?: "all" | "real" | "test" }) {
  return rows.filter((r) => {
    if (f.type && r.type !== f.type) return false;
    if (f.severity && SEVERITY_ORDER[r.severity] < SEVERITY_ORDER[f.severity as keyof typeof SEVERITY_ORDER]) return false;
    const day = r.at.slice(0, 10);
    if (f.from && day < f.from) return false;
    if (f.to && day > f.to) return false;
    if (f.test === "real" && r.test) return false;
    if (f.test === "test" && !r.test) return false;
    return true;
  }).sort((a, b) => b.at.localeCompare(a.at));
}
