# rules.md – Engineering rules

## Use
- **React 19 + TypeScript (strict)**, Vite, Tailwind CSS 4 tokens from `src/index.css` (never hard-code brand hex values in components except inside SVG/print styles).
- **Supabase JS** for data. Members read their own rows directly (RLS) and perform every state change through an RPC in `supabase/migrations/*_functions.sql` or an Edge Function.
- **zod** for all form validation (`src/lib/validation.ts`); the database re-validates with CHECK constraints.
- **lucide-react** icons, **motion** for animation (respect `prefers-reduced-motion`), **recharts** only on admin pages (lazy-loaded).
- `useAsync` for page data; `friendlyError()` for every user-facing error.
- Self-hosted fonts via Fontsource (Marcellus, Manrope, Tiro Devanagari Sanskrit, Noto Sans Kannada).

## Avoid
- Calculating XP, scores, completion, eligibility or payment status in the browser. The UI may *preview* rules (`XP_RULES`) but the server decides.
- Sending answer keys to members. `questions`/`question_keys` are never selectable by members.
- Trusting client timestamps, amounts or roles.
- Service-role keys or any secret in `VITE_*` variables, Git, logs or error messages.
- Caching API/auth/payment responses in the service worker. Only build assets and public images are cached.
- Marking anything “successful” optimistically. Payments are successful only after `payments-verify` or the webhook confirm with Razorpay; tests only after the RPC returns.
- New databases/queues without a measured need (see architecture.md §1).
- Breaking changes to RPC signatures without updating `src/lib/api.ts` and tests.

## Database rules
- Every table has RLS enabled. New tables start with **no** policies and add the minimum.
- `SECURITY DEFINER` functions: `set search_path = ''`, fully qualified names, check `auth.uid()` / `assert_admin()` first, revoke `execute` from `public, anon` and grant only what is needed.
- Idempotency: unique keys (`xp_events (user, reason, ref)`, `challenge_instances (user, kind, period)`, `contributions (user, idempotency_key)`, partial unique active exam request) instead of “check then insert”.
- Use row locks (`FOR UPDATE`) when a function reads-then-writes a member's row.
- Migrations are append-only; never edit an applied migration – add a new one.

## Error handling
- RPCs raise stable machine codes (`CHAPTER_LOCKED`, `RATE_LIMITED`, `NOT_ELIGIBLE`…) – the UI maps them in `src/lib/errors.ts`.
- Edge Functions return `{ error: CODE }` with a proper HTTP status, log structured JSON (`log(event, details)`) and never echo provider secrets.
- Network failures show “Nothing was saved” and keep local answers (quiz answers persist in `sessionStorage`) so the member can retry; retries are safe because submissions are idempotent.
- Render errors fall back to the branded 500 page (`ErrorBoundary`); stale lazy chunks after a deploy trigger one automatic reload.

## Security checklist for every change
1. Does a member gain access to another member's data? (RLS)
2. Can the action be replayed for extra XP / payment credit? (idempotency key)
3. Is input validated on the server? (CHECK / function validation)
4. Is it rate-limited if it is public, sends SMS/email, or creates payments?
5. Are secrets only in Edge Function env?

## Code style
- Components: function components, named exports for shared pieces, default export per page.
- Keep pages < ~400 lines; extract shared UI to `components/`.
- Accessibility: labels for every input, `aria-*` on progress/dialog/tabs, visible focus, 44px touch targets.
- Copy: warm, respectful, plain English with Sanskrit accents; never childish.

## Boundaries for AI assistants working on this repo
- Read `memory.md` first and update it after every milestone.
- Do not run destructive SQL, force-push, rotate keys, change auth settings or create paid resources without the owner's explicit approval.
- Do not invent test results; paste real command output into `memory.md`/reports.
- Keep secrets out of prompts, commits and logs.
