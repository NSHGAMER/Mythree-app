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

## Phases 1–5 – code complete on the branch (27 Nov 2026), database testing pending
Status rule: nothing below is "complete" until the migrations have been applied to a staging project and tested.

### Phase 1 – Registration & mandatory ₹151 fee
- Migration `0005_registration.sql`: DOB, guardian name/phone, exam preference, permanent `member_uid` (advisory-locked, collision suffix `-2…`, unique index), `registration_status` (existing rows = confirmed), non-unique phones, `registration_payments` (one paid per member, receipts `MYR-YYYY-000001`), access-gate triggers on tests/challenges/exam requests, admin manual confirmation (audited), `my_registration()`.
- Edge Functions: `registration-order` (re-uses one open order per member → no double charge across tabs), `registration-verify` (signature + Razorpay API + amount check), `registration-status` (recovery after a closed browser); webhook routes registration vs Guru Dakshina orders; duplicate captured payments are recorded for refund, never confirmed twice.
- UI: 3-step registration (DOB, online/offline, adult phone vs guardian phone, UID preview, draft kept across refresh), `/app/registration` payment page, pending members redirected there, admin **Registrations & UIDs** page (search by UID/phone, CSV, manual confirm), UID on dashboard/profile/settings. Public copy no longer says registration is free.

### Phase 2 – Learning & video
- Migration `0006_videos_challenges.sql`: `video_lessons` (YouTube or MP4, scheduled `publish_at`, completion %), `video_progress` with 10-second watched buckets credited only for real-time forward playback (seek/refresh cannot complete), +15 XP on completion; `challenge_sets` for admin-managed daily/weekly tests (questions, dates, XP, pass %), auto challenges remain the fallback.
- UI: member Video classes list + player (resume, progress), admin Video lessons + Daily & weekly tests pages.

### Phase 3 – Examinations
- Migration `0007_examinations.sql`: cohort `exam_schedules` (suggested month = registration month + 3), per-member override, `exam_sessions` with server deadline and upload grace, `exam_submission_pages`, private buckets `exam-papers` / `answer-sheets` with storage policies that close at the deadline, `exam_results` (members see only published), `result_imports` audit, RPCs for start/upload/remove/submit, cohorts, submissions, save/publish results (published results never overwritten without explicit flag), Excel import with dry-run preview, purge after ZIP download.
- UI: member **Exam & results** (countdown, START, PDF, compressed multi-photo upload with progress/retry/review, SUBMIT, results), admin **Exam schedules** and **Evaluation & results** (image review, marks, publish, offline results by UID, Excel template/import).

### Phase 4 – Admin & chatbot
- Chatbot suggested-questions button (FAQ-sourced, fills the input without sending, keyboard + Escape + outside click), instant answers from cached published FAQs using the same scoring as the server.
- Dashboard journey cards: video %, exam date/countdown/result, member ID & registration status.

### Phase 5 – Free-tier scalability
- Frontend: shared request cache with in-flight de-duplication + invalidation after writes, backoff+jitter retries only for idempotent calls, one profile read per login, cached settings/FAQs, admin-only heavy chunks excluded from PWA precache (4.5 MB → 3.1 MB).
- Migration `0008_performance_jobs.sql`: append-only unlogged rate limiter (no hot rows), trusted client IP, `chapters.question_count`, read-only `my_dashboard`, `touch_last_seen()` once per session, `leaderboard_snapshot` (self-refreshing every 5 min), FK/trigram indexes, single SELECT policy per table, `run_maintenance()`, pgmq `notifications` queue, Vault-held cron secret, `schedule_mythree_jobs(functions_url)`, `admin_system_health()`.
- Edge Functions: `payments-reconcile` (every 10 min), `notifications-worker` (every 2 min); OTP now authenticates first and uses the guardian number for minors.

### Tests so far
- Unit/component: **99 passed** (validation incl. adult/minor and UID rules, video completion, exam countdown/suggested month, CSV/Excel parsing, cache/retry, FAQ matching, chatbot suggestions).
- Not yet run: database integration, end-to-end and load tests for phases 1–5 (need the staging project).

### Dependencies added
- `exceljs@4.4.0`, `jszip@3.10.1` (admin only, lazy-loaded). `npm audit` reports a moderate advisory in exceljs's `uuid` dependency (affects `uuid` v3/v5/v6 with a caller-supplied buffer; exceljs does not use that path).
