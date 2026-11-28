# Razorpay – test-mode setup and payment test checklist

**Scope:** the free staging project `mythree-staging` only. **Never use live keys (`rzp_live_…`) for testing, never put any key in the
repository, in chat or in a `VITE_` variable.** The browser only ever receives the public *Key ID*, which the server returns.

## 1. What is already in place (staging, 28 Nov 2026)
| Server function on staging | Purpose | Status |
|---|---|---|
| `payments-config` | tells the app whether payments are switched on | deployed – currently `{"enabled":false}` (no keys yet) |
| `registration-order` | creates or re-uses the ₹151 registration order | deployed |
| `registration-verify` | verifies signature + asks Razorpay that the payment is captured for the same order and amount | deployed |
| `registration-status` | "Check payment status" recovery after a closed browser | deployed |
| `payments-webhook` | Razorpay → Mythree (`payment.captured`, `payment.failed`), routes registration vs Guru Dakshina | deployed – rejects unsigned calls (401, checked) |
| `payments-reconcile` | every 10 minutes: confirms captured payments that were missed, expires unpaid orders after 24 h | deployed + scheduled |
| `payments-create-order`, `payments-verify` | Guru Dakshina (separate, optional) | deployed |

## 2. Create test keys (owner – 5 minutes)
1. Sign in at **dashboard.razorpay.com** and switch the toggle at the top to **Test Mode**.
2. **Account & Settings → API Keys → Generate Test Key.** You get a *Key ID* (`rzp_test_…`) and a *Key Secret* (shown once – store it in your password manager).
3. **Account & Settings → Webhooks → Add New Webhook** (still in Test Mode):
   - Webhook URL: `https://mxxkpcincouaniqryzfy.supabase.co/functions/v1/payments-webhook`
   - Secret: a long random string you make up (store it in your password manager)
   - Active events: `payment.captured`, `payment.failed`
4. Do **not** create or use live keys until the production rollout is approved.

## 3. Put the keys on the staging server (owner – the secret must never pass through chat)
Supabase Dashboard → project **mythree-staging** → **Edge Functions → Secrets** (or Project Settings → Edge Functions) → add:

| Name | Value |
|---|---|
| `RAZORPAY_KEY_ID` | `rzp_test_…` |
| `RAZORPAY_KEY_SECRET` | the test Key Secret |
| `RAZORPAY_WEBHOOK_SECRET` | the webhook secret from step 2.3 |
| `ALLOWED_ORIGINS` | `http://localhost:4173,http://127.0.0.1:4173` (plus any preview URL you use) |

Secrets apply to new function invocations immediately; no redeploy is needed.
Check: `https://mxxkpcincouaniqryzfy.supabase.co/functions/v1/payments-config` must now return `"enabled":true,"test_mode":true`.
If it says `"test_mode":false` you pasted a live key – remove it at once.

## 4. Run the app against staging
Locally: `VITE_SUPABASE_URL=https://mxxkpcincouaniqryzfy.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=<staging publishable key> npm run build && npx vite preview --port 4173`
(the publishable key is public; it is in the Supabase dashboard → Project Settings → API).
A Vercel preview of the branch can also be used, but its environment variables currently point at **production** Supabase –
change the *Preview* environment variables to staging first (Vercel → Project → Settings → Environment Variables → Preview only).

Use Razorpay's published test instruments (Razorpay docs → *Payments → Test Card Details / Test UPI*), e.g. the test UPI IDs
`success@razorpay` (succeeds) and `failure@razorpay` (fails). No real money moves in Test Mode.

## 5. Payment test checklist
Use a **new** test registration (a `@mythree.test`-style address you control, or ask me to seed a pending test member).
Record the Razorpay payment ID and the result for every row.

### Registration fee (₹151, mandatory for new members)
| # | Scenario | Expected result |
|---|---|---|
| R1 | Pending member opens any learning page | redirected to **/app/registration**; Learn/Videos/Challenges blocked |
| R2 | Pay ₹151 with `success@razorpay` | member ID shown (e.g. `SUBR1234`), status **Confirmed**, receipt `MYR-2026-xxxxxx`, admin notification "New member registered" |
| R3 | Pay with `failure@razorpay` | stays **pending**, clear error, can retry; registration_payments row `failed` |
| R4 | Close the browser tab right after paying, reopen, press **Check payment status** | confirmed without paying again (recovery) |
| R5 | Open the payment page in two tabs and start payment in both | the **same order** is reused (same order ID in both); only one payment possible |
| R6 | Double-click **Pay** | one order, one payment |
| R7 | Pay, then stop the browser before verification (e.g. turn off Wi-Fi) | webhook confirms within seconds; otherwise the 10-minute reconciliation job does |
| R8 | Try to confirm with a fake signature (developer tools) | `PAYMENT_VERIFICATION_FAILED`, nothing confirmed |
| R9 | A second captured payment for an already-paid member (pay a second, older order) | **not** confirmed twice; row marked `DUPLICATE_PAYMENT_REFUND_REQUIRED`; admin notification "refund needed" → refund it in the Razorpay dashboard |
| R10 | Admin → Registrations & member IDs | payment status, receipt, UID visible; search by UID / phone works |
| R11 | Admin manual confirmation (cash) with a reference | confirmed, audited, UID assigned |
| R12 | Minor with guardian phone; two siblings sharing that phone | both register; IDs `ABCD5678` and `ABCD5678-2` style |
| R13 | Name in Kannada/Devanagari + English spelling | ID uses the English spelling |
| R14 | Settings → `registration_payment_required` stays **true** | new members can never skip payment |

### Guru Dakshina (separate and optional)
| # | Scenario | Expected result |
|---|---|---|
| G1 | Confirmed member offers any amount ≥ the minimum | receipt; contribution listed for admin; does **not** affect registration |
| G2 | Pending member | Guru Dakshina is never presented as the registration fee |
| G3 | Same idempotency key twice | same order returned |

### Reconciliation & monitoring
| # | Scenario | Expected result |
|---|---|---|
| M1 | Admin → system health | last runs of `mythree-reconcile-payments` succeed |
| M2 | Leave an order unpaid > 24 h | marked `failed` / `expired_unpaid` by the job |

## 6. After testing
- Remove nothing from staging (keys can stay in Test Mode). For production, live keys are added **only after your approval** of the rollout, directly in the production project's secrets by you.
- Refunds are done in the Razorpay dashboard; the app does not issue refunds automatically.

## 7. Known limitations
- Live checkout has not been run yet (no test keys were available). Everything up to the Razorpay API call is tested
  (signature checks, idempotency, duplicate handling, gating – see `tests/db/registration_suite.sql`, `tests/db/phases.test.ts`).
- Refund webhooks are not processed; a refund made in the Razorpay dashboard is not reflected automatically in the admin list.
