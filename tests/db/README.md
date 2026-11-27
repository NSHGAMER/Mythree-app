# Database tests (staging only)

1. `loadtest/reset.sql` – clears learning/exam state of `@mythree.test` accounts.
2. `tests/db/phases.setup.sql` – approved readiness for two online test members.
3. `npx vitest run -c vitest.db.config.ts` with `.env.staging` loaded – 46 client-side tests
   (RLS, roles, chapter tests, challenges, readiness, leaderboard, chatbot, registration, UIDs, videos,
   challenge sets, online exam, storage policies, results, import, dashboard).
4. `tests/db/registration_suite.sql` and `tests/db/exam_deadline_suite.sql` – server-side scenarios that need
   direct table access (sign-up validation, sibling UIDs, payment idempotency/duplicates, deadline expiry,
   rate limiter). Each ends with `raise exception 'RESULTS …'`, so **everything is rolled back** and the
   results are printed in the error message.
