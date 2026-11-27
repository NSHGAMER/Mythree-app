# Implementation report – professor requirements & free-tier hardening

Branch: `feature/professor-requirements` · Rollback point: tag `v1.0.0-baseline` (production as of 26 Nov 2026).
Production (`main`, https://mythree-five.vercel.app) is **not** changed until the owner approves each phase.

## Phase 0 – Audit and safety (27 Nov 2026)
- Rollback tag `v1.0.0-baseline` pushed; all work on `feature/professor-requirements`.
- Read `SCALABILITY_AUDIT.md`, `loadtest/RESULTS.md`, schema, RPCs, Edge Functions, Vercel config. Professor PDF not found in the project – using the owner directive.
- Added `REQUIREMENTS_TRACEABILITY.md` (gap list), `BACKUP_AND_RECOVERY.md`, `.github/workflows/db-backup.yml` (encrypted nightly `pg_dump`; activates when the owner adds two repository secrets and the workflow reaches `main`).
- Production database currently has **0 member accounts** (test accounts were removed), so the registration changes need no data migration of existing members.

### Owner decisions requested (defaults used until answered)
1. Free staging Supabase project for testing migrations/payments – default: requested, not created yet.
2. Razorpay test keys – required to test checkout end to end.
3. UID collision/short-name policy – default: `SUBR1234`, then `SUBR1234-2`…; names < 4 letters padded with `X`; minors use guardian's last 4 digits.
4. Answer-sheet storage – default: browser compression (~200 KB/page) + purge after evaluation with ZIP download.
5. Video hosting – default: unlisted YouTube with IFrame API watch tracking.
6. OTP policy – no change without decision (see below).

### Evaluation: email / phone OTP requirements
| Option | Effect on bottlenecks | Risks |
|---|---|---|
| Keep email confirmation ON (current) + phone OTP optional (current) | Every registration needs one email → bounded by the SMTP quota (free tiers ~100–300/day) | Registration waves must be batched |
| Email confirmation OFF, payment required | No email needed to register; ₹151 payment proves intent and blocks most fake/bot accounts | Typos in email are not caught → password reset may go to a wrong address; anyone can register with someone else's email (they would still have to pay). Admin-allowlist auto-admin **must** be disabled or require manual promotion, otherwise an attacker could register an allowlisted email unconfirmed. |
| Phone OTP mandatory | Every registration sends one SMS (paid per message, DLT setup in India) | Cost; shared guardian numbers make "one phone = one person" invalid anyway |
| Recommended | Keep email confirmation ON for launch but onboard in batches; keep phone OTP optional; revisit after measuring SMTP throughput | — |

No authentication setting has been changed.
