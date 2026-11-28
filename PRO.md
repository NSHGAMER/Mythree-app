# PRO.md – Project Requirements Document

**Product:** Mythree – संस्कृतगृहम् ("Namma Mane – Samskṛtagṛham")
**Owner:** Maitrī Samskṛta-Samskṛti Pratiṣṭhāna (R), Bengaluru
**Audience:** 2,000+ members of all ages, mostly on mobile phones in India.

## 1. What we are building
A premium, installable (PWA) Sanskrit learning and member-management platform. Members study from a **printed textbook posted to their home** and use the app to test themselves chapter by chapter, practise daily and weekly, earn rewards, and finally declare readiness for a **paper final exam** posted to their address.

## 2. Users and roles
| Role | Can do |
|---|---|
| **Member** | Register, verify email/mobile, learn, take tests & challenges, view own progress/history/rewards, leaderboard, contribute Guru Dakshina, request final exam, manage own profile, delete own account. |
| **Admin** | Everything above + member monitoring table & profiles, analytics, CSV exports, chapter/question CRUD, FAQ CRUD, exam-dispatch management, contributions, contact messages, notifications, settings, role management. |

Only these two roles exist. Enforcement is in the database (RLS + `assert_admin()`); the UI guards are convenience only.

## 3. Functional requirements
### Public website
Splash screen with animated official logo → homepage; About; Programme; Contact (form + details); Guru Dakshina; Register; Login; Install guide; Privacy Policy; Terms of Service; Cookie Preferences; 404 / 403 / 500 / Maintenance pages; light/dark mode; skeleton loaders.

### Registration & authentication
Full name, mobile, email, age, full residential address, password. Email verification (Supabase Auth), mobile OTP (custom, hashed, rate-limited), login, forgot/reset password, account settings, profile. Duplicate email (Auth) and duplicate phone (unique index + pre-check) are prevented.

### Guru Dakshina (voluntary)
Navigation item **GURU DAKSHINA**; suggested ₹151 (admin-configurable); any amount ≥ admin minimum; Razorpay checkout; server-side signature **and** API verification; webhook reconciliation; transaction history; printable receipts. **Never** gates registration, learning, tests, rewards or exam.

### Learning system
Chapter-wise modules (title EN/SA, description, textbook reference, objectives); chapter tests (MCQ, true/false, fill-in) graded on the server; configurable pass mark per chapter = completion criterion; retakes (best score kept); sequential unlocking (configurable); learning history; daily & weekly challenges.

### 180-day programme
Target only. Show start date, days elapsed, chapters completed, current chapter, remaining, overall %. Never lock or reset after 180 days.

### Final exam readiness
When all published chapters are complete (+ optional weekly-challenge requirement): button **"Yes, I am ready to take the Final Exam"** → confirmation → saves request, date, days taken, address snapshot → admin notification (+ optional email) → admin dashboard dispatch workflow (requested → approved → paper dispatched → delivered → exam completed / on hold / cancelled) with courier & tracking. No online final exam.

### Admin dashboard
Member monitoring table (name, registration date, phone, email, current chapter, completed/total, %, last active, avg test score, days taken, exam readiness, Guru Dakshina status) with search, filters, sorting, pagination and CSV export; member profile (all chapters with completion dates, scores, attempts, daily/weekly history, streak, XP, learning duration, exam status, contributions); analytics charts.

### Chatbot
Answers only from the admin-managed FAQ knowledge base (full-text + trigram search with a confidence threshold); otherwise gives contact guidance and logs the question for admins ("Unanswered questions" tab).

### Gamification
Server-validated XP, daily streaks (IST), daily/weekly challenges, 19 badges (bronze → platinum), 9 Sanskrit-named levels, weekly & all-time leaderboards (privacy: first name + initial, opt-out).

### PWA
Manifest, icons from the official logo (any + maskable + Apple), standalone, service worker (static assets only), install prompt (Android/desktop), iOS Safari "Add to Home Screen" guide, offline banner and fallback, update prompt.

## 4. Non-functional requirements
- 2,000+ members; bursts of concurrent logins, submissions and dashboard loads.
- Security: RLS on every table, column-level grants, SECURITY DEFINER functions with empty `search_path`, rate limits, idempotency, no secrets in Git, strict CSP and security headers.
- Accessibility: semantic HTML, focus rings, ARIA on progress/dialogs, reduced-motion support, 44px+ touch targets.
- Performance: code-split routes, self-hosted fonts, compressed images, immutable asset caching.
- Privacy: DPDP Act 2023 aligned – minimal data, user deletion, no tracking cookies.

## 5. Out of scope (unless requested)
Online final exam, native app-store apps, multi-language UI (English + Sanskrit labels only for now), certificates generation.

## 6. Revision – professor requirements (27–28 Nov 2026, branch `feature/professor-requirements`)
These changes **supersede** the matching lines above once the owner approves the production rollout.
- **Registration fee:** a one-time **₹151 registration fee is mandatory for new members**, confirmed only after server-side Razorpay verification. Members who registered before this change are grandfathered (no retroactive fee). **Guru Dakshina stays separate and optional.**
- **Registration fields:** full name, *name in English letters* (required only when the name is written in another script), date of birth (replaces age), full address with PIN, exam preference (online/offline), email, contact number.
- **Phone rule:** 18+ give their own mobile; under-18s give a parent/guardian name and mobile; siblings may share a guardian number – phone numbers are **no longer unique**.
- **Member ID (UID):** permanent, first 4 English letters of the name (English spelling when the name is in Kannada/Devanagari) + last 4 digits of the applicable phone, upper case; collisions get `-2`, `-3`…
- **Video classes:** admin-scheduled lessons in order; real watch-time tracking (no skipping to complete), resume, completion %.
- **Daily/weekly tests:** admin-managed question sets with dates and rewards; automatic challenges remain the fallback.
- **Examination:** readiness request kept; suggested exam month = registration month + 3 (same for a monthly batch), admin can set the exact date per batch or member; **online exam** (START → 3-hour server timer → PDF question paper → photo upload of answer sheets → SUBMIT) and **offline exam** (paper by post, as before).
- **Evaluation & results:** admin views answer sheets, enters marks/remarks/PASS-FAIL, publishes; Excel import with template, preview and validation; members see only published results.
- **Chatbot:** suggested-questions button sourced from FAQs (fills the input, never auto-sends).
