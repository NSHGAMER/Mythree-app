# phases.md – Delivery plan & status

Legend: ✅ done · 🟡 done in code, waiting on external configuration · ⏳ in progress · ⬜ not started

| # | Phase | Status | Notes |
|---|---|---|---|
| 1 | Architecture, documentation, design foundation | ✅ | PRO.md, architecture.md, rules.md, design.md, tokens, schema + RLS + business functions |
| 2 | Splash screen & public website | ✅ | Animated logo splash, Home, About, Programme, Contact, Guru Dakshina info, Install, Privacy, Terms, Cookies, 404/403/500/Maintenance, light/dark |
| 3 | Authentication & registration | 🟡 | 3-step registration, login, email verification, forgot/reset, profile, settings, account deletion. Mobile OTP needs an SMS provider (MSG91/Twilio) |
| 4 | Admin & member dashboards | ✅ | Member dashboard; admin overview analytics, member monitoring table (search/filter/sort/paginate/CSV), member profile |
| 5 | Learning engine & chapter tests | ✅ | Path UI, chapter page, timed/untimed tests, server grading, completion criteria, retakes, review, admin chapter/question CRUD + reordering |
| 6 | Daily/weekly challenges & gamification | ✅ | Challenges per IST day / ISO week, XP events, streaks, 19 badges, 9 levels, leaderboards |
| 7 | Guru Dakshina & payments | 🟡 | Razorpay order/verify/webhook, receipts, history, admin list/export. Needs Razorpay keys + webhook secret |
| 8 | Chatbot & FAQ management | ✅ | FAQ-only answers with confidence threshold, contact fallback, unanswered-question log, admin CRUD |
| 9 | Final exam readiness & dispatch | ✅ | Eligibility, confirmation, address snapshot, days taken, admin notifications (+ optional email), dispatch workflow, address CSV |
| 10 | PWA & mobile optimisation | ✅ | Manifest, icons, SW (static only), install prompt, iOS guide, update prompt, offline banner/fallback, responsive layouts |
| 11 | Security, performance & load testing | ✅ | 64 unit/component, 17 DB integration, 76 responsive/PWA (live), 4 journey tests pass; load results in loadtest/RESULTS.md |
| 12 | GitHub push & Vercel production | ✅ | https://mythree-five.vercel.app – auto-deploys from main |

## Configuration still required from the organisation
1. Supabase Auth URL configuration (Site URL + redirect URLs) – see REPORT.md §9.
2. Custom SMTP for Supabase Auth emails (e.g. Resend/Brevo/Amazon SES) – the built-in mailer is for testing only.
3. Razorpay account → API keys (test, then live) + webhook secret.
4. SMS provider (MSG91 DLT template or Twilio) for mobile OTP.
5. Admin email(s) for the allowlist; organisation contact details (Admin → Settings).
6. Real textbook chapters & questions (starter chapters are placeholders).
7. Optional: custom domain.

## Professor-requirements programme (27–28 Nov 2026) – branch `feature/professor-requirements`, staging `mythree-staging`
| # | Phase | Status | Evidence |
|---|---|---|---|
| 0 | Audit, rollback tag `v1.0.0-baseline`, backup workflow, traceability | ✅ | SCALABILITY_AUDIT.md, BACKUP_AND_RECOVERY.md, REQUIREMENTS_TRACEABILITY.md |
| 1 | Registration, ₹151 fee, member IDs (incl. English spelling, migration 0009) | ✅ staging · 🟡 live checkout needs Razorpay test keys | tests/db/registration_suite.sql, tests/db/phases.test.ts |
| 2 | Video classes, admin-managed daily/weekly tests | ✅ staging | tests/db/phases.test.ts |
| 3 | Exam schedules, online/offline exam, uploads, evaluation, Excel import, results | ✅ staging | tests/db/phases.test.ts, tests/db/exam_deadline_suite.sql |
| 4 | Dashboard/admin additions, chatbot suggestions | ✅ staging | tests/e2e/phases.spec.ts |
| 5 | Free-tier performance: caching, snapshot leaderboard, rate limiter, cron/queue jobs | ✅ staging | loadtest/RESULTS.md |
| 6 | Staging verification, rollback rehearsal, backup drill, guides | ✅ | docs/verification/, IMPLEMENTATION_REPORT.md |
| 7 | Production rollout | ⬜ waiting for owner approval | IMPLEMENTATION_REPORT.md §Rollout |
