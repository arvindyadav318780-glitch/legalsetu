<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Decorative texture: one pointer-transparent root layer with CSS opacity — why: layouts and print stay intact.
- Catalogue defaults/questions in `src/lib/catalog.ts`; DB overrides (services, categories, fees, FAQs) merged by `src/lib/catalog-live.ts`, falling back to code. Plans and locations are code-only.
- Browser talks to Cloud directly; access control is RLS + security-definer helpers + guard triggers only — UI role checks are cosmetic.
- Roles only in `user_roles`; signup may assign customer/professional, never admin/support; nobody changes own roles.
- Private files: `documents` bucket (60s signed URLs) and `avatars` bucket (1h signed URLs), both under `<user_id>/...` — why: workspace blocks public buckets.
- Signed-in areas live under `src/routes/_authenticated/` (see its AGENTS.md).
- Admin actions are audited by DB triggers into append-only `audit_logs`.
- Staff open customer files/request messages only after a logged reason (`doc_access_log`, `conversation_access_log`); private conversations are readable by staff only once reported.
- `guard_verification`: admins change status only, professionals own credentials/listing; approval needs a `confirmed` `credential_checks` row (via `record_credential_check`) newer than the latest submission — why: approvals cite a recorded check, old approvals stay.
- `guard_listing` forces listing off unless approved, active and complete.
- Request transitions enforced in `guard_request_update`, mirrored in `src/lib/status.ts`; retired statuses are rejected for new writes. Rate limits and exact-duplicate checks in `guard_request_insert` — why: must hold for direct API calls.
- Payments/refunds/credit grants trust only verified Razorpay outcomes (webhooks + server checks); credits live in append-only `credit_ledger`; refunds hold credits until `settle_credit_refund`.
- `accept_contact_request` charges once per client/pro pair in one locked transaction; paid and pro-initiated contact gated by `marketplace_settings` legal review; pro-initiated only to past clients.
- Reviews need a verified interaction, one per interaction; moderation never edits text.
- Retention purges are manual admin-only (`purge_expired`) and never touch financial or audit records; Sheets is audited admin export only.
- Contact privacy: `service_requests` email/phone column-revoked, read via `request_contact()` (client, admin, accepted pro with consent); `profiles` readable by owner/admin only, support uses `staff_directory()` and `staff_contact_messages()` (no phone, email admin-only).
- Security events only via sanitised `log_security_event()`, admin-read; shown in `/admin/security`.
- Abuse reports: fixed `reason_code` list shared by `src/lib/reports.ts` and `guard_abuse_report`, which limits who may report whom.
- Temporary restrictions in `account_restrictions` (admin RPCs only) apply via `is_suspended()` until `ends_at`; upholding a linked appeal lifts them — why: auto-expiry without touching the permanent `suspended` flag.
- Admin control center data comes from admin-only `crm_*` security-definer functions; CRM alerts reuse `risk_alerts` deduplicated by an open-status unique index on (kind, details->>'key') — why: one alert per unresolved issue, history kept.
