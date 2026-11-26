# Mythree – delivery report (26 Nov 2026)

## 1. Links
- **GitHub:** https://github.com/NSHGAMER/Mythree-app (branch `main`; every push auto-deploys)
- **Production:** https://mythree-five.vercel.app (Vercel project `nshgamers-projects/mythree`)
- **Database / backend:** Supabase project `mythree` (ref `yflxqluyvueftocfzqzm`, Mumbai, Free plan)

## 2. Feature implementation
| Area | Status |
|---|---|
| Animated logo splash → premium homepage, About, Programme, Contact form, Install guide | ✅ live |
| Privacy, Terms, Cookie preferences, 404 / 403 / 500 / Maintenance, skeleton loaders, light/dark/system theme | ✅ live |
| Two roles (Admin, Member) enforced in the database (RLS, column grants, `assert_admin`) | ✅ tested |
| Registration (name, mobile, email, age, full address, password) with duplicate-phone/email protection | ✅ live |
| Email verification, login, forgot/reset password, profile, account settings, account deletion | ✅ live – needs Auth URL + SMTP config (§6) |
| Mobile OTP verification (hashed codes, layered rate limits, MSG91/Twilio) | 🟡 deployed – needs SMS provider keys |
| Guru Dakshina (voluntary, ₹151 suggested & admin-configurable, Razorpay, server verification, webhook, history, receipts) | 🟡 deployed – needs Razorpay keys |
| Chapter path, chapter tests (MCQ/true-false/fill-in), server grading, pass-mark completion, retakes, history | ✅ tested |
| Daily & weekly challenges, XP, streaks (IST), 19 badges, 9 levels, weekly/all-time leaderboards | ✅ tested |
| 180-day programme tracking (start date, days elapsed, current/remaining, %), never locks | ✅ tested |
| Final exam readiness → saved request, days taken, address snapshot, admin notification (+ optional email), dispatch workflow | ✅ tested |
| Admin dashboard: analytics charts, member table (search/filter/sort/paginate/CSV), member profile, chapters/questions CRUD + ordering, exams & dispatch, contributions, FAQs, messages, notifications, settings, audit log | ✅ live |
| FAQ chatbot (approved answers only, contact fallback, unanswered-question log, admin-editable) | ✅ tested |
| PWA: manifest, logo icons (any/maskable/Apple), service worker (static only), install prompt, iOS Safari guide, offline banner & page, update prompt | ✅ tested |

## 3. Database architecture
See `architecture.md §3`. 21 tables, all with RLS. Business rules are `SECURITY DEFINER` functions (empty `search_path`); XP awards are idempotent through a unique `(user, reason, ref)` key. Migrations: `supabase/migrations/0001–0004`.

## 4. Environment variables
| Where | Name | Status |
|---|---|---|
| Vercel (all envs) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ set |
| Supabase → Edge Functions → Secrets | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | ⏳ needed |
| 〃 | `SMS_PROVIDER` + `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID` (or Twilio vars), `OTP_PEPPER` | ⏳ needed |
| 〃 | `ALLOWED_ORIGINS=https://mythree-five.vercel.app` | recommended |
| 〃 | `RESEND_API_KEY`, `ADMIN_NOTIFY_EMAILS`, `NOTIFY_FROM_EMAIL` | optional |
Full list with comments: `.env.example`.

## 5. Test results (all actually executed)
| Suite | Command | Result |
|---|---|---|
| Unit + component (frontend, XP, programme, validation, CSV, errors, payment-signature & webhook verification, OTP, route guards/roles, quiz, chatbot, PWA detection) | `npm test` | **64 / 64 passed** |
| Backend integration on the real database (RLS, roles, XP once, idempotent submits, chapter locking & completion, badges, challenges, final exam, admin dispatch, leaderboard privacy, chatbot) | `npx vitest run -c vitest.db.config.ts` | **17 / 17 passed** |
| Responsive & PWA (Pixel 7, iPhone 14, tablet, desktop) – against **live production** | `BASE_URL=https://mythree-five.vercel.app npx playwright test` | **76 / 76 passed** |
| Signed-in member & admin journeys (login → dashboard → test → result → leaderboard → Guru Dakshina → 403 on admin; admin analytics → members → profile → exams → chapters → FAQs) | `npx playwright test flows` (local preview + real DB) | **4 / 4 passed** |
| Security headers on production | `curl -I` | CSP, HSTS, X-Frame-Options DENY, nosniff present |

## 6. Load testing
See `loadtest/RESULTS.md`. Summary: on the **Free** Supabase tier, up to ~200 simultaneous requests are served with p95 < 1.5 s and no errors; 500–1,000 simultaneous requests succeed but take 8–16 s; **2,000 simultaneous requests caused timeouts**. Recommendation: Supabase Pro + Small compute before launch, then re-test.

## 7. PWA installation
- **Android (Chrome/Edge/Samsung):** open the site → tap *Install app* in the banner, or ⋮ → *Install app / Add to Home screen*.
- **iPhone/iPad:** open in **Safari** → Share → *Add to Home Screen* → Add. (The app shows these steps automatically on iOS.)
- Page: https://mythree-five.vercel.app/install

## 8. Known limitations
- 12 starter chapters (72 questions) are placeholders – replace with the real textbook content in Admin → Chapters.
- Logo source is 280 × 280 px; icons are upscaled. A ≥ 1024 px logo (PNG/SVG) would make icons sharper.
- Edge functions are deployed from inlined copies of `supabase/functions` (same logic); redeploy with the Supabase CLI when they change.
- `mythree.vercel.app` belongs to someone else; the production alias is `mythree-five.vercel.app` until a custom domain is added.
- 2,000 simultaneous users not demonstrated on the Free tier (§6).

## 9. Pending configuration (owner actions)
1. Supabase → Authentication → URL Configuration: Site URL `https://mythree-five.vercel.app`; Redirect URLs `https://mythree-five.vercel.app/**` and `http://localhost:5173/**`.
2. Supabase → Authentication → SMTP: connect a sender (Resend, Brevo, SES…). The built-in mailer only sends a handful of emails per hour.
3. Supabase → Authentication → Rate Limits: raise sign-in/sign-up limits if many members share one network.
4. Razorpay keys + webhook (`https://yflxqluyvueftocfzqzm.supabase.co/functions/v1/payments-webhook`, events `payment.captured`, `payment.failed`).
5. SMS provider (MSG91 DLT OTP template or Twilio) for mobile OTP; then enable "Prompt members to verify their mobile" in Admin → Settings.
6. Register your own account, then make it admin: `update public.profiles set role = 'admin' where email = '<your email>';` (or add the email to `admin_allowlist` before registering).
7. Fill contact details in Admin → Settings; replace the starter chapters.
8. Supabase Pro + compute upgrade before launch (paid – owner decision).
