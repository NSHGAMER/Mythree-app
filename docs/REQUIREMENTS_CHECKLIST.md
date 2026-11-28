# Requirement-by-requirement checklist (28 Nov 2026)

**Sources compared.** No professor PDF exists in the project library or the repository (checked 28 Nov 2026).
The requirements below come from (a) the owner's handwritten requirement notes in the project library
(`Req-Mythree/Important docs to add*.jpeg`, `Important pages to add.jpeg`), (b) the build directive of 26 Nov 2026 and
(c) the professor-requirements directive of 27 Nov 2026 (as relayed by the owner). If the professor's PDF is shared,
this list will be re-checked against it line by line.

**Status:** ✅ Completed (implemented and tested; new items on staging) · 🟡 Partially completed (reason stated) · ❌ Not completed
**Where:** production still runs v1; everything marked "staging" is on branch `feature/professor-requirements` and awaits rollout approval.

## A. Handwritten notes – documents
| Requirement | Status | Evidence |
|---|---|---|
| PRO.md – what to build, target users, features | ✅ | `PRO.md` (§6 revision for the professor requirements) |
| architecture.md – app flow, folder/file structure, tech stack | ✅ | `architecture.md` (§6 new tables/functions) |
| rules.md – what to use / avoid, dependencies, error handling, AI boundaries | ✅ | `rules.md` |
| phases.md – project broken into phases | ✅ | `phases.md` (v1 phases + professor programme phases 0–7) |
| design.md – colour, theme, fonts, typography | ✅ | `design.md`, `src/index.css` tokens |
| memory.md – what is done, current file, updated regularly | ✅ | `memory.md` (updated 28 Nov 2026) |

## B. Handwritten notes – pages
| Requirement | Status | Evidence |
|---|---|---|
| Privacy Policy, Terms of Service, Cookie Preferences | ✅ | `src/pages/public/Legal.tsx`; e2e `tests/e2e/public.spec.ts` (76/76) |
| 404, 403, 500, Maintenance pages | ✅ | `src/pages/public/StatusPages.tsx`; e2e public suite |
| Skeleton loading structure | ✅ | `Skeleton` in `src/components/ui.tsx`, used on data pages |
| Login, Register | ✅ | `src/pages/auth/Login.tsx`, `Register.tsx`; e2e |
| Forgot / Reset password | ✅ | `ForgotPassword.tsx`, `ResetPassword.tsx` |
| Account settings | ✅ | `src/pages/member/AccountSettings.tsx` (DOB, guardian, exam preference, UID) |
| Light / Dark mode | ✅ | theme toggle; e2e "theme toggle switches to dark mode" on 4 devices |

## C. Registration & ₹151 payment
| Requirement | Status | Evidence |
|---|---|---|
| Full name, DOB, address, PIN, exam preference, email, contact | ✅ staging | `Register.tsx`, migration 0005; `src/lib/validation.test.ts` |
| Adults use own phone; minors use guardian phone; siblings may share; no global phone uniqueness | ✅ staging | `registration_suite.sql` (GUARDIAN_PHONE_REQUIRED, PHONE_REQUIRED, shared phone) |
| UID = 4 letters + last 4 digits, upper case, permanent, collision-safe | ✅ staging | `registration_suite.sql` (`ANAN5678`, `ANAN5678-2`, `PARE5678`) |
| English spelling for Kannada/Devanagari names drives the UID | ✅ staging | migration 0009; `registration_suite.sql` (ENGLISH_NAME_REQUIRED, `SUBR3210`); e2e "registration asks for an English spelling" |
| Mandatory ₹151 fee, server-verified | 🟡 | all logic tested (`registration_suite.sql`, `phases.test.ts`); **live Razorpay test checkout not yet run – needs test keys** (`docs/RAZORPAY_TEST_MODE.md`) |
| Never charge twice; idempotent; recovery after closed browser; status check | 🟡 | order re-use, idempotency key, one-paid index, duplicate → refund flag tested in SQL; end-to-end with Razorpay pending keys |
| Existing members not charged retroactively | ✅ staging | upgrade rehearsal: existing rows → `confirmed` + UID backfill (docs/verification) |
| Guru Dakshina separate and optional | ✅ | unchanged v1 flow; separate tables/functions; checklist G1–G3 |
| Pending members cannot learn | ✅ staging | gate triggers; DB tests + e2e "pending member is sent to the ₹151 page" |
| Admin registrations list, UID search, manual (cash) confirmation with audit | ✅ staging | `admin/Registrations.tsx`; `phases.test.ts` |

## D. Learning, challenges, gamification
| Requirement | Status | Evidence |
|---|---|---|
| Chapter-wise learning, tests, completion, retakes, history | ✅ | v1 + `integration.test.ts` (17) |
| Daily & weekly challenges, admin-managed sets | ✅ staging | `challenge_sets`; `phases.test.ts` |
| XP, streaks, badges, leaderboard | ✅ | `integration.test.ts`; snapshot leaderboard on staging |
| 180-day guidance, never locked | ✅ | `programme.test.ts`, dashboard |
| Real textbook content | ❌ | 12 starter chapters are placeholders – the organisation must enter the real chapters/questions in Admin → Chapters |

## E. Video lessons
| Requirement | Status | Evidence |
|---|---|---|
| Chronological lessons, admin upload/schedule | ✅ staging | `admin/Videos.tsx`, `video_lessons.publish_at`; `phases.test.ts` |
| Real watch tracking, anti-seek, resume, completion % | ✅ staging | `phases.test.ts` (seek = 0 s credited; real-time playback completes; XP once; resume) |
| Private hosting | 🟡 | uses **unlisted** YouTube (free); unlisted links can be shared by anyone who has them. Private hosting would need paid storage/bandwidth |

## F. Examination scheduling, online/offline, uploads
| Requirement | Status | Evidence |
|---|---|---|
| Readiness request preserved | ✅ | v1 flow + tests |
| Suggested date = registration month + 3 per monthly batch, admin override, countdown | ✅ staging | `exam_schedules`; `exam.test.ts`; `phases.test.ts` (`2027-02-01`) |
| Online: START → 3-hour server timer → PDF paper | ✅ staging | `phases.test.ts` (180-minute deadline, resume, paper only during session) |
| Multi-photo answer-sheet upload with progress, review, SUBMIT, network-safe | ✅ staging | `ExamRoom.tsx` (compression, retry, per-page progress); `phases.test.ts` (own folder only, file must exist, SUBMIT final) |
| Deadline enforced on the server | ✅ staging | `exam_deadline_suite.sql` (upload/submit refused after deadline + 15 min grace) |
| Offline exam preserved | ✅ | dispatch workflow unchanged; offline results by UID |
| Answer-sheet storage within 1 GB free quota | 🟡 | ~200 KB per compressed page + purge after ZIP download; heavy use needs monitoring |

## G. Manual evaluation & Excel results
| Requirement | Status | Evidence |
|---|---|---|
| Admin views sheets, enters marks/remarks/status, publishes | ✅ staging | `admin/Evaluation.tsx`; `phases.test.ts` |
| Excel template, preview, validation, unknown UIDs, no silent overwrite, audit | ✅ staging | `phases.test.ts` (dry run lists 7 issue types; published rows never changed; `result_imports` row) |
| Members see only published results | ✅ staging | `phases.test.ts` |

## H. Dashboards, chatbot, admin
| Requirement | Status | Evidence |
|---|---|---|
| Central member dashboard (UID, registration, videos %, exam date/countdown/result) | ✅ staging | `Dashboard.tsx`; `phases.test.ts`; e2e |
| Chatbot suggested-questions button (FAQ-sourced, fills input, no auto-send, keyboard, mobile) | ✅ | `components.test.tsx`; e2e on desktop and mobile |
| Admin reporting / CSV exports | ✅ | members CSV, registrations CSV, exam addresses CSV, Excel results |

## I. Reliability, security, operations (free tier)
| Requirement | Status | Evidence |
|---|---|---|
| Caching, de-duplication, backoff | ✅ | `src/lib/cache.ts` + tests |
| DB optimisation, contention-free rate limiter, jobs (pg_cron/pgmq), payment reconciliation | ✅ staging | `0008`; `exam_deadline_suite.sql` (rate limiter); load tests |
| CAPTCHA | 🟡 | Turnstile code added (off until a site key is set); keys and Supabase setting are owner steps – `docs/TURNSTILE_SETUP.md` |
| Enumeration protection | ✅ staging | anonymous phone check closed (`phases.test.ts`); password reset never reveals accounts |
| Email / phone OTP policy | 🟡 | evaluated, **unchanged** by decision; SMS OTP needs a paid provider; Auth emails need custom SMTP for volume |
| Backups | 🟡 | isolated restore drill passed (`docs/verification/backup-restore-drill.md`); nightly `pg_dump` workflow needs the owner's GitHub secrets |
| Rollback plan | ✅ | `supabase/rollback/`, rehearsal logs in `docs/verification/` |
| Load: 50/100/200/500/1,000 | ✅ | `loadtest/RESULTS.md` (2,000 members in one minute is **not** supported on Free) |
| Production rollout | ❌ | waiting for owner approval |
