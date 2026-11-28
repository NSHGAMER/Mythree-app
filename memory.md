# memory.md – Working memory (update after every milestone)

_Last updated: 28 Nov 2026 (professor-requirements verification milestone)_

## Current state
- **Production (unchanged since 26 Nov):** https://mythree-five.vercel.app, `main` = tag `v1.0.0-baseline` (56c3dd1), Supabase `mythree` (yflxqluyvueftocfzqzm) with migrations 0001–0004 and the 8 original functions.
- **Development:** branch `feature/professor-requirements`; free staging project `mythree-staging` (mxxkpcincouaniqryzfy) runs migrations 0001–0009, 9 Edge Functions and 4 pg_cron jobs.
- Staging test accounts: `admin-test@mythree.test`, `loadtest+1..300@mythree.test` (confirmed), `pending+1..5@mythree.test` (pending). Password only in the git-ignored `.env.staging`.
- Latest results (28 Nov): unit 107/107 · DB 46/46 · SQL suites as expected · screen 100/100 (4 device sizes) · backup drill 33/33 tables match · load: see loadtest/RESULTS.md.

## Decisions
- ₹151 registration fee mandatory for **new** members; the existing production member is grandfathered. Guru Dakshina separate and optional.
- UID = 4 English letters (English spelling for Kannada/Devanagari names) + last 4 digits of the applicable phone; siblings may share a guardian phone.
- Email/phone verification policy unchanged (owner decision pending). Supabase Free + Vercel Hobby only.
- Production changes only after explicit owner approval.

## Next
- Owner: Razorpay test keys on staging, Turnstile keys, GitHub backup secrets, approval of the rollout plan in IMPLEMENTATION_REPORT.md.

## Gotchas
- Windows PowerShell 5.1 `Get-Content`/`Set-Content` corrupt UTF-8 – edit with Node or the editor.
- CSP hashes the inline theme script in `index.html`; recompute the `sha256-` value in `vercel.json` if it changes.
- Supabase API roles reject a bare `DELETE`/`UPDATE` without `WHERE` (pg_safeupdate) – use `where true`.
- Supabase Auth allows ~30 sign-ins per 5 minutes per IP – load tests share 28 sessions.
