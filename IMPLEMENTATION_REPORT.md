# Implementation report – professor requirements & free-tier hardening

_Final verification report · 28 Nov 2026 · branch `feature/professor-requirements` · rollback point tag `v1.0.0-baseline` (= `main`, 56c3dd1)_

## 0. Status in one paragraph
All professor-requirement features are built and verified on the free staging project **mythree-staging**. **Production and `main`
are unchanged** – re-checked read-only on 28 Nov 2026 (`docs/verification/production-unchanged.md`). Things still waiting on the owner:
Razorpay test keys (live checkout is not yet tested), Turnstile keys, GitHub backup secrets, and **approval of the production rollout
in §5**. Nothing will be deployed or merged without that approval.

## 1. Environments
| | Production | Staging |
|---|---|---|
| Web | https://mythree-five.vercel.app (`main`, v1) | local preview / Vercel preview of the branch (preview env vars still point at production – switch them to staging before using previews) |
| Supabase | `mythree` (yflxqluyvueftocfzqzm), Free – migrations 0001–0004, 8 functions | `mythree-staging` (mxxkpcincouaniqryzfy), Free – migrations 0001–0009, 9 functions (all registration/payment/job functions; OTP, notify-admin and account-delete not deployed there), 4 cron jobs |
| Data | 1 real member (grandfathered at rollout) | 306 test accounts on the reserved `.test` domain |

## 2. Completed features (all on staging)
| Area | What was built | Main files |
|---|---|---|
| Registration | 3-step form: name, *name in English letters* (only for names in another script), DOB, exam preference, address/PIN, email, phone; adult own phone / minor guardian phone; siblings may share; draft survives refresh | `src/pages/auth/Register.tsx`, `src/lib/validation.ts`, migrations 0005, 0009 |
| ₹151 fee | mandatory for **new** members; order re-use (no double charge), signature + Razorpay API verification, webhook, "Check payment status" recovery, reconciliation every 10 min, duplicate payment → refund flag, receipts `MYR-YYYY-000001`, admin manual confirmation with audit | `registration-order/verify/status`, `payments-webhook`, `payments-reconcile`, `src/pages/member/Registration.tsx`, `src/pages/admin/Registrations.tsx` |
| Existing members | grandfathered: rows that exist when 0005 runs become `confirmed` (no retroactive fee); 0009 gives them a member ID | migrations 0005 (default), 0009 (backfill) |
| Member ID | `SUBR1234`: 4 English letters + last 4 digits of the applicable phone, permanent, collisions `-2…`, advisory-locked | `assign_member_uid()` |
| Videos | scheduled lessons in order, YouTube (unlisted) or MP4, 10-s watch buckets credited only at real-time speed, resume, completion %, +15 XP once | migration 0006, `src/pages/member/Videos.tsx`, `VideoLesson.tsx`, `src/pages/admin/Videos.tsx` |
| Daily/weekly tests | admin-managed question sets with dates and rewards; automatic challenges as fallback | migration 0006, `src/pages/admin/ChallengeSets.tsx` |
| Exams | batch schedules (registration month + 3), per-member override, online exam (START → 3 h server deadline + 15 min upload grace → PDF → compressed multi-photo upload with progress/retry → SUBMIT), offline flow unchanged | migration 0007, `src/pages/member/ExamRoom.tsx`, `src/pages/admin/ExamSchedules.tsx` |
| Evaluation & results | view sheets, marks/remarks/PASS-FAIL, publish; Excel template + dry-run import with issue list; published results never silently overwritten; members see only published results | migration 0007, `src/pages/admin/Evaluation.tsx`, `src/lib/sheets.ts` |
| Dashboard & chatbot | member ID, registration, video %, exam date/countdown/result; FAQ suggested-questions button (fills input, no auto-send) | `Dashboard.tsx`, `Chatbot.tsx` |
| Free-tier performance | request cache + de-dup, backoff for idempotent calls, snapshot leaderboard, contention-free rate limiter, indexes, pg_cron/pgmq jobs, smaller PWA precache | migration 0008, `src/lib/cache.ts` |
| Security | anonymous phone probing closed; trusted client IP; optional **Cloudflare Turnstile** on login/register/reset/resend (off until a site key is set) | `src/components/Turnstile.tsx`, `docs/TURNSTILE_SETUP.md` |
| Operations | rollback scripts for 0005–0009, nightly encrypted backup workflow, isolated restore drill script | `supabase/rollback/`, `.github/workflows/db-backup.yml`, `scripts/backup_restore_drill.sql` |

Design, branding, navigation, animations, roles and all v1 features are unchanged – the full v1 screen suite still passes on four device sizes.

## 3. Migrations
| # | File | Content | On staging | On production |
|---|---|---|---|---|
| 0001–0004 | `20261126000001…04` | v1 schema, functions, seed, FAQ matching (0001 quoting fixed for fresh builds only) | ✅ | ✅ (26 Nov) |
| 0005 | `20261127000005_registration.sql` | registration fields, fee, UID, payments, access gate | ✅ | ⬜ |
| 0006 | `20261127000006_videos_challenges.sql` | videos, watch progress, challenge sets | ✅ | ⬜ |
| 0007 | `20261127000007_examinations.sql` | schedules, sessions, uploads, results, imports, storage buckets | ✅ | ⬜ |
| 0008 | `20261127000008_performance_jobs.sql` | snapshot leaderboard, rate limiter, indexes, cron/queue jobs | ✅ | ⬜ |
| 0009 | `20261127000009_english_name_uid.sql` | English spelling for member IDs, UID backfill for existing members | ✅ | ⬜ |

The production upgrade path (v1 → 0005 → 0009 on existing data) was **rehearsed on staging**: rolled back to v1 with the rollback scripts
(v1 tests 17/17, all v1 data kept, phone uniqueness restored), then re-upgraded in order (46/46 tests afterwards).

## 4. Bugs found by the staging tests (all fixed on the branch – none reached production)
| # | Bug | Fix | Regression test |
|---|---|---|---|
| 1 | 0001 had a broken `$` quote – a fresh project could not be built from the repo | proper `$$` quoting | `supabase/functions/_shared/migrations.test.ts` (no lone `$`) |
| 2 | Leaderboard failed for members (bare `DELETE` rejected by Supabase's safe-update guard) | `where true` | `migrations.test.ts` (no WHERE-less DELETE/UPDATE) + `integration.test.ts` + `phases.test.ts` leaderboard tests |
| 3 | Anonymous phone probing still possible (grant via PUBLIC) | revoke from `public, anon` | `phases.test.ts` "anonymous visitors can no longer probe phone numbers" + `migrations.test.ts` |
| 4 | START could not resume a session after the readiness status changed | resume check moved first | `phases.test.ts` (START after publication returns the same session) |
| 5 | One bad date/exam mode aborted a whole Excel import | per-row validation | `phases.test.ts` Excel dry-run (row with `not-a-date`) |
| 6 | Admins briefly routed to the member area after login | auth waits for the profile | e2e `flows.spec.ts` + `phases.spec.ts` admin journeys expect `/admin` |

Two outdated test expectations were also updated (registration step 1 now asks for DOB/exam preference instead of phone; the service
worker may precache the app's own `razorpay-*.js` chunk but never Razorpay's servers).

## 5. Production rollout plan (needs your approval – not started)
1. Announce a short maintenance window; turn on Admin → Settings → *Maintenance mode*.
2. **Backup:** run the GitHub *Database backup* workflow (needs the two secrets) and keep the encrypted artifact; Supabase Free has no built-in downloadable backup.
3. Apply migrations **0005 → 0006 → 0007 → 0008 → 0009** in that order on production.
4. Deploy Edge Functions: new `registration-order`, `registration-verify`, `registration-status`, `payments-reconcile`, `notifications-worker`; updated `payments-webhook`, `otp-send`, `otp-verify` (same code as staging).
5. Run `select public.schedule_mythree_jobs('https://yflxqluyvueftocfzqzm.supabase.co/functions/v1');`.
6. Merge `feature/professor-requirements` into `main` → Vercel deploys the new frontend.
7. Smoke test (existing member keeps access and gets a member ID; a new test registration lands on the ₹151 page; admin pages load), then turn maintenance mode off.
8. Razorpay **live** keys and Turnstile only after the test-mode checklist passes on staging.

**Rollback:** Vercel → Deployments → previous production deployment → *Instant Rollback* (frontend, seconds); database: `supabase/rollback/20261127000009.down.sql` → `…0008` → `…0007` → `…0006` → `…0005` (each one transaction). Rolling back 0005–0007 **deletes** registration payments, videos, exam data – export them first; empty the two exam storage buckets in the dashboard before rolling back 0007; restoring the unique phone constraint fails if members share a phone (by design – resolve first).

## 6. Test results (28 Nov 2026, staging)
| Suite | Result | Evidence |
|---|---|---|
| Unit & component (Vitest) | **107 / 107** | `docs/verification/unit-tests.log` |
| Database integration (v1 regression 17 + phases 1–5 29) | **46 / 46** | `docs/verification/db-tests.log` |
| SQL suites (registration/UID/payments; exam deadline + rate limiter) | all results as expected | `docs/verification/sql-suites.log` |
| Screen tests – all specs, 4 device sizes (mobile, iPhone, tablet, desktop) | **100 / 100** (+8 Turnstile tests skipped without a key) | `docs/verification/e2e-all.log` |
| Turnstile with Cloudflare's always-pass test key (desktop + mobile) | **4 / 4** | `docs/verification/e2e-turnstile.log` |
| Rollback to v1 → v1 tests | **17 / 17** | `docs/verification/rehearsal-1-after-rollback-v1-tests.log` |
| Backup → isolated restore | **33 / 33 tables identical** (2,168 rows) | `docs/verification/backup-restore-drill.md` |
| TypeScript build | clean | `npx tsc -b` |

Chatbot suggested-questions button: covered by `components.test.tsx` and by the e2e journey on desktop **and** mobile (open, choose, input filled, list closes).

## 7. Load (Supabase Free) – details in `loadtest/RESULTS.md`, raw JSON in `docs/verification/loadtest-raw/`
- **1,000 members active within one minute** (5 calls each incl. a write; 28 shared sessions; 306 registered accounts; ≤ 17–25 requests in flight at once): **5,000/5,000 OK, 0 × 429/500/502/503/504, p50 50 ms, p95 73 ms** (28 Nov; 27 Nov: p95 107 ms).
- **1,000 simultaneous requests** (all at the same instant): mostly succeed but take 24–58 s; 28 Nov: 92 of 6,000 failed (91 × 504).
- **2,000 members within one minute: not supported on Free** (72 % failed). We do not claim 2,000 simultaneous users.

## 8. Decisions recorded
- ₹151 registration fee mandatory for new registrations (`registration_payment_required = true`); existing production member grandfathered; Guru Dakshina separate and optional.
- UID rule and English-spelling handling as in §2; age-based own-phone/guardian-phone rule.
- Email confirmation and phone-OTP policy **unchanged** (evaluation in `SCALABILITY_AUDIT.md`/earlier report: keep email confirmation, onboard in batches; SMS OTP needs a paid provider).
- Budget: Supabase Free + Vercel Hobby; no paid services added.

## 9. What the owner must configure (none of it is done by me – no secrets pass through chat)
1. **Razorpay test keys** on staging – `docs/RAZORPAY_TEST_MODE.md` §2–3, then run checklist §5.
2. **Turnstile** widget + keys – `docs/TURNSTILE_SETUP.md` (site key in Vercel, secret only in Supabase; staging first).
3. **Backups:** GitHub secrets `SUPABASE_DB_URL`, `BACKUP_PASSPHRASE` (`BACKUP_AND_RECOVERY.md` §2). The workflow runs once it is on `main`.
4. **Vercel Preview env vars** → staging Supabase, if you want to test on a Vercel preview URL.
5. Existing items from v1: custom SMTP for Auth e-mails, Auth Site URL/redirects, admin e-mail in the allowlist (production currently has **no admin account**), SMS provider (optional), real textbook chapters.
6. **Approval** of the rollout plan in §5.

## 10. Remaining tasks and known limitations
| Item | Status |
|---|---|
| Live Razorpay test-mode checkout (registration + Guru Dakshina) | pending test keys |
| CAPTCHA switched on | pending Turnstile keys (code ready) |
| `pg_dump` backup + `pg_restore` drill | pending GitHub secrets (isolated logical drill passed) |
| Professor's original PDF | not in the project – `docs/REQUIREMENTS_CHECKLIST.md` compares against the owner's notes and directives |
| Video privacy | unlisted YouTube links can be shared by anyone who has them |
| Answer-sheet storage | 1 GB free quota: ~200 KB/page after compression; purge after ZIP download |
| Refunds | done manually in Razorpay; refund status is not synced automatically |
| Existing members whose name is in another script | none in production today; would need an English spelling set by an operator before an ID is assigned |
| Load | 2,000 members in one minute or 1,000 simultaneous requests need more than the Free plan |
| Starter curriculum | 12 placeholder chapters – replace with the real textbook |
| Production rollout | waiting for approval |
