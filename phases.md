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
| 11 | Security, performance & load testing | ⏳ | Unit/component tests done; DB integration tests, Playwright responsive/PWA checks and load tests run after the database is provisioned |
| 12 | GitHub push & Vercel production | ⏳ | |

## Configuration still required from the organisation
1. Supabase project approval (free tier) – then migrations are applied.
2. Custom SMTP for Supabase Auth emails (e.g. Resend/Brevo/Amazon SES) – the built-in mailer is for testing only.
3. Razorpay account → API keys (test, then live) + webhook secret.
4. SMS provider (MSG91 DLT template or Twilio) for mobile OTP.
5. Admin email(s) for the allowlist; organisation contact details (Admin → Settings).
6. Real textbook chapters & questions (starter chapters are placeholders).
7. Optional: custom domain.
