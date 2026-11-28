# Cloudflare Turnstile (free CAPTCHA) – setup guide

Turnstile protects **registration, login, password reset and "resend verification email"** against bots.
It is free, has no puzzles for most people, and fits the Supabase Free / Vercel Hobby budget.

## How it works in Mythree
```
Browser ──(site key, public)──► Turnstile widget ──► token
Browser ──(token as captchaToken)──► Supabase Auth ──(secret key)──► Cloudflare verifies ──► sign-up / login allowed
```
- The **site key** is public and goes into the Vercel variable `VITE_TURNSTILE_SITE_KEY`.
- The **secret key** is stored **only** in Supabase (Authentication settings). It never goes into the repository,
  into Vercel, into chat, or into a `VITE_` variable.
- Code: `src/components/Turnstile.tsx` (renders only when `VITE_TURNSTILE_SITE_KEY` is set), used in
  `Login.tsx`, `Register.tsx` (last step), `ForgotPassword.tsx`. CSP in `vercel.json` already allows `https://challenges.cloudflare.com`.
- With the variable empty (today) the app behaves exactly as before – verified by the full screen-test run.

## ⚠ Order matters
Supabase rejects sign-ups and logins **without** a token as soon as CAPTCHA is switched on there. Always:
**1) deploy the site key to the app, 2) check the widget appears, 3) only then switch CAPTCHA on in Supabase.**
To switch off in an emergency: Supabase → Authentication → Attack Protection → disable CAPTCHA (takes effect immediately).

## Step 1 – Create the widget (owner, Cloudflare account, free)
1. dash.cloudflare.com → **Turnstile** → **Add widget**.
2. Name: `Mythree`.
3. Hostnames: `mythree-five.vercel.app` (production, later), `localhost`, `127.0.0.1` and the Vercel preview host you test on.
   (Cloudflare also accepts sub-domains of listed hostnames.)
4. Widget mode: **Managed**. Pre-clearance: **No**.
5. Create → copy the **Site key** (public) and the **Secret key** (store it in your password manager only).

For automated tests Cloudflare publishes dummy keys: site key `1x00000000000000000000AA` (always passes) with secret
`1x0000000000000000000000000000000AA`. They are public test values, not credentials, and never protect anything.

## Step 2 – Staging first
1. Build/preview the branch against staging with the site key:
   `VITE_TURNSTILE_SITE_KEY=<site key> VITE_SUPABASE_URL=https://mxxkpcincouaniqryzfy.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=<staging publishable key> npm run build && npx vite preview --port 4173`
   (or set the variable for the **Preview** environment in Vercel → Project → Settings → Environment Variables).
2. Open `/login`, `/forgot-password`, and the last step of `/register`: the Turnstile box must appear.
3. Supabase Dashboard → project **mythree-staging** → **Authentication → Attack Protection** (called *Bot and Abuse Protection*
   in some dashboard versions) → **Enable CAPTCHA protection** → provider **Turnstile by Cloudflare** → paste the **Secret key** → Save.
4. Verify (all on staging):
   | Check | Expected |
   |---|---|
   | Login after the box shows a tick | works |
   | Login request without a token (e.g. `curl` to `/auth/v1/token`) | rejected with a captcha error |
   | Registration (final step) | works; a second submit gets a fresh token automatically |
   | Forgot password | "If an account exists…" message |
   | Automated test | `VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA npx playwright test turnstile` passes |
   | Mobile (Android/iPhone) | box fits the card, no horizontal scroll |

## Step 3 – Production (only after you approve the rollout)
1. Vercel → Production environment variable `VITE_TURNSTILE_SITE_KEY=<site key>` → redeploy.
2. Check the widget on the live site.
3. Supabase production project → Authentication → Attack Protection → enable Turnstile with the **Secret key**.
4. Repeat the verification table on production with your own account.

## Notes
- This does not change email confirmation or phone-OTP policy (those stay as they are until you decide).
- The load-test script calls Auth directly; once CAPTCHA is on, use `1x0000000000000000000000000000000AA` (dummy secret)
  on staging for load tests, or switch CAPTCHA off on staging during a test window.
