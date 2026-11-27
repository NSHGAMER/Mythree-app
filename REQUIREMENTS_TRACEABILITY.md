# Requirements traceability

Status legend: ✅ implemented **and** tested on staging · 🟡 implemented, test partial (reason given) · ⬜ not started · ⚠ blocked on owner input
Source: owner directives of 26 Nov 2026 (build) and 27 Nov 2026 (professor requirements + free-tier hardening). The professor's original PDF has not been provided; requirements below come from the owner's directive.
Nothing here is in production yet: all changes are on branch `feature/professor-requirements` and the free `mythree-staging` Supabase project.

_Last updated: 27 Nov 2026 – Phase 6 (staging tests)_

Test references: **DB** = `tests/db/*.test.ts` (46 client-side tests on staging) · **SQL** = `tests/db/registration_suite.sql`, `tests/db/exam_deadline_suite.sql` · **E2E** = `tests/e2e/flows.spec.ts` + `tests/e2e/phases.spec.ts` (desktop + mobile, staging) · **Unit** = `src/**/*.test.ts(x)` (99).

## A. Registration & payments
| ID | Requirement | Implementation | DB changes | Tests | Status |
|---|---|---|---|---|---|
| R1 | Collect full name, DOB, address, PIN, exam preference, email, contact | 3-step registration form; DOB replaces age (age derived) | `profiles.date_of_birth`, `exam_preference`, `guardian_*` | Unit (validation), SQL (sign-up trigger), E2E | ✅ |
| R2 | ≥18 own phone; <18 guardian phone; siblings may share; no global uniqueness | conditional validation in app and sign-up trigger | dropped `profiles_phone_key` | Unit, SQL (`GUARDIAN_PHONE_REQUIRED`, `PHONE_REQUIRED`, shared phone accepted) | ✅ |
| R3 | Permanent UID = 4 letters + last 4 digits, uppercase, collision-safe | `assign_member_uid()` advisory lock, suffix `-2…`, X padding | `profiles.member_uid` unique | Unit, SQL (siblings → `ANAN5678`, `ANAN5678-2`), DB, E2E | ✅ ⚠ owner to confirm policy for non-Latin names (`XXXX…`) |
| R4 | Mandatory ₹151 fee, confirmed only after server verification | registration-order / verify / status functions, webhook routing, access gate | `registration_payments`, `registration_status` | SQL (amount mismatch, paid → UID + receipt), DB (gate, status function), E2E (payment page) | 🟡 live Razorpay checkout untested – needs test keys |
| R5 | No duplicate payments/registrations; retries; recovery; status check | one open order re-used, idempotency key, one-paid index, duplicate → refund flag, status check, reconciliation job | partial unique index | SQL (replay idempotent, second order → `DUPLICATE_PAYMENT_REFUND_REQUIRED`, second paid row rejected) | 🟡 Razorpay API paths need test keys |
| R6 | Guru Dakshina optional, separate | unchanged | — | Unit, DB | ✅ (live checkout untested – no keys) |

## B. Learning
| ID | Requirement | Implementation | DB | Tests | Status |
|---|---|---|---|---|---|
| L1 | Chapter-wise learning, completion tracking, gated by confirmed registration | gate trigger on attempts/challenges/exam requests | trigger | DB, SQL (`REGISTRATION_PENDING`), E2E | ✅ |
| L2 | Chapter tests: attempts, score, pass %, best score, XP, history | v1 | — | DB, E2E | ✅ |
| L3 | Admin-managed daily & weekly challenges | `challenge_sets` + admin page; auto challenges as fallback | `challenge_sets` | DB (set replaces automatic questions, members cannot create), E2E (admin page) | ✅ |
| L4 | XP, streaks, badges, leaderboard | leaderboard snapshot refreshed every 5 min | `leaderboard_snapshot` | DB, load test | ✅ |
| L5 | 180-day guidance, never locked | v1 | — | Unit, DB | ✅ |
| L6 | Admin chapter/question CRUD | v1 | — | E2E | ✅ |

## C. Video lessons
| ID | Requirement | Implementation | DB | Tests | Status |
|---|---|---|---|---|---|
| V1 | Chronological lessons, admin configures, scheduled publication | admin Video lessons page, `publish_at` | `video_lessons` | DB (future lesson hidden), E2E | ✅ ⚠ hosting: unlisted YouTube assumed |
| V2 | Real watch tracking, resume, completion %, anti-seek | 10-s buckets credited only at real-time speed | `video_progress` | Unit, DB (seek to end = 0 s; real-time playback completes, XP once, resume position) | ✅ |
| V3 | Access respects registration | RPC checks | — | DB (pending member blocked) | ✅ |

## D. Examination
| ID | Requirement | Implementation | DB | Tests | Status |
|---|---|---|---|---|---|
| E1 | Readiness request, admin notified | v1 + UID | — | DB | ✅ |
| E2 | Online/offline preference | from registration, editable in settings | `exam_preference` | DB (offline member cannot start online exam), E2E | ✅ |
| E3 | Suggested date = registration month + 3 per cohort, admin override, countdown | `exam_schedules`, per-member override | `exam_schedules` | Unit, DB (`2027-02-01` for Nov cohort), E2E | ✅ |
| E4 | START → 3 h server timer → PDF → multi-image upload → SUBMIT | exam sessions, private buckets, storage policies | `exam_sessions`, `exam_submission_pages` | DB (3 h deadline, resume, paper access only during session, own-folder uploads, file must exist, submit final + idempotent), SQL (uploads/submit refused after deadline + grace) | ✅ ⚠ storage plan (compression + purge) to confirm |
| E5 | Offline exam flow preserved; admin records results | v1 dispatch + results by UID | `exam_results` | DB | ✅ |
| E6 | Admin evaluation: view sheets, marks, remarks, publish | Evaluation page | `exam_results` | DB (admin sees submission + signed image URL; publish) , E2E (page) | ✅ |
| E7 | Excel import: template, preview, validation, audit, no silent overwrite | dry-run preview, issues list, `result_imports` | `result_imports` | DB (unknown UID, duplicate, bad marks/date/result, published not changed, audit row) | ✅ |
| E8 | Member result view, private until published | `my_exam().results` | RLS | DB (hidden until published) | ✅ |

## E. Dashboards, admin, chatbot
| ID | Requirement | Implementation | Tests | Status |
|---|---|---|---|---|
| D1 | Central member dashboard | UID, registration, video %, exam date/countdown/result added | DB, E2E | ✅ |
| D2 | Admin search/UID lookup, payment status, schedules, evaluation, exports | Registrations, Videos, Daily & weekly tests, Exam schedules, Evaluation pages | DB, E2E | ✅ |
| C1 | Chatbot grounded in FAQs | v1 | Unit, DB | ✅ |
| C2 | Suggested-questions button | FAQ-sourced, fills input without sending, keyboard/Escape/outside click | Unit, E2E (desktop + mobile) | ✅ |
| C3 | FAQ matching + caching | cached FAQs + local matching | Unit | ✅ |

## F. Reliability, security, operations
| ID | Requirement | Implementation | Tests | Status |
|---|---|---|---|---|
| S1 | Frontend caching, de-dup, backoff | `lib/cache.ts` | Unit | ✅ |
| S2 | DB optimisation | read-only dashboard, snapshot leaderboard, indexes, append-only rate limiter | DB, load test | ✅ |
| S3 | pg_cron / pgmq jobs | 4 jobs scheduled on staging; endpoints require the Vault secret | DB (403 without secret) | 🟡 e-mail digest untested (no Resend key) |
| S4 | CAPTCHA, trusted IP, enumeration, validation | trusted IP, anonymous phone probing closed, server-side validation | DB | 🟡 CAPTCHA (free Cloudflare Turnstile) not added – needs a site key from the owner |
| S5 | OTP policy evaluation (no silent change) | documented in IMPLEMENTATION_REPORT; nothing changed | — | ⚠ owner decision |
| B1 | Free backups, restore doc + drill | `db-backup.yml`, `BACKUP_AND_RECOVERY.md` | — | 🟡 restore drill needs the owner's repository secrets |
| T1 | Regression + load 50/100/200/500/1,000 | v1 regression 17/17 on new schema; load results in `loadtest/RESULTS.md` (Phase 6) | DB, E2E, load | ✅ 1,000 members/minute: 0 errors, p95 0.11 s · 2,000 members/minute not supported on Free |
