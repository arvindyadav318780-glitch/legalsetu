import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";
type Cell = string | number | boolean | null;

/**
 * Admin-only management report: one new Google Sheet with 12 tabs.
 * Reporting layer only — the database stays authoritative. Never exports message bodies,
 * documents, phone numbers, payment secrets or passwords.
 */
export const exportMarketplaceSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Only admins can export reports");
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const sheetsKey = process.env["GOOGLE_SHEETS_API_KEY"];
    if (!lovableKey || !sheetsKey) throw new Error("Google Sheets is not connected yet");
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");

    const [roles, pros, reqs, crs, convs, ledger, orders, pays, rrs, crf, reports, tickets, appeals] = await Promise.all([
      sb.from("user_roles").select("user_id,role").limit(20000),
      sb.from("professional_profiles").select("user_id,display_name,category,city,state,years_experience,verification_status,is_listed,suspended,fee_from_paise,fee_to_paise,availability,reviewed_at,created_at").limit(10000),
      sb.from("service_requests").select("reference,service_name,city,state,mode,status,assigned_professional_id,created_at").order("created_at", { ascending: false }).limit(10000),
      sb.from("contact_requests").select("id,client_id,professional_id,status,initiated_by,created_at,decided_at").order("created_at", { ascending: false }).limit(20000),
      sb.from("conversations").select("id,professional_id,closed,created_at").limit(20000),
      sb.from("credit_ledger").select("created_at,professional_id,kind,delta,price_paise,note").order("created_at", { ascending: false }).limit(20000),
      sb.from("credit_orders").select("created_at,professional_id,credits,amount_paise,status,provider_order_id,test_mode,paid_at").order("created_at", { ascending: false }).limit(10000),
      sb.from("payments").select("created_at,description,total_paise,platform_fee_paise,platform_tax_paise,refunded_paise,status,provider_order_id,invoice_number,test_mode").order("created_at", { ascending: false }).limit(10000),
      sb.from("refund_requests").select("created_at,amount_paise,status,provider_refund_id").limit(10000),
      sb.from("credit_refunds").select("created_at,amount_paise,credits_reversed,status,provider_refund_id,failure_reason").limit(10000),
      sb.from("abuse_reports").select("created_at,status,reason").limit(10000),
      sb.from("support_tickets").select("created_at,kind,status,subject").limit(10000),
      sb.from("appeals").select("created_at,status,subject").limit(10000),
    ]);
    const R = <T,>(x: { data: T[] | null }) => x.data ?? [];
    const proName = new Map(R(pros).map((p) => [p.user_id, p.display_name]));
    const rs = R(roles);
    const has = (role: string) => new Set(rs.filter((r) => r.role === role).map((r) => r.user_id)).size;
    const d = (s: string | null | undefined) => (s ? s.slice(0, 10) : "");
    const rupees = (p: number | null | undefined) => (p == null ? "" : p / 100);
    const short = (id: string | null | undefined) => (id ? id.slice(0, 8) : "");
    const pName = (id: string | null | undefined) => (id ? proName.get(id) ?? short(id) : "");
    const cut = (s: string | null | undefined, n = 120) => (s ?? "").slice(0, n);

    const proRow = (p: (typeof pros.data & object)[number]) => [p.display_name, p.city ?? "", p.state ?? "", p.years_experience ?? "", p.verification_status, p.is_listed ? "Yes" : "No", p.suspended ? "Yes" : "No", rupees(p.fee_from_paise), rupees(p.fee_to_paise), cut(p.availability, 80), d(p.created_at)];
    const proHead = ["Name", "City", "State", "Experience (yrs)", "Verification", "Listed", "Suspended", "Fee from (₹)", "Fee to (₹)", "Availability", "Joined"];

    const tabs: { title: string; rows: Cell[][] }[] = [
      { title: "Dashboard Summary", rows: [] },
      { title: "Client Leads", rows: [["Reference", "Service", "City", "State", "Mode", "Status", "Assigned professional", "Created"], ...R(reqs).map((r) => [r.reference, r.service_name, r.city ?? "", r.state ?? "", r.mode ?? "", r.status, pName(r.assigned_professional_id), d(r.created_at)])] },
      { title: "CA Directory", rows: [proHead, ...R(pros).filter((p) => p.category === "Chartered Accountant").map(proRow)] },
      { title: "Advocate Directory", rows: [proHead, ...R(pros).filter((p) => p.category === "Advocate").map(proRow)] },
      { title: "Contact Requests", rows: [["Request", "Client", "Professional", "Status", "Started by", "Created", "Decided"], ...R(crs).map((c) => [short(c.id), short(c.client_id), pName(c.professional_id), c.status, c.initiated_by, d(c.created_at), d(c.decided_at)])] },
      { title: "Conversations Summary", rows: [["Conversation", "Professional", "Status", "Opened"], ...R(convs).map((c) => [short(c.id), pName(c.professional_id), c.closed ? "Closed" : "Active", d(c.created_at)])] },
      { title: "Contact Credit Transactions", rows: [["Date", "Professional", "Type", "Credits", "Price per credit (₹)", "Note"], ...R(ledger).map((l) => [d(l.created_at), pName(l.professional_id), l.kind, l.delta, rupees(l.price_paise), cut(l.note)])] },
      { title: "Credit Purchases", rows: [["Date", "Professional", "Credits", "Amount (₹)", "Status", "Razorpay order", "Mode", "Paid on"], ...R(orders).map((o) => [d(o.created_at), pName(o.professional_id), o.credits, rupees(o.amount_paise), o.status, o.provider_order_id ?? "", o.test_mode ? "TEST" : "LIVE", d(o.paid_at)])] },
      { title: "Payment & Refund Reconciliation", rows: [["Date", "Kind", "Description", "Amount (₹)", "Platform fee + GST (₹)", "Refunded (₹)", "Status", "Provider ref", "Invoice", "Mode"],
        ...R(pays).map((p) => [d(p.created_at), "Service payment", cut(p.description, 80), rupees(p.total_paise), rupees(p.platform_fee_paise + p.platform_tax_paise), rupees(p.refunded_paise), p.status, p.provider_order_id ?? "", p.invoice_number ?? "", p.test_mode ? "TEST" : "LIVE"]),
        ...R(rrs).map((r) => [d(r.created_at), "Service refund", "", rupees(r.amount_paise), "", "", r.status, r.provider_refund_id ?? "", "", ""]),
        ...R(crf).map((r) => [d(r.created_at), "Credit-pack refund", `${r.credits_reversed} credits${r.failure_reason ? ` · ${cut(r.failure_reason, 60)}` : ""}`, rupees(r.amount_paise), "", "", r.status, r.provider_refund_id ?? "", "", ""])] },
      { title: "Complaints & Reports", rows: [["Date", "Type", "Status", "Summary"],
        ...R(reports).map((r) => [d(r.created_at), "Abuse report", r.status, cut(r.reason, 100)]),
        ...R(tickets).filter((t) => t.kind !== "general").map((t) => [d(t.created_at), `Ticket: ${t.kind}`, t.status, cut(t.subject, 100)]),
        ...R(appeals).map((a) => [d(a.created_at), "Appeal", a.status, cut(a.subject, 100)])] },
      { title: "Verification Status", rows: [["Name", "Category", "Status", "Listed", "Suspended", "Last reviewed", "Submitted"], ...R(pros).map((p) => [p.display_name, p.category, p.verification_status, p.is_listed ? "Yes" : "No", p.suspended ? "Yes" : "No", d(p.reviewed_at), d(p.created_at)])] },
      { title: "Monthly Business Summary", rows: [] },
    ];

    // Monthly summary computed from records (platform revenue = credit sales + platform fees; professional fees are never LegalSetu revenue).
    const months = new Map<string, { leads: number; contacts: number; accepted: number; used: number; credit: number; plat: number; refunds: number }>();
    const m = (s: string) => { const k = s.slice(0, 7); if (!months.has(k)) months.set(k, { leads: 0, contacts: 0, accepted: 0, used: 0, credit: 0, plat: 0, refunds: 0 }); return months.get(k)!; };
    R(reqs).forEach((r) => m(r.created_at).leads++);
    R(crs).forEach((c) => { const x = m(c.created_at); x.contacts++; if (c.status === "accepted") x.accepted++; });
    R(ledger).forEach((l) => { if (l.kind === "consume") m(l.created_at).used++; });
    R(orders).forEach((o) => { if (o.status === "successful" || o.status === "refunded") m(o.paid_at ?? o.created_at).credit += o.amount_paise; });
    R(pays).forEach((p) => { if (["successful", "partially_refunded", "refunded"].includes(p.status)) m(p.created_at).plat += p.platform_fee_paise + p.platform_tax_paise; });
    R(crf).forEach((r) => { if (r.status === "processed") m(r.created_at).refunds += r.amount_paise; });
    R(rrs).forEach((r) => { if (r.status === "processed" || r.status === "approved") m(r.created_at).refunds += r.amount_paise; });
    const monthly = [...months.entries()].sort((a, b) => b[0].localeCompare(a[0]));
    tabs[11].rows = [["Month", "New leads", "Contact requests", "Accepted contacts", "Credits used", "Credit sales (₹)", "Platform fees incl. GST (₹)", "Refunds (₹)", "Net platform revenue (₹)"],
      ...monthly.map(([k, v], i) => [k, v.leads, v.contacts, v.accepted, v.used, v.credit / 100, v.plat / 100, v.refunds / 100, `=F${i + 2}+G${i + 2}-H${i + 2}`])];

    const pv = R(pros);
    const thisMonth = new Date().toISOString().slice(0, 7);
    tabs[0].rows = [
      ["LegalSetu management report", new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC"],
      ["Reporting copy only — the LegalSetu database is the source of truth. Payments are in TEST MODE.", ""],
      ["Metric", "Value"],
      ["Registered clients", has("customer")],
      ["Registered CAs", pv.filter((p) => p.category === "Chartered Accountant").length],
      ["Registered Advocates", pv.filter((p) => p.category === "Advocate").length],
      ["Verified professionals", pv.filter((p) => p.verification_status === "approved").length],
      ["Pending / under review professionals", pv.filter((p) => ["pending", "under_review", "more_info_required"].includes(p.verification_status)).length],
      ["Service requests (leads)", "=COUNTA('Client Leads'!A2:A)"],
      ["New leads this month", `=COUNTIF('Client Leads'!H2:H,"${thisMonth}*")`],
      ["Contact requests", "=COUNTA('Contact Requests'!A2:A)"],
      ["Accepted contacts", `=COUNTIF('Contact Requests'!D2:D,"accepted")`],
      ["Active conversations", `=COUNTIF('Conversations Summary'!C2:C,"Active")`],
      ["Contact credits used", `=COUNTIF('Contact Credit Transactions'!C2:C,"consume")`],
      ["Credit sales (₹)", `=SUMIFS('Credit Purchases'!D2:D,'Credit Purchases'!E2:E,"successful")+SUMIFS('Credit Purchases'!D2:D,'Credit Purchases'!E2:E,"refunded")`],
      ["Credit-pack refunds processed (₹)", `=SUMIFS('Payment & Refund Reconciliation'!D2:D,'Payment & Refund Reconciliation'!B2:B,"Credit-pack refund",'Payment & Refund Reconciliation'!G2:G,"processed")`],
      ["Platform revenue this month (₹)", `=IFERROR(INDEX('Monthly Business Summary'!I2:I,MATCH("${thisMonth}",'Monthly Business Summary'!A2:A,0)),0)`],
      ["Outstanding complaints / reports / appeals", `=COUNTIF('Complaints & Reports'!C2:C,"open")+COUNTIF('Complaints & Reports'!C2:C,"pending")+COUNTIF('Complaints & Reports'!C2:C,"in_progress")`],
      ["Paid contact enabled", "No — pending legal review"],
    ];

    const headers = { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": sheetsKey, "Content-Type": "application/json" };
    const call = async (url: string, body: unknown) => {
      const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
      if (!res.ok) { const t = await res.text(); console.error(`Sheets request failed [${res.status}]: ${t}`); throw new Error(`Google Sheets error [${res.status}]: ${t.slice(0, 200)}`); }
      return res.json();
    };
    const sheet = (await call(`${GATEWAY_URL}/spreadsheets`, {
      properties: { title: `LegalSetu report ${new Date().toISOString().slice(0, 10)}` },
      sheets: tabs.map((t, i) => ({ properties: { sheetId: i, title: t.title, gridProperties: { frozenRowCount: i === 0 ? 3 : 1 } } })),
    })) as { spreadsheetId: string; spreadsheetUrl: string };
    await call(`${GATEWAY_URL}/spreadsheets/${sheet.spreadsheetId}/values:batchUpdate`, {
      valueInputOption: "USER_ENTERED",
      data: tabs.map((t) => ({ range: `'${t.title}'!A1`, values: t.rows.map((r) => r.map((c) => (c == null ? "" : c))) })),
    });
    // Bold headers + filters on every data tab.
    await call(`${GATEWAY_URL}/spreadsheets/${sheet.spreadsheetId}:batchUpdate`, {
      requests: tabs.flatMap((t, i) => {
        const hr = i === 0 ? 2 : 0;
        const cols = Math.max(2, ...t.rows.map((r) => r.length));
        const reqs: unknown[] = [{ repeatCell: { range: { sheetId: i, startRowIndex: hr, endRowIndex: hr + 1 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: "userEnteredFormat.textFormat.bold" } }];
        if (i !== 0) reqs.push({ setBasicFilter: { filter: { range: { sheetId: i, startRowIndex: 0, endRowIndex: Math.max(2, t.rows.length), startColumnIndex: 0, endColumnIndex: cols } } } });
        reqs.push({ autoResizeDimensions: { dimensions: { sheetId: i, dimension: "COLUMNS", startIndex: 0, endIndex: cols } } });
        return reqs;
      }),
    });
    await sb.from("audit_logs").insert({ actor_id: context.userId, action: "report.sheets_export", target: `sheet:${sheet.spreadsheetId}`, details: { tabs: tabs.map((t) => [t.title, Math.max(0, t.rows.length - 1)]) } });
    return { url: sheet.spreadsheetUrl };
  });
