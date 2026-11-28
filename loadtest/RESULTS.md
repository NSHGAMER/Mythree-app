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
# Phase 6 – staging results (27–28 Nov 2026, branch `feature/professor-requirements`)

## Methodology
| Item | Value |
|---|---|
| Target | free Supabase project `mythree-staging` (ap-south-1, **Free plan, Nano compute** – the same plan as production), migrations 0001–0009 |
| What is called | the real PostgREST RPCs the app calls (`my_dashboard`, `leaderboard`, `my_videos`, `my_exam`, `my_registration`, `record_video_progress` = a write) |
| Client | one Windows PC in India, Node 24 `fetch`, script `loadtest/run.mjs` |
| Registered accounts | 306 on staging (300 confirmed test members `loadtest+N@mythree.test`, 5 pending, 1 admin) |
| Signed-in sessions used | **28** (Supabase Auth allows ~30 sign-ins per 5 min per IP). Virtual users share these 28 tokens, so the server sees the same work as distinct members except that writes hit only 28 progress rows (harder than reality) |
| Not exercised | Auth sign-in bursts, Razorpay, e-mail/SMS, Storage uploads (would consume the 1 GB free quota) |
| Raw results | `docs/verification/loadtest-raw/*.json` (one file per run, every request's status counted, p50/p95/p99/max) |

Two different measurements – **they are not the same thing**:
- **"N members active within one minute"**: N virtual members arrive at random moments over 60 s; each opens the dashboard, video classes,
  sends a video heartbeat (write), opens the leaderboard and the exam page, with 1–4 s between clicks (5 calls each). The script records
  how many requests were really *in flight at the same moment* ("peak in flight").
- **"N simultaneous requests"**: N copies of one call fired at exactly the same instant (a worst-case burst).

## 1. Members active within one minute (realistic use)
| Run (UTC) | Members in 60 s | Calls | OK | 429 | 500 | 502 | 503 | 504 | Other | p50 | p95 | p99 | Peak in flight |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 28 Nov 01:01 | 200 | 1,000 | 1,000 | 0 | 0 | 0 | 0 | 0 | 0 | 66 ms | 87 ms | 150 ms | 7 |
| 28 Nov 01:03 | 500 | 2,500 | 2,500 | 0 | 0 | 0 | 0 | 0 | 0 | 50 ms | 69 ms | 104 ms | 11 |
| 28 Nov 01:04 | **1,000** | **5,000** | **5,000** | 0 | 0 | 0 | 0 | 0 | 0 | **50 ms** | **73 ms** | 90 ms | **17** |
| 27 Nov 15:21 | 1,000 (reads only) | 4,000 | 4,000 | 0 | 0 | 0 | 0 | 0 | 0 | 76 ms | 111 ms | 171 ms | 25 |
| 27 Nov 15:23 | 1,000 | 5,000 | 5,000 | 0 | 0 | 0 | 0 | 0 | 0 | 77 ms | 107 ms | 122 ms | 18 |
| 27 Nov 14:58 | 1,000 – started straight after a 1,000-simultaneous burst | 5,000 | 2,271 | 0 | 1 | 0 | 0 | 2,728 | 0 | 143 s | 204 s | 215 s | 1,000 |
| 27 Nov 15:26 | 2,000 | 10,000 | 2,844 | 0 | 0 | 0 | 0 | 3,066 | 2,217 × 522, 1,873 client errors | 131 s | 302 s | 302 s | 1,817 |

**The 1,000-member test, exactly:** 1,000 *virtual* members (not 1,000 different logins – 28 real sessions shared, see methodology),
backed by 306 registered staging accounts; arrivals spread over 60 s; 5 calls each (dashboard, video classes, video heartbeat write,
leaderboard, exam page) = 5,000 requests in ~73 s; at most **17–25 requests were in flight at the same moment**; result 5,000 × HTTP 200,
**zero 429/500/502/503/504**, p50 50–77 ms, p95 73–107 ms. Run on Supabase **Free** staging.

## 2. Simultaneous requests (worst-case bursts)
28 Nov 01:08 UTC (p95, all calls in each burst fired at once):
| Call | 50 | 100 | 200 | 500 | 1,000 |
|---|---|---|---|---|---|
| `my_dashboard` | 2.48 s | 2.09 s | 0.98 s | 4.22 s | 51.6 s |
| `leaderboard` | 1.34 s | 2.31 s | 2.22 s | 5.97 s | 54.0 s |
| `my_videos` | 0.16 s | 0.31 s | 1.12 s | 2.52 s | 38.7 s |
| `my_exam` | 0.17 s | 0.37 s | 0.82 s | 1.91 s | 28.0 s (91 × 504) |
| `my_registration` | 0.16 s | 0.17 s | 0.63 s | 0.82 s | 50.6 s |
| `record_video_progress` (write) | 0.16 s | 0.20 s | 1.38 s | 1.75 s | 32.1 s (1 client error) |
| Errors | 0 | 0 | 0 | 0 | 92 of 6,000 |

27 Nov 14:53 UTC (same script): 0 errors at every level up to 1,000; p95 at 500 = 0.7–2.3 s; at 1,000 = 24–58 s.
The 28 Nov burst at 50–100 was slower than on 27 Nov (first burst on a cold instance); both runs are reported.

## 3. Conclusions (Supabase Free / Vercel Hobby)
- **Proven:** 1,000 members active within the same minute doing typical actions (including a write): 0 errors, p95 ≈ 0.1 s, repeated on two days.
- **Proven:** up to 500 *simultaneous* requests: 0 errors, p95 ≤ 6 s (usually ≤ 2.5 s).
- **Not supported on Free:** 1,000 *simultaneous* requests at good speed (24–58 s, and on 28 Nov 1.5 % timed out), and **2,000 members within one minute**
  (collapsed: 72 % of requests failed). We do **not** claim 2,000 simultaneous users.
- After an extreme burst the free instance needs a few minutes to recover (see the 27 Nov 14:58 row).
- Practical meaning for 2,000 registered members: normal day-to-day use is comfortable. Risky are *coordinated* moments, e.g. everyone
  pressing START for the online exam in the same second. Mitigations: keep the entry window long (`entry_closes_at`), stagger batches,
  or temporarily upgrade compute on exam day.
