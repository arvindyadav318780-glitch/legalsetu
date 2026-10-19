# LegalSetu — Backup & Recovery

## What is backed up
- **Database:** Lovable Cloud takes one automatic backup per day and keeps about 14 daily snapshots. Point-in-time restore (to any minute) is not available.
- **Not covered:** uploaded files (private `documents` and `avatars` storage). Keep your own periodic copy of important files if needed.
- **Reports:** Google Sheets exports are reporting copies only, never a backup.

## How to restore (owner/editor only)
1. Open the project in Lovable → **Cloud → Database → Backups**.
2. Pick the snapshot (times are UTC) → **Restore to this backup** → confirm.
3. The database is offline for a few minutes. **Everything after that snapshot is lost permanently** (requests, payments, credit history, audit logs).
4. Afterwards, ask Lovable in chat to test the app and fix any schema mismatch.
5. Reconcile payments: compare Razorpay dashboard orders/refunds after the snapshot time with **Admin → Payments** and **Admin → Marketplace → Reconciliation**; re-run "Check with Razorpay" for pending items.

## Rules
- Never restore production without the owner's written approval.
- Before restoring, export a Google Sheets report so post-snapshot activity is recorded.
- A restore has NOT been rehearsed yet (status: NOT VERIFIED). Rehearse on a non-production copy before launch.

## Retention
Admin → Retention: message and closed-contact retention days, manual purge with typed confirmation. Purges never touch credit history, payments, refunds or audit logs.
