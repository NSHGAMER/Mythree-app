# Production unchanged – evidence (read-only checks on 27 Nov 2026 16:15 UTC and again on 28 Nov 2026 ~01:30 UTC – identical)

| Check | Result |
|---|---|
| GitHub `origin/main` | `56c3dd1` = tag `v1.0.0-baseline` (26 Nov 2026 20:42 IST). No commit from this work is on `main`. |
| Vercel production deployments | newest 1 day old (26 Nov); nothing deployed from `feature/professor-requirements` to Production |
| Production Supabase migrations (`yflxqluyvueftocfzqzm`) | 6 entries from 26 Nov: schema, functions_core, functions_admin_and_grants, seed_settings_badges_faqs, seed_starter_curriculum, faq_matching (= repo 0001–0004). None of 0005–0008. |
| New columns on `profiles` (`member_uid`, `date_of_birth`, `registration_status`) | 0 present |
| New tables (`registration_payments`, `video_lessons`, `exam_schedules`, `leaderboard_snapshot`) | 0 present |
| New extensions (`pg_cron`, `pgmq`) | not installed |
| Storage buckets | 0 (exam buckets not created) |
| Edge Functions | the 8 original v1 functions, all still version 1 (26 Nov); none of the 5 new functions exist |
| Auth settings | not touched (no tool call against production auth in this work) |
