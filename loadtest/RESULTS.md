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
