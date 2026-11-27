# Load-test results – 26 Nov 2026

**Target:** Supabase project `mythree` (ap-south-1, **Free plan – Nano compute**), called directly through PostgREST from one Windows client in India.
**Accounts:** 200 seeded test members (`loadtest+N@mythree.test`), removed after testing.
**Script:** `loadtest/run.mjs` (+ ad-hoc stepped runs). Raw JSON in `loadtest/results/` (git-ignored).

Nothing below is extrapolated – every number was measured.

## 1. Server-side cost of each call (measured inside Postgres)
| RPC | DB time |
|---|---|
| `my_dashboard` (heaviest read) | 124 ms |
| `leaderboard('all')` | 16 ms |
| `leaderboard('week')` | 4 ms |

## 2. Stepped concurrency (after the database had recovered)
| Scenario | Simultaneous requests | OK | p50 | p95 | Wall time |
|---|---|---|---|---|---|
| leaderboard | 25 | 25/25 | 540 ms | 698 ms | 0.7 s |
| leaderboard | 100 | 100/100 | 782 ms | 913 ms | 0.9 s |
| leaderboard | 200 | 200/200 | 1.2 s | 1.4 s | 1.4 s |
| my_dashboard | 50 | 50/50 | 227 ms | 272 ms | 0.4 s |
| my_dashboard | 100 | 100/100 | 676 ms | 816 ms | 1.0 s |
| my_dashboard | 200 | 200/200 | 628 ms | 919 ms | 1.0 s |
| my_dashboard | 500 | 500/500 | 12.8 s | 16.1 s | 16.2 s |
| my_dashboard | 1,000 | 1000/1000 | 8.0 s | 8.8 s | 9.0 s |

## 3. 2,000-request bursts (first run, cold)
| Scenario | Requests | OK | Errors | p50 | p95 |
|---|---|---|---|---|---|
| my_dashboard | 2,000 | 1,672 | 328 × 504 timeout | 27 s | 159 s |
| leaderboard | 2,000 | 594 | 1,406 × 504 timeout | 95 s | 178 s |
| submit_chapter_test (32 attempts × 10 duplicate submits) | 320 | 320 | 0 | 62 s | 62 s |
| faq_answer | 1,000 | 313 | 687 (timeouts + rate limit) | 192 s | 228 s |

After this burst the free instance stayed throttled for several minutes (a follow-up run at only 50–100 concurrent was 10–30× slower than normal), then recovered.

## 4. Protection behaviour (working as designed)
| Scenario | Result |
|---|---|
| 300 simultaneous logins from one IP | 1 OK, 299 × 429 `over_request_rate_limit` (Supabase Auth limit) |
| Sequential sign-ins from one IP | Auth limit reached after ~32 sign-ins per 5 minutes |
| 500 anonymous `check_phone_available` | 30 OK, 470 `RATE_LIMITED` (our 30/hour/IP limit) |
| Duplicate test submissions (10 per attempt) | 0 errors, XP awarded once (idempotent) |

## 5. Conclusions
- **Proven:** on the Free/Nano tier the API serves **up to ~200 simultaneous requests with p95 < 1.5 s and zero errors**; every scenario up to 1,000 simultaneous requests completed without errors but with 8–16 s latency.
- **Not proven:** 2,000 *simultaneous* requests. On Free/Nano they caused 504 timeouts and temporary throttling. We therefore do **not** claim 2,000 concurrent users on the current plan.
- Context: 2,000 registered members rarely means 2,000 requests in the same second. Even 20 % of members active in the same minute is ~400 requests/minute, well within the measured capacity.
- **Before launch (recommended):** upgrade Supabase to **Pro with at least Small compute** (more CPU, more API/database connections, no CPU throttling), raise Auth rate limits for shared networks (Authentication → Rate Limits), then re-run `node --env-file=.env.loadtest loadtest/run.mjs` and update this file.
- Not load-tested: real email/SMS delivery (would send thousands of messages and needs paid providers) and Razorpay (needs keys). Registration bursts were tested only through the rate-limited pre-check and the database trigger, not by creating thousands of real Auth users.

---

# Phase 6 – staging results (27 Nov 2026, branch `feature/professor-requirements`)

**Target:** free Supabase project `mythree-staging` (ap-south-1, Free plan / Nano) with migrations 0001–0008 applied – the same plan as production.
**Client:** one Windows machine in India. **Sessions:** 28 test members (the Auth limit of ~30 sign-ins per 5 minutes per IP), shared by the virtual users.
No real e-mails, SMS or payments were sent. Every number below was measured.

Two different things are measured:
- **Simultaneous requests** – N requests fired at exactly the same moment (worst case, rare in practice).
- **Users active in the same minute** – N members each opening the dashboard, video classes, a video heartbeat (write), the leaderboard and the exam page, with 1–4 s between clicks, arrivals spread over 60 s.

## 1. Simultaneous requests (each row = one burst)
| Call | 50 | 100 | 200 | 500 | 1,000 |
|---|---|---|---|---|---|
| `my_dashboard` p95 | 0.74 s | 0.57 s | 1.26 s | 2.27 s | 31.7 s |
| `leaderboard` (snapshot) p95 | 0.21 s | 0.29 s | 0.51 s | 1.76 s | 50.1 s |
| `my_videos` p95 | 0.22 s | 0.23 s | 0.52 s | 0.89 s | 41.0 s |
| `my_exam` p95 | 0.18 s | 0.27 s | 0.42 s | 1.01 s | 57.9 s |
| `my_registration` p95 | 0.14 s | 0.19 s | 0.29 s | 0.73 s | 30.1 s |
| `record_video_progress` (write) p95 | 0.27 s | 0.23 s | 0.32 s | 1.27 s | 24.3 s |
| Errors | 0 | 0 | 0 | 0 | 0 |

Compared with v1 (26 Nov): `my_dashboard` at 500 simultaneous requests went from p95 **16.1 s → 2.3 s**. At 1,000 simultaneous requests every call still succeeded but took 24–58 s; the free instance is CPU-bound at that point.

## 2. Members active in the same minute
| Members in 60 s | Calls | OK | p50 | p95 | p99 | Notes |
|---|---|---|---|---|---|---|
| 200 | 1,000 | 1,000 | 0.07 s | 0.25 s | 1.5 s | incl. video writes |
| 300 | 1,200 | 1,200 | 0.08 s | 0.15 s | 0.76 s | reads only |
| 500 | 2,500 | 2,500 | 0.08 s | 0.11 s | 0.16 s | incl. video writes |
| 750 | 3,000 | 3,000 | 0.07 s | 0.10 s | 0.13 s | reads only |
| **1,000** | **5,000** | **5,000** | **0.08 s** | **0.11 s** | **0.12 s** | incl. video writes |
| 2,000 | 10,000 | 2,844 | 131 s | 302 s | 302 s | **collapsed**: 3,066 × 504, 2,217 × 522, 1,873 client connection errors |

- A first 500/1,000-member run started right after the 1,000-simultaneous-request bursts and was much worse (500: p95 40 s, 2 timeouts; 1,000: 2,728 × 504). Repeated after a short pause, the same load ran cleanly (table above). **After an extreme burst the free instance needs a few minutes to recover.**
- The 2,000-member run reached ~1,800 requests in flight from one client machine; part of the failures (status 0) are client-side socket limits, but the 504/522 responses show the server was saturated too.

## 3. Conclusions (Free plan)
- **Proven:** 1,000 members active within the same minute, each doing five typical actions including a write: **0 errors, p95 0.11 s**. Up to 500 simultaneous requests: 0 errors, p95 ≤ 2.3 s.
- **Not proven / not supported on Free:** 2,000 members within one minute, or 1,000 simultaneous requests at good speed. We do **not** claim 2,000 simultaneous users.
- For 2,000 registered members this is comfortable in normal use (they rarely act in the same minute). Risky moments are coordinated events – e.g. *everyone* opening the online exam at 10:00 sharp. Mitigations already built: exam START is one small write per member, uploads go straight to Storage, and entry stays open for a window (admin can set `entry_closes_at` generously). For a large single-moment exam, stagger cohorts or temporarily upgrade compute for that day.
- Not load-tested: Razorpay checkout (no keys), real e-mail/SMS delivery, Storage upload throughput at scale (would consume the 1 GB free storage).
