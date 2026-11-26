# memory.md – Working memory (update after every milestone)

_Last updated: 26 Nov 2026_

## Current state
- Frontend complete for all 12 functional areas; `npm run build` passes; `tsc -b` clean.
- 64 unit/component tests passing (`npx vitest run`): gamification, programme maths (180-day never locks), validation, CSV/format/errors, Razorpay signature + webhook verification, OTP generation/hashing, amount validation, route guards (member vs admin), quiz runner (answer format, offline guard, confirmation), result view, chatbot (FAQ-only, no invented answers), PWA platform detection.
- Database migrations written (`supabase/migrations/2026112600000{1,2,3}_*.sql`) – **not yet applied** (waiting for approval to create the Supabase project).
- Edge Functions written (`supabase/functions/*`) – not yet deployed.

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
