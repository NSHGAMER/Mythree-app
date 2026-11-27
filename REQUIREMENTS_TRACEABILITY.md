# Requirements traceability

Status legend: ✅ implemented **and** tested · 🟡 implemented, test pending/partial · ⏳ in progress · ⬜ not started · ⚠ blocked on owner input
Source: owner directives of 26 Nov 2026 (build) and 27 Nov 2026 (professor requirements + free-tier hardening). The professor's original PDF has not been provided; requirements below come from the owner's directive.

_Last updated: 27 Nov 2026 – Phase 0_

## A. Registration & payments
| ID | Requirement | Existing (v1.0.0) | New implementation | DB changes | Tests | Status |
|---|---|---|---|---|---|---|
| R1 | Collect full name, DOB, address, PIN, exam preference, email, contact | name, age, address, PIN, email, phone | DOB replaces age (age derived), exam preference (online/offline) | `profiles.date_of_birth`, `exam_preference` | — | ⬜ |
| R2 | ≥18 uses own phone; <18 uses guardian phone; siblings may share; no global phone uniqueness | unique phone enforced | separate member/guardian phone, conditional validation | drop `profiles_phone_key`, add `guardian_name`, `guardian_phone` | — | ⬜ |
| R3 | Permanent UID = first 4 letters of name + last 4 digits of applicable phone, uppercase, collision-safe | — | `generate_member_uid()` with advisory lock, suffix `-2…`, pad short names with X | `profiles.member_uid unique` | — | ⬜ (policy awaiting confirmation) |
| R4 | Mandatory ₹151 registration fee, confirmed only after server verification | — (Guru Dakshina only) | registration order/verify/status edge functions, webhook routing, gated access | `registration_payments`, `profiles.registration_status` | — | ⬜ ⚠ needs Razorpay test keys |
| R5 | No duplicate payments / registrations; safe retries; recovery if browser closes; status check | Guru Dakshina idempotency | idempotency key, unique paid-per-member index, status-check endpoint, reconciliation job | partial unique index | — | ⬜ |
| R6 | Guru Dakshina stays optional, separate, admin-configurable ₹151 | ✅ | unchanged | — | unit (signature) | ✅ (live checkout untested – no keys) |

## B. Learning
| ID | Requirement | Existing | New | DB | Tests | Status |
|---|---|---|---|---|---|---|
| L1 | Chapter-wise learning, completion tracking | ✅ | gate by confirmed registration | — | 17 DB integration | ✅ |
| L2 | Chapter tests: Q&A, attempts, score, pass %, best score, XP, history | ✅ | — | — | integration + e2e | ✅ |
| L3 | Daily & weekly challenges | ✅ auto-generated | admin-managed sets: questions, availability window, scoring, rewards | `challenge_sets` | — | ⬜ |
| L4 | XP, streaks, badges, leaderboard | ✅ | leaderboard snapshot (Phase 5) | — | integration | ✅ |
| L5 | 180-day guidance, never locked, admin sees duration | ✅ | — | — | unit + integration | ✅ |
| L6 | Admin chapter/question CRUD, ordering, pass % | ✅ | — | — | e2e (admin journey) | ✅ |

## C. Video lessons
| ID | Requirement | Existing | New | DB | Tests | Status |
|---|---|---|---|---|---|---|
| V1 | Chronological lessons, admin configures/uploads, scheduled publication | — | video lessons admin + member list | `video_lessons` | — | ⬜ ⚠ hosting decision |
| V2 | Real watch tracking, resume, completion %, anti-seek | — | heartbeat RPC records watched seconds server-side, caps credit to wall-clock | `video_progress` | — | ⬜ |
| V3 | Access respects registration/payment | — | RLS + RPC checks | — | — | ⬜ |

## D. Examination
| ID | Requirement | Existing | New | DB | Tests | Status |
|---|---|---|---|---|---|---|
| E1 | Readiness button, request, admin notified, UID/name/chapters/%/date/days | ✅ (no UID yet) | add UID, % | — | integration | 🟡 |
| E2 | Online/offline preference | — | from registration, editable | `profiles.exam_preference` | — | ⬜ |
| E3 | Suggested date = registration month + 3, same for a month's cohort, admin override, countdown | — | exam cohorts per month | `exam_schedules` | — | ⬜ |
| E4 | Online exam: START → 3 h server-enforced timer → PDF paper → multi-image upload with progress/review → SUBMIT | — | exam session RPCs, private storage, client compression | `exam_sessions`, `exam_submission_pages`, storage bucket | — | ⬜ ⚠ storage decision |
| E5 | Offline exam: preserve physical flow; admin records details/results | ✅ dispatch flow | results entry for offline | `exam_results` | — | 🟡 |
| E6 | Admin evaluation: view sheets, marks, remarks, status, save, publish | — | evaluation UI | `exam_results` | — | ⬜ |
| E7 | Excel result import with template, preview, validation, audit, no silent overwrite | — | xlsx template/import | `result_imports` | — | ⬜ |
| E8 | Member result view (name, UID, date, type, marks, max, remarks, PASS/FAIL), private | — | results page | RLS | — | ⬜ |

## E. Dashboards, admin, chatbot
| ID | Requirement | Existing | New | DB | Tests | Status |
|---|---|---|---|---|---|---|
| D1 | Central member dashboard (registration, payment, UID, learning, video %, challenges, XP, rank, exam pref/date/countdown/readiness/submission/result, Guru Dakshina) | partial ✅ | add new sections | — | — | ⬜ |
| D2 | Admin: search/UID lookup, payment status, video progress, exam schedules, answer review, results, reports/exports, pagination, audit | partial ✅ | extend | — | — | ⬜ |
| C1 | Chatbot grounded in FAQs | ✅ | — | — | unit + integration | ✅ |
| C2 | Suggested-questions button (FAQ-sourced, fills input, no auto-send, keyboard/mobile) | — | new | — | — | ⬜ |
| C3 | FAQ matching + caching | server only | browser cache + local matching | — | — | ⬜ |

## F. Reliability, security, operations
| ID | Requirement | Existing | New | DB | Tests | Status |
|---|---|---|---|---|---|---|
| S1 | Frontend caching, de-dup, backoff, preserved inputs, pagination | — | Phase 5 | — | — | ⬜ |
| S2 | DB optimisation (dashboard, leaderboard, FAQ, admin overview, analytics, rate limiter) | — | Phase 5 | snapshots, stats, indexes | — | ⬜ |
| S3 | pg_cron / pgmq jobs (notifications, reconciliation, refresh, cleanup, chatbot logging) | — | Phase 5 | extensions + queues | — | ⬜ |
| S4 | CAPTCHA, trusted IP, enumeration protection, server-side validation | partial | Phase 5 | — | — | ⬜ |
| S5 | OTP policy evaluation (no silent change) | — | documented in IMPLEMENTATION_REPORT | — | — | ⏳ |
| B1 | Free backups via GitHub Actions, restore doc + drill, pause recovery, admin checklist | — | `db-backup.yml`, `BACKUP_AND_RECOVERY.md` | — | restore drill pending (needs secrets) | 🟡 |
| T1 | Regression + load 50/100/200/500/1,000 users | baseline done (v1) | Phase 6 | — | — | ⬜ |
