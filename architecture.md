# architecture.md

## 1. High-level architecture

```
 Browser / installed PWA (React 19 + Vite + Tailwind 4)
   │  static assets (CDN, immutable)         ┌──────────────────────────────┐
   ├────────────────────────────────────────▶│ Vercel (static hosting, CDN, │
   │                                         │ security headers, SPA rewrite)│
   │  HTTPS (JWT)                            └──────────────────────────────┘
   ├──▶ Supabase Auth  (email+password, email verification, password reset)
   ├──▶ Supabase PostgREST → PostgreSQL 17 (RLS)  ← all reads + RPC business logic
   └──▶ Supabase Edge Functions (Deno)  ← secrets live here
            ├─ payments-config / payments-create-order / payments-verify  ──▶ Razorpay API
            ├─ payments-webhook  ◀── Razorpay (server-to-server, HMAC)
            ├─ otp-send / otp-verify  ──▶ MSG91 or Twilio
            ├─ notify-admin  ──▶ Resend (optional email)
            └─ account-delete (service role)
```

**Why this shape**
- One database (PostgreSQL) – no extra stores. Supabase provides managed Postgres, connection pooling (Supavisor) behind PostgREST, Auth and Edge Functions in **one region (ap-south-1, Mumbai)** close to members.
- Business rules (grading, XP, streaks, badges, completion, exam eligibility, leaderboard) run **inside Postgres** as `SECURITY DEFINER` functions → atomic transactions, row locks, no client trust, and one round trip per action.
- Secrets (Razorpay, SMS, email) are only in Edge Function env – never in the browser or Git.
- Vercel serves a static SPA; no server compute is needed on Vercel, so there are no cold-start or connection-pool concerns there.
- Redis/queues were deliberately **not** added: rate limiting uses a Postgres table with atomic upserts, and the only async work (payment reconciliation) is handled by Razorpay webhooks with retries. Add Upstash/Queues only if measurements require it.

## 2. Folder structure
```
├─ index.html                 SPA shell (theme bootstrap script – hashed in CSP)
├─ vite.config.ts             React, Tailwind, PWA (manifest + Workbox), chunking
├─ vercel.json                build, SPA rewrite, CSP + security + cache headers
├─ public/                    icons, optimised images, offline.html, robots.txt
├─ brand/                     original logo & promotional artwork (sources)
├─ scripts/generate-icons.mjs builds all icons/images from /brand
├─ src/
│  ├─ main.tsx, App.tsx       providers, router, splash, maintenance gate
│  ├─ index.css               design tokens (light/dark), base & components
│  ├─ types.ts                shared types
│  ├─ lib/                    supabase client, api (RPC wrappers), validation (zod),
│  │                          programme & gamification maths, errors, format, csv, razorpay loader
│  ├─ context/                AuthContext (session/profile/role), AppContext (theme, settings, toasts, online)
│  ├─ hooks/                  useAsync, useDocumentTitle
│  ├─ components/             ui kit, Layouts (public/member/admin), Guards, Quiz, Chatbot,
│  │                          SplashScreen, Pwa (install/update/offline), CookieBanner, Brand, ErrorBoundary
│  └─ pages/
│     ├─ public/              Home, About, Programme, Contact, GuruDakshinaInfo, Legal, Install, StatusPages
│     ├─ auth/                Login, Register, ForgotPassword, ResetPassword, AuthCallback, VerifyPhone
│     ├─ member/              Dashboard, Learn, Chapter, Test, Challenges, ChallengePlay, Leaderboard,
│     │                       Achievements, History, Profile, AccountSettings, GuruDakshina, Receipt, FinalExam
│     └─ admin/               Overview, Members, MemberDetail, Exams, Chapters, ChapterEditor,
│                             Contributions, Faqs, Messages, Notifications, Settings
├─ supabase/
│  ├─ migrations/             0001 schema+RLS, 0002 functions, 0003 seed (settings, badges, FAQs, starter chapters)
│  ├─ functions/              Edge Functions + _shared (crypto, http, razorpay, sms)
│  └─ config.toml
├─ tests/e2e/                 Playwright responsive + PWA checks
└─ loadtest/                  load-test scripts and results
```

## 3. Data model (PostgreSQL)
| Table | Purpose | Client access |
|---|---|---|
| `profiles` | member details, role, XP, streaks, programme start | own row read; update only personal columns (column grants); admin all |
| `app_settings` | singleton: suggested amount, programme days, pass marks, challenge sizes, contacts, maintenance | read all; admin update (audited) |
| `chapters` | curriculum, pass mark (completion criterion), time limit, XP reward, published flag | members read published; admin CRUD |
| `questions` | prompt/options/type | **no member access** (served via RPC only) |
| `question_keys` | accepted answers + explanation | admin only |
| `chapter_progress` | status, best %, attempts, completion date | own read; writes via RPC |
| `test_attempts` | question set, answers, score, review, XP | own read; writes via RPC |
| `challenge_instances` | daily/weekly per user per period (unique) | own read; writes via RPC |
| `xp_events` | every XP grant, **unique (user, reason, ref)** = idempotent awards | own read |
| `badges`, `user_badges` | achievements | read; awards via RPC |
| `contributions` | Guru Dakshina orders/payments/receipts (kept on account deletion) | own read; writes by Edge Functions |
| `exam_requests` | readiness, days taken, address snapshot, dispatch workflow | own read; admin via RPC |
| `faqs`, `chatbot_queries` | knowledge base (tsvector + trigram), unanswered log | read published; admin CRUD |
| `admin_notifications`, `audit_log`, `contact_messages` | admin operations | admin |
| `rate_limits`, `otp_codes`, `admin_allowlist` | security internals | none / admin |

Key indexes: `profiles(xp desc) where member`, trigram on names/FAQ questions, GIN on FAQ search vector, `xp_events(created_at, user_id)`, partial indexes for open attempts, unread notifications, completed progress.

## 4. Key flows
- **Registration:** form (zod) → `check_phone_available` (rate-limited) → `auth.signUp` with metadata → trigger `handle_new_user` creates profile (role from `admin_allowlist`) → verification email → `/auth/callback`.
- **Chapter test:** `start_chapter_test` (checks unlock, reuses open attempt, random subset, no answers sent) → client keeps answers locally → `submit_chapter_test` (row lock, idempotent, grade, update progress, XP once, streak, badges) → review with explanations.
- **Challenges:** `get_challenge(kind)` creates one instance per IST day / ISO week from chapters up to the member's frontier → `submit_challenge` (expires with period, XP once per period).
- **Guru Dakshina:** `payments-create-order` (auth, rate-limit, idempotency key, amount validation, Razorpay order) → Checkout → `payments-verify` (HMAC + fetch payment + amount/order match + capture) → `mark_contribution_paid` (idempotent, receipt number) ; `payments-webhook` reconciles independently.
- **Final exam:** `request_final_exam` (eligibility, address required, unique active request, admin notification) → optional `notify-admin` email → admin `admin_update_exam_request`.

## 5. Scalability notes (2,000+ members)
- Reads are single RPCs (`my_dashboard`, `leaderboard`) – O(chapters) per member; leaderboard sorts ≤ a few thousand indexed rows.
- Writes lock only the member's own rows (`FOR UPDATE` on attempt / progress) – no global hot rows except `rate_limits` keys which are per user/IP.
- Supabase Auth has its own built-in rate limits (signup/email/token) that protect against bursts; email delivery requires a custom SMTP provider for production volume.
- Static assets are served by Vercel's CDN with immutable caching; the service worker precaches the shell for repeat visits.
- Upgrade path: Supabase compute add-on (more connections/CPU), read replicas, materialised leaderboard refreshed by `pg_cron` if members grow beyond ~50k.
