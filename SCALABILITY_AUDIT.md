# Mythree – Free-Tier Scalability & Reliability Audit

_Audit date: 27 Nov 2026 · Scope: full codebase (`src/`, `supabase/migrations/`, `supabase/functions/`, `vercel.json`) plus read-only queries against the live Supabase project (`pg_stat_statements`, `pg_settings`, `pg_available_extensions`, advisors). **Nothing was changed** – no code, schema, auth, deployment or data._

Constraint for every recommendation: **stay on Supabase Free and Vercel Hobby, no paid Redis or other paid services.**

---

## 0. Executive summary

| # | Finding | Severity |
|---|---|---|
| C1 | **Registration is capped by email delivery, not by the database.** Supabase's built-in mailer sends only a few emails per hour, and free SMTP tiers (e.g. Brevo ≈ 300/day, Resend ≈ 100/day) cannot verify 2,000 people in one day. Registrations beyond the email limit fail at `signUp`. | Critical |
| C2 | **Supabase Auth rate limits are per IP.** We measured ~32 sign-ins per 5 minutes from one IP. Indian mobile networks use carrier-grade NAT, and classes/temples share Wi-Fi, so many real members share an IP and will see "Request rate limit reached" at login. | Critical |
| C3 | **Short statement timeouts + Nano CPU turn bursts into 504s.** Live settings: `anon` role `statement_timeout = 3s`, `authenticated` = `8s`, `max_connections = 60`. Requests that queue longer than that are cancelled. The app has **no retry/backoff**, so a burst becomes user-visible errors. | Critical |
| C4 | **Our own rate limiter creates hot rows and trusts a spoofable header.** Anonymous limits key on the *first* `X-Forwarded-For` value, which a client can forge (limit bypass, phone-number enumeration, chatbot log flooding). All users behind one IP update the *same* row, so calls serialise: `check_phone_available` averaged **584 ms** (max 2.8 s) in the load test although the query itself is trivial. | High |
| C5 | **Free projects pause after ~7 days without traffic and have no downloadable backups.** A paused project means the app is down until someone un-pauses it; there is currently no backup of member data outside Supabase. | High |
| C6 | **Every navigation re-runs the heaviest RPC.** `my_dashboard` (4,554 calls, mean 59 ms, max 5.8 s) is called separately by Dashboard, Learn, Chapter, Challenges and Final Exam pages. A typical "open app → learn → chapter → test" journey costs 3 dashboard RPCs + 3 profile reads. | High |
| C7 | **Leaderboard and admin member table are computed live for every request.** Leaderboard (2,618 calls, max 2.6 s) ranks every member on each call; `admin_member_overview` runs five per-member lateral sub-queries plus `count(*) over ()` over all members on every page/filter/sort. | Medium (grows with members) |
| C8 | **Several tables grow without limit** (`rate_limits`, `chatbot_queries`, `otp_codes`, `admin_notifications`, `audit_log`) and nothing cleans them; anonymous chatbot calls write one row each. | Medium |
| C9 | **Payments rely on the webhook for recovery** and the webhook is not configured yet (no Razorpay keys). There is no sweep job for orders stuck in `created`. | Medium (when payments go live) |
| C10 | `pg_stat_statements` still contains the text of the test-account seed block (including the bcrypt hash of the deleted test password). Accounts are gone, but the stats should be reset. | Low |

**What already works well (keep):** all XP/score/completion logic is server-side and transactional; duplicate test submissions are idempotent (load test: 330 duplicate submits, XP awarded once); XP grants are idempotent by a unique key; payments are verified by signature *and* by Razorpay API before being marked paid; final-exam requests are unique per member; the service worker never caches API traffic.

**Capacity statement (evidence-based):** on the current Free/Nano project we have *measured* ~200 simultaneous requests at p95 < 1.5 s with zero errors, 500–1,000 simultaneous requests completing with 8–16 s latency, and a cold 2,000-request burst producing 504s. **This audit does not claim 2,000 simultaneous users are supported**; §7 describes how to measure each level after the changes.

---

## 1. Current architecture

```
Browser / installed PWA  ── static files ──►  Vercel CDN (Hobby)  (SPA, immutable assets, CSP/HSTS headers)
        │
        ├─ supabase-js ─► Supabase Auth (signUp, signIn, reset, refresh)            ── rate-limited per IP
        ├─ supabase-js ─► PostgREST ─► Postgres 17 (Nano)                          ── 60 connections, 3 s / 8 s timeouts
        │                     • direct table reads under RLS (profiles, settings, history…)
        │                     • SECURITY DEFINER RPCs for all business logic
        └─ functions.invoke ─► Edge Functions (Deno) ─► Razorpay / MSG91 / Twilio / Resend
                                   payments-config, payments-create-order, payments-verify,
                                   payments-webhook, otp-send, otp-verify, notify-admin, account-delete
```

- One database, no Redis, no queue, no cron jobs are currently scheduled.
- Extensions **available but not installed** on this project (free): `pg_cron 1.6.4`, `pg_net 0.20.4`, `pgmq 1.5.1` (Postgres-native queue). Installed: `pg_trgm`, `pgcrypto`, `pg_stat_statements`.
- Database size today: 13 MB (Free limit 500 MB).

---

## 2. Request-by-request analysis

Legend: **A** = Supabase Auth, **R** = PostgREST table read/write, **RPC** = Postgres function, **EF** = Edge Function. Measured means come from `pg_stat_statements` after the load tests (database time only, excludes network).

### 2.1 Every page load (app boot)
| Call | Type | Notes |
|---|---|---|
| `auth.getSession()` | local | Reads localStorage; network only when the access token must be refreshed. |
| `profiles.select('*').eq(id)` | R | `AuthContext.loadProfile` – once on boot. |
| `profiles.select('*')` again | R | `onAuthStateChange` fires `SIGNED_IN`/`INITIAL_SESSION` on boot in supabase-js v2 → **duplicate profile read**. |
| `app_settings.select('*')` | R | Public, changes rarely, **fetched on every full load** (133 calls, 1.6 ms). |

### 2.2 Registration (`/register`)
| Step | Call | Type | Notes |
|---|---|---|---|
| Step 1 "Continue" | `check_phone_available(phone)` | RPC (anon) | Rate limit 30/hour **per first XFF value** → hot row + spoofable. Measured mean **584 ms**, max 2.8 s. Enables phone-number enumeration. |
| Submit | `auth.signUp(email, password, metadata)` | A | Creates `auth.users`; trigger `handle_new_user` inserts `profiles` **in the same transaction**; then Auth sends the verification email. |
| Email link | `/auth/callback` → `getSession()` + `profiles.select('role')` | A + R | |

### 2.3 Login (`/login`)
| Call | Type | Notes |
|---|---|---|
| `auth.signInWithPassword` | A | Per-IP rate limited (measured ~32 / 5 min / IP). |
| `profiles.select('role')` | R | Login page reads role to redirect… |
| `profiles.select('*')` | R | …and AuthContext reads the full profile on `SIGNED_IN` → **2 profile reads per login**. |
| `auth.resend(signup)` | A | Only when email unconfirmed. |

### 2.4 Member dashboard and learning pages
| Page | Calls | Notes |
|---|---|---|
| Dashboard | `my_dashboard()` | RPC: 1 conditional `UPDATE profiles.last_seen_at` (write on a read path), chapters × progress join with a **correlated `count(*)` of questions per chapter**, a self-join `exists` for locks (O(chapters²)), `sum(xp_events)` for the week, `count(*)` of members with higher XP (rank), badges, eligibility (3 more counts), contributions sum. Mean 59 ms, **max 5.8 s** under load. |
| Learn | `my_dashboard()` | **Duplicate** – only needs chapter list + progress. |
| Chapter detail | `my_dashboard()` | **Excessive** – full dashboard to show one chapter. |
| Chapter test | `start_chapter_test(id)` | RPC: rate-limit upsert, unlock check, `ORDER BY random()` over the chapter's questions, inserts attempt, upserts progress, `touch_activity` UPDATE. Mean 180 ms. |
| Submit test | `submit_chapter_test(attempt, answers)` | RPC: `FOR UPDATE` on attempt, grading join, updates attempt twice, progress update, up to 2 `award_xp` (insert + profile UPDATE each), `touch_activity` (profile UPDATE), `award_badges` (5 aggregate counts over the member's history + insert). Mean 44 ms. Then client calls `profiles.select('*')` (`refreshProfile`). |
| Challenges | `my_dashboard()` + `challenge_instances.select(...).limit(30)` | Dashboard used only for 2 small fields. |
| Daily/weekly play | `get_challenge(kind)`, `submit_challenge(...)` + `refreshProfile` | Cheap (≈2 ms). |
| Leaderboard | `leaderboard(period)` | RPC ranks **all members** per call; weekly mode sums `xp_events` per member via LATERAL. Re-fetched on every tab switch. 2,618 calls, mean 46 ms, max 2.6 s. Result is identical for everyone except the "me" row → ideal for caching. |
| Achievements | `badges.select`, `user_badges.select` | 2 small reads; badge catalogue is static. |
| History | `test_attempts` (200), `xp_events` (200), `chapters` (all) | 3 reads; chapters list is static. |
| Final exam | `my_dashboard()`; on confirm `request_final_exam()` + EF `notify-admin` | Dashboard duplicate. |
| Guru Dakshina | EF `payments-config`, `contributions.select('*')`; pay: EF `payments-create-order` → Razorpay Checkout → EF `payments-verify` | `select('*')` returns all columns incl. order ids (own rows only – OK). |
| Receipt | `contributions.select('*').eq(id)` | |
| Profile/Settings | `profiles.update(...)`, `auth.updateUser`, EF `account-delete` | |
| Verify phone | EF `otp-send`, EF `otp-verify` | `otp-send` checks "SMS configured" before authentication (minor info leak). |

### 2.5 FAQ chatbot (public and member pages)
| Call | Type | Notes |
|---|---|---|
| `faq_answer(query)` per question | RPC (anon or member) | Tokenises, builds a word array of **all published FAQs on every call**, scores, **inserts a `chatbot_queries` row on every call** (also for anonymous visitors), rate-limit upsert on `faq:<uid or first XFF>`. Mean **253 ms**, max 7.5 s – the slowest member-facing RPC. The FAQ set is tiny (17) and public → the matching can run in the browser. |

### 2.6 Admin pages
| Page | Calls | Notes |
|---|---|---|
| Overview | `admin_analytics()` | ~20 aggregates, `chapter_stats` runs 4 correlated sub-queries **per chapter** over `test_attempts`; activity groups `xp_events` for 30 days. Mean 31 ms today; grows linearly with history. |
| Members | `admin_member_overview(search, filter, sort, page)` | Per member: 5 LATERAL sub-queries (completed count, **current chapter via NOT EXISTS per chapter**, test avg/count, exam request, contributions sum) + join to `auth.users`; `count(*) over ()` forces **the whole member set to be computed for every page**; search uses `ILIKE '%…%'` on name/email/phone/city (only name has a trigram index). Debounced 350 ms (good). Export pulls up to 5,000 rows through the same function. |
| Member detail | `admin_member_detail(id)` | Fine (single member). |
| Exams / Contributions | `admin_exam_requests`, `admin_contributions(2000)` | Unpaginated (2,000-row JSON for contributions). |
| Chapters / Editor | `chapters.select(… questions(count))`, `questions + question_keys`, CRUD, `admin_save_question`, `admin_reorder_chapters` | Fine. |
| FAQs | `faqs.select`, `chatbot_queries … limit 200`, CRUD | Fine. |
| Messages / Notifications / Settings | simple selects/updates | `Notifications` "mark all read" updates every unread row (fine at this scale). |

### 2.7 Request counts for common journeys (today)
| Journey | Requests | Of which heavy |
|---|---|---|
| Open app (logged in) → Dashboard | 3 (profile ×2, settings) + 1 RPC | 1 dashboard |
| Dashboard → Learn → Chapter → Start test → Submit | ≈ 9 | 3 dashboards |
| Login | 4–5 | — |
| Ask the chatbot 3 questions | 3 RPC + 3 inserts | 3 × faq_answer |

---

## 3. Expensive SQL, missing indexes, inefficient functions

### 3.1 Measured RPC cost (database time, after load tests)
| RPC | Calls | Mean | Max | Main cost driver |
|---|---|---|---|---|
| `my_dashboard` | 4,554 | 59 ms | 5,788 ms | correlated per-chapter question counts, rank count, write on read |
| `leaderboard` | 2,618 | 46 ms | 2,619 ms | full ranking per call |
| `faq_answer` | 755 | **253 ms** | 7,522 ms | rebuilds FAQ word arrays per call, hot rate-limit row, insert per call |
| `submit_chapter_test` | 698 | 44 ms | 2,258 ms | 4–6 writes + badge aggregates |
| `start_chapter_test` | 116 | 180 ms | 1,960 ms | hot rate-limit row, `random()` sort, writes |
| `check_phone_available` | 30 | **584 ms** | 2,787 ms | single hot rate-limit row per IP |
| `admin_member_overview` | 7 | 19 ms | 30 ms | small now; O(members × chapters) |
| `admin_analytics` | 3 | 31 ms | 69 ms | correlated per-chapter aggregates |

### 3.2 Inefficiencies
1. **`check_rate_limit` = single-row UPSERT per key.** Every caller sharing a key (one IP, one user firing parallel requests) waits on the same row lock. This, not the work itself, explains the slow anon RPCs.
2. **Writes inside read RPCs:** `my_dashboard` updates `last_seen_at`; `start_chapter_test` updates profile streak. On Nano every write costs WAL + lock.
3. **`award_badges` recomputes 5 aggregates over the member's whole history on every submission** (`test_attempts`, `challenge_instances`, `chapter_progress`). Fine for one member, but it grows with history and runs inside the user-facing transaction.
4. **`my_dashboard` correlated sub-query** `(select count(*) from questions where chapter_id = c.id and is_active)` per chapter on every call – the value only changes when an admin edits questions.
5. **Leaderboard weekly mode** sums `xp_events` per member through LATERAL for every member on every request.
6. **`admin_member_overview` "current chapter"** LATERAL with `NOT EXISTS` per chapter per member, and `count(*) over ()`.
7. **`faq_answer`** re-tokenises every FAQ question+keywords per call (`array_agg(distinct …)` over all FAQs).
8. **`admin_analytics.chapter_stats`** – 4 correlated aggregates per chapter.

### 3.3 Missing / unused indexes (advisor + manual review)
| Table | Proposed index | Why |
|---|---|---|
| `chatbot_queries` | `(user_id)`; `(matched_faq_id)` | FK without index (advisor) – slows member deletion (`ON DELETE SET NULL`). |
| `admin_notifications` | `(user_id)` | FK without index (advisor). |
| `contact_messages` | `(user_id)` | FK without index (advisor). |
| `user_badges` | `(badge_code)` | FK without index (advisor). |
| `profiles` | trigram on `email`, `phone`, `city` (or a combined `search` column) | Admin search uses `ILIKE '%x%'`; only `full_name` has trigram. |
| `test_attempts` | `(user_id) where submitted_at is not null and score = total` (or a `perfect` counter) | `award_badges` perfect count. |
| `challenge_instances` | `(user_id, kind) where submitted_at is not null` | badge/eligibility counts. |
| `rate_limits` | (replace table – see §5) | |
| `otp_codes` | `(expires_at)` for cleanup | |

Unused indexes reported by the advisor (`profiles_created_idx`, `faqs_search_idx`, `faqs_question_trgm`, `exam_requests_status_idx`, `audit_log_created_idx`…) are cheap at this size; keep for now and re-check after the changes (the FAQ ones become truly unused if matching moves to the browser).

Policy advisor: `badges`, `chapters`, `faqs` have two permissive SELECT policies (read + admin `ALL`). Each row evaluates both. Splitting the admin policy into INSERT/UPDATE/DELETE only removes this overhead.

---

## 4. Registration, network failures and idempotency

### 4.1 How registration works today
1. Client validates (zod) and calls `check_phone_available` (anon RPC).
2. `supabase.auth.signUp()` → Supabase Auth inserts `auth.users` → trigger `handle_new_user` inserts `public.profiles` (role `admin` if the email is in `admin_allowlist`) **in the same transaction** → Auth sends the confirmation email → returns.
3. Member clicks the link → email confirmed → logs in.

### 4.2 Many users registering at the same time
- **Database:** safe. Each signup is one short transaction; unique indexes on `profiles.phone` and `lower(email)` serialise only identical values. Two people racing for the *same phone* → the second `signUp` fails ("Database error saving new user", mapped to a friendly message) and **its Auth user is rolled back** (no orphan account).
- **Auth rate limits (per IP):** sign-ups/sign-ins are throttled per IP (measured ~30 per 5 min). Members on CGNAT mobile data or shared Wi-Fi will collide → HTTP 429 → registration fails and must be retried later.
- **Email sending (the real ceiling):** each signup sends one email. The built-in mailer allows only a handful per hour. With a free SMTP provider the daily quota is a few hundred. **2,000 registrations cannot all be verified on the same day on free email tiers** – this is a launch-planning issue, not a code bug (see §5.1).
- **Pre-check RPC:** all users on one IP share one `phone_check:<ip>` row → serialisation (584 ms mean) and a shared 30/hour quota → legitimate users on the same network get `RATE_LIMITED` at step 1.

### 4.3 Can registrations be lost during network interruptions?
| Moment of failure | Outcome today | Risk |
|---|---|---|
| Offline before submit | Error shown; form data stays in memory; **lost on page refresh** (not persisted locally). | UX only |
| Request reaches Auth, response lost | Account + profile **were** created; the user sees a network error and retries → Auth returns an "obfuscated" user with no identities → app says "already exists". The verification email was probably sent. The user can use "Resend verification email" on the login page. | Low integrity risk, confusing UX |
| Auth commits user but email sending fails (quota) | `signUp` returns an error; depending on Auth behaviour the unconfirmed user may remain. Retry says "already exists". Recovery = resend from login page once quota frees. **Needs verification on the live project** with custom SMTP before launch. | Medium (UX + support load) |
| Trigger fails (bad metadata, duplicate phone) | Whole signup rolled back – nothing half-created. | None |

No registration data is silently half-written: profile creation is atomic with the auth user. The weak points are the *messages* after ambiguous failures and the email quota.

### 4.4 Idempotency / duplicate protection matrix
| Operation | Protection today | Gap |
|---|---|---|
| Registration | Unique email (Auth), unique phone (DB), submit button disabled while busy, atomic trigger | No client idempotency key; ambiguous-failure UX (above) |
| Login | n/a | — |
| Chapter test submit | `FOR UPDATE` on attempt + `submitted_at` check → returns stored result; XP via unique `(user, reason, ref)` | **Verified by load test** (330 duplicates, XP once) |
| Start test | Re-uses an open attempt < 3 h old | Concurrent double-start can create two attempts (harmless: only one is submitted, XP keyed per chapter) |
| Daily/weekly challenge | Unique `(user, kind, period)`; submit idempotent | — |
| Final exam request | Partial unique index (one active per member); returns existing | — |
| Payments – create order | Unique `(user_id, idempotency_key)`; same key returns same order | Key is regenerated on every click after a failure → extra unpaid orders (harmless, but clutter) |
| Payments – mark paid | `FOR UPDATE`, status check, amount check, unique `razorpay_payment_id`; verify + webhook both safe | **No reconciliation sweep** if the browser closes before verify **and** the webhook is missing/failing |
| OTP | One active code per user, attempts counter, hashed | — |
| Contact form | Rate limit only | Double submit → duplicate message (minor) |
| Admin question save / reorder | Single-transaction RPCs | — |

---

## 5. Recommendations

### 5.1 Configuration (no code, no cost)
1. **Custom SMTP on a free tier + phased onboarding.** Pick the provider with the largest free daily quota available to you, set Auth "email sent" rate limit to match it, and invite members in **batches** (e.g. 250/day by district/class) instead of announcing to all 2,000 at once. Publish the batch schedule to members.
2. **Raise Auth rate limits** (Dashboard → Authentication → Rate Limits) for sign-in/sign-up/token refresh to values that tolerate shared IPs.
3. **Enable Auth CAPTCHA** with Cloudflare Turnstile (free) for sign-up, sign-in and password reset – protects the higher limits from bots.
4. **Confirm "Confirm email" is ON** (the admin allowlist grants role at insert time; email confirmation is what prevents someone else registering an allowlisted address).
5. Set `ALLOWED_ORIGINS` for Edge Functions; reset `pg_stat_statements` (C10).
6. **Backups:** a free GitHub Actions workflow running `pg_dump` nightly with the DB connection string as a repository secret, storing the encrypted dump as a private artifact (or in a Drive the organisation owns). Restore-test it once.
7. **Pausing:** keep real traffic or a light scheduled health check; document the "Restore project" procedure for the admin.

### 5.2 Reduce requests from the app (client-side, free)
| Change | Effect |
|---|---|
| One **session-level data cache** (stale-while-revalidate) for `my_dashboard`, shared by Dashboard/Learn/Chapter/Challenges/Final Exam, invalidated after submissions | Journey "dashboard → learn → chapter → test" drops from 3 dashboard RPCs to 1 |
| Remove the duplicate profile read at boot/login; update XP/streak in memory from the submit response instead of `refreshProfile()` | −2 reads per login, −1 per submission |
| Cache `app_settings`, `badges`, published `chapters` metadata and **published FAQs** in `localStorage` with a version stamp (`updated_at`) and revalidate at most every 15–60 min | Removes the most frequent tiny reads |
| **Run FAQ matching in the browser** against the cached FAQ list; send only unanswered questions (batched) to the server | Removes the slowest member-facing RPC (253 ms) and the per-question insert |
| **Retry with exponential backoff + jitter** for 429/503/504 on idempotent calls (dashboard, leaderboard, submit – already idempotent) and a visible "Saving… retrying" state | Converts transient overload into delays instead of errors |
| Single-flight / de-duplication of identical in-flight requests (e.g. StrictMode, double clicks) | |
| Paginate admin contributions and exam requests | |

### 5.3 Database hot paths
| Change | Effect |
|---|---|
| **Rate limiter redesign:** append-only `rate_limit_hits(key, at)` with "count in window" (no row lock), or per-minute bucket keys (`key:yyyymmddhhmi`) so concurrent callers don't contend; use the **trusted client IP** (last proxy-appended hop / provider header) instead of the first `X-Forwarded-For` value; prefer per-user keys whenever authenticated | Removes hot-row serialisation and spoofing |
| **Leaderboard snapshot table** refreshed every 5 min by `pg_cron` (all-time + weekly top 100 and every member's rank) | Leaderboard becomes a primary-key read |
| **`member_stats` table** (completed chapters, current chapter, avg score, tests taken, last active, contribution total) maintained inside the existing RPCs | `admin_member_overview` and `my_dashboard` rank stop scanning histories |
| Store `question_count` on `chapters` (maintained by question triggers) | Removes the correlated count from `my_dashboard` |
| Move `last_seen_at` write out of `my_dashboard` (update on login/submit only, or throttle to once per day) | Read path becomes read-only |
| `award_badges`: use counters from `member_stats`; evaluate only badges whose criterion changed | Smaller submit transactions |
| Indexes in §3.3; split admin `ALL` policies | |

### 5.4 PostgreSQL-backed queue (no Redis)
`pgmq` (Supabase Queues) and `pg_cron` are available on this Free project. Drain with a `pg_cron` job every minute (SQL work) or a `pg_cron` + `pg_net` call to an Edge Function (HTTP work), using visibility timeouts/`SKIP LOCKED` so a job is processed once.

| Candidate background job | Today | Why queue it |
|---|---|---|
| Admin email on final-exam request (`notify-admin`) | Fire-and-forget from the browser | Survives closed tabs; retries on provider errors |
| **Payment reconciliation** – orders `created` > 30 min → ask Razorpay → mark paid/failed | Not implemented | Closes the gap when browser and webhook both miss |
| Leaderboard snapshot refresh | Live query | Periodic |
| Analytics pre-aggregation (`daily_stats`) | Live aggregates | Admin overview becomes cheap |
| Badge evaluation for slow criteria (streak/xp milestones) | Inside submit | Shorter user transaction |
| Chatbot "unanswered question" logging | Insert per call | Batch insert |
| Cleanup: `rate_limits`/hits, expired `otp_codes`, old `chatbot_queries`, read notifications | None | Keeps tables small |
| Future: streak reminders, batch onboarding emails | — | Spread email sending within quota |

### 5.5 Security and abuse protection
| Risk | Current state | Recommendation |
|---|---|---|
| Spoofable IP in rate limits | first `X-Forwarded-For` value (SQL `client_ip()` and Edge `clientIp()`) | use trusted hop; add CAPTCHA |
| Phone-number enumeration | `check_phone_available` returns true/false to anon | require CAPTCHA, tighter limit, or move the check into the signup error path only |
| Anonymous writes | `faq_answer` (log insert), `submit_contact_message` | CAPTCHA on contact form; batch/limit chatbot logging; retention |
| Bot sign-ups | No CAPTCHA | Turnstile via Supabase Auth captcha |
| Rate-limit fail-open | Edge `rateLimit()` returns true on DB error | fail closed for OTP send and order creation |
| OTP endpoint order | checks SMS config before auth | authenticate first |
| CORS | `*` (ALLOWED_ORIGINS unset) | set origin list |
| Admin exports | CSV of member PII not audited | log exports in `audit_log` |
| Allowlist admin at sign-up | relies on email confirmation | keep "Confirm email" ON; consider promoting only after confirmation |
| Statement stats contain test seed text | yes | `pg_stat_statements_reset()` |
| Vercel Hobby terms | Hobby is for non-commercial use | Confirm the organisation's use qualifies (donations via Guru Dakshina) |

---

## 6. Proposed free-tier architecture

```
                       ┌──────────────────────── Vercel CDN (Hobby, free) ───────────────────────┐
 Browser / PWA ───────►│ SPA + static assets  (already)                                           │
   │  local cache:     └───────────────────────────────────────────────────────────────────────────┘
   │  settings, chapters, badges, FAQs (versioned, 15–60 min)  · in-session dashboard cache · retry/backoff
   │
   ├─ Supabase Auth  (custom free SMTP, raised limits, Turnstile CAPTCHA, batched onboarding)
   │
   ├─ PostgREST RPCs (Nano)
   │     READ  : my_dashboard (lean, read-only) · leaderboard_snapshot (PK read) · member_stats (admin)
   │     WRITE : start/submit test, challenges, final exam  (short transactions, idempotent, unchanged contract)
   │             └─ enqueue side-effects → pgmq
   │
   ├─ pg_cron (every 1–5 min)
   │     ├─ refresh leaderboard_snapshot, daily_stats
   │     ├─ drain pgmq: badge milestones, chatbot log batches, cleanup
   │     └─ pg_net → Edge Functions: notify-admin emails, payment reconciliation
   │
   └─ Edge Functions (payments, OTP, email)  · trusted-IP rate limits · fail-closed on abuse paths

 Off-platform (free): GitHub Actions nightly pg_dump backup + weekly restore test
```

Principles: keep the hot read path to **one cheap RPC per screen**, keep user-facing write transactions **short and idempotent**, push everything else to **queued/batched** work, and make the client **retry politely** instead of failing.

---

## 7. Database changes that may be required (proposal only – not applied)

| # | Change | Type |
|---|---|---|
| D1 | `create extension pg_cron; create extension pgmq; create extension pg_net;` | Extensions |
| D2 | `rate_limit_hits (key text, at timestamptz)` + index `(key, at)` and new `check_rate_limit` (count-in-window) **or** bucketed keys; trusted-IP helper | Table + function |
| D3 | `leaderboard_snapshot (period, user_id, rank, score, name, streak, refreshed_at)` + PK `(period, user_id)` + index `(period, rank)`; refresh function; `leaderboard()` reads snapshot | Table + function + cron |
| D4 | `member_stats (user_id pk, completed_chapters, current_chapter_id, tests_taken, avg_score, perfect_tests, daily_done, weekly_passed, last_active_at, contribution_paise)` maintained by existing RPCs | Table + function changes |
| D5 | `chapters.question_count` + trigger on `questions` | Column + trigger |
| D6 | `my_dashboard` without writes; `last_seen_at` throttled elsewhere | Function |
| D7 | `daily_stats` + `admin_analytics` reads pre-aggregates | Table + function |
| D8 | Queues: `notifications`, `reconcile_payments`, `badges`, `maintenance` (pgmq) + cron drainers | Queue |
| D9 | `reconcile_payments()` (via Edge Function) | Function + cron |
| D10 | Retention/cleanup functions + cron (`rate_limit_hits` > 1 day, `otp_codes` expired > 1 day, `chatbot_queries` > 90 days, read notifications > 180 days) | Functions + cron |
| D11 | Indexes from §3.3; split admin `ALL` policies into write-only policies | Index/policy |
| D12 | Optional: `registration_requests` staging table only if batched/invite-based onboarding is adopted | Table |

All changes are additive and can be shipped as new migrations (0005+) with RPC signatures kept stable so the app keeps working during rollout.

---

## 8. Phased implementation plan

| Phase | Scope | Risk | Rough effort |
|---|---|---|---|
| **P0 – Configuration & safety** | Custom SMTP (free) + batched onboarding plan, raise Auth limits, Turnstile CAPTCHA, confirm email ON, ALLOWED_ORIGINS, reset statement stats, GitHub Actions backups + restore test | Low | 0.5–1 day |
| **P1 – Fewer requests (frontend)** | Shared dashboard cache, dedupe profile reads, cached settings/chapters/badges/FAQs, in-browser FAQ matching, retry/backoff + single-flight, admin pagination | Low (no schema change) | 2–3 days |
| **P2 – Hot paths (database)** | D2 rate limiter + trusted IP, D5, D6, D11, leaderboard snapshot (D3 + pg_cron) | Medium | 2–3 days |
| **P3 – Stats & queue** | D4 member_stats, D7 daily_stats, D8 pgmq queues, D9 payment reconciliation, D10 cleanup | Medium | 3–4 days |
| **P4 – Measure** | §9 test plan at 50/100/200/500/1,000, integrity checks, update `loadtest/RESULTS.md`, decide onboarding batch size from results | — | 1 day |

Each phase ends with the existing test suites (64 unit, 17 DB integration, 76 responsive/PWA, 4 journeys) plus the §9 load step it targets.

---

## 9. Testing plan – 50, 100, 200, 500 and 1,000 concurrent users

**Definitions (to avoid over-claiming):**
- *Concurrent users* = signed-in members actively using the app, each doing a realistic sequence with think time (3–10 s between actions).
- *Simultaneous requests* = requests in flight at the same instant (what our earlier burst test measured). 1,000 concurrent users with think time ≈ 100–300 simultaneous requests.

**Setup**
- Seed N test accounts (`loadtest/seed.sql`) on the Free project during a quiet window; delete afterwards (`loadtest/cleanup.sql`).
- Obtain sessions slowly (respecting Auth limits) and reuse refresh tokens; run the load generator from **2–3 machines/networks** so client-side limits and single-IP Auth limits don't distort results.
- Traffic mix per virtual user: 40 % dashboard, 15 % learn/chapter view, 10 % start+submit chapter test, 10 % daily/weekly challenge, 10 % leaderboard, 10 % FAQ, 5 % profile/history. Admin: 2 virtual admins browsing the member table and exporting CSV.
- Ramp 60 s → hold 5 min → ramp down; repeat each level twice; 10-minute cool-down between levels (Free CPU recovers).
- Monitor during each run: `pg_stat_statements` deltas, `pg_stat_activity` (connections, lock waits), Supabase report CPU/RAM, Edge Function logs, HTTP status mix.

**Pass criteria (proposed targets)**
| Level | p95 read (dashboard/leaderboard) | p95 write (submit) | Error budget (after client retries) | Notes |
|---|---|---|---|---|
| 50 | < 800 ms | < 1 s | 0 % | baseline |
| 100 | < 1 s | < 1.5 s | 0 % | |
| 200 | < 1.5 s | < 2 s | < 0.1 % | measured today: 200 simultaneous OK |
| 500 | < 3 s | < 4 s | < 0.5 %, 429s retried successfully | target after P1–P3 |
| 1,000 | < 6 s | < 8 s | < 2 %, **no 5xx on writes after retry, no data loss**, recovery < 2 min | stretch – may still need staggered usage |

**Integrity checks after every run (must be 0 mismatches)**
```sql
-- XP total equals the sum of XP events
select count(*) from profiles p where p.xp <> coalesce((select sum(amount) from xp_events e where e.user_id = p.id), 0);
-- no XP reward granted twice for the same reason/reference (idempotency)
select count(*) from (select user_id, reason, ref_id, count(*) from xp_events group by 1,2,3 having count(*) > 1) d;
-- chapter completion matches best score vs pass mark
select count(*) from chapter_progress cp join chapters c on c.id = cp.chapter_id
 where (cp.status = 'completed') <> (cp.best_percentage >= c.pass_percentage);
-- one active exam request per member
select count(*) from (select user_id from exam_requests where status <> 'cancelled' group by 1 having count(*) > 1) d;
```

**Specific scenarios**
- **Registration burst (safe version):** call the pre-check and a *staging* signup path against the Free project with `@mythree.test` addresses **only when email sending is disabled for test domains**; never send real emails in load tests. Measure 429 behaviour from one IP vs multiple IPs.
- **Login burst from one IP vs many IPs** (documents the CGNAT risk with real numbers after limits are raised).
- **Duplicate submit storm:** 10 parallel submits per attempt → exactly one XP award (re-run of the existing test).
- **Leaderboard storm** before/after snapshot.
- **Network-drop simulation:** kill connections mid-submit (Playwright offline toggle) → retry → single result, correct XP.
- **Payment (test mode, when keys exist):** verify + webhook racing for the same payment → one `paid` row, one receipt number.

Results go into `loadtest/RESULTS.md` with raw JSON kept out of git. Any capacity statement to members/admins should quote the highest level that met its criteria – nothing beyond it.
