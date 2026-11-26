# memory.md – Working memory (update after every milestone)

_Last updated: 26 Nov 2026 (deployment milestone)_

## Current state
- LIVE: https://mythree-five.vercel.app (Vercel project nshgamers-projects/mythree, GitHub main auto-deploys).
- Supabase project mythree (ref yflxqluyvueftocfzqzm, ap-south-1, Free). Migrations 0001–0004 applied; 8 edge functions deployed.
- Tests executed 26 Nov 2026: 64/64 unit+component, 17/17 DB integration, 76/76 responsive+PWA on production, 4/4 signed-in journeys. Load test: see loadtest/RESULTS.md (Free tier OK to ~200 simultaneous; 2,000 burst timed out).
- Test accounts (*@mythree.test) were deleted after testing; re-create with loadtest/seed.sql when re-testing.
- See REPORT.md for pending owner configuration (Auth URLs, SMTP, Razorpay, SMS, admin, Pro plan).

## Decisions
- Stack: React 19 + Vite 8 + Tailwind 4 SPA on Vercel; Supabase (Postgres 17, Auth, Edge Functions) in ap-south-1.
- No Redis/queues: Postgres rate-limit table + idempotent RPCs + Razorpay webhooks are sufficient at 2k members.
- Mobile OTP is custom (hashed codes, layered rate limits) because Supabase phone auth does not support MSG91; phone verification is prompted, not required, until an SMS provider is configured (`app_settings.require_phone_verification`).
- Starter curriculum: 12 beginner chapters × 6 questions (MCQ options shuffled at seed time). Replace with the real textbook.
- Contributions survive account deletion (user_id → NULL + payer snapshot).

## Files being worked on next
- Apply migrations, deploy functions, run DB integration tests, Playwright checks, load tests, push, deploy.

## Gotchas
- Windows PowerShell 5.1 `Get-Content`/`Set-Content` corrupt UTF-8 (Devanāgarī) – edit files with Node or the editor, never PowerShell text replace.
- CSP hashes the inline theme script in `index.html`; if that script changes, recompute the `sha256-` value in `vercel.json`.
