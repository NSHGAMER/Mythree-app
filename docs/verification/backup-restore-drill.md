# Backup & isolated restore drill – staging, 28 Nov 2026 ~01:05 UTC

Script: `scripts/backup_restore_drill.sql` (md5 `1d408df7b67434282ed2be68283c470d`), run on `mythree-staging` (`mxxkpcincouaniqryzfy`, Free plan).
Production was not touched.

| Result | Value |
|---|---|
| Tables backed up (all of `public` + `auth.users`) | 33 |
| Rows backed up | 2,168 |
| Backup archive size | 176 KB (JSON) |
| Rows restored into isolated schema `drill_restore` | 2,168 |
| Tables whose row count **and** checksum match the live table | **33 / 33** |
| Duration | 0.67 s |
| Drill schemas afterwards | dropped (0 left) |

Per-table detail (rows backed up = rows restored, checksum match):
auth.users 306 ✓ · admin_allowlist 1 ✓ · admin_notifications 3 ✓ · app_settings 1 ✓ · audit_log 628 ✓ · badges 19 ✓ ·
challenge_instances 3 ✓ · challenge_sets 0 ✓ · chapter_progress 15 ✓ · chapters 12 ✓ · chatbot_queries 12 ✓ ·
contact_messages 0 ✓ · contributions 0 ✓ · exam_requests 3 ✓ · exam_results 2 ✓ · exam_schedules 1 ✓ · exam_sessions 1 ✓ ·
exam_submission_pages 1 ✓ · faqs 17 ✓ · leaderboard_snapshot 602 ✓ · otp_codes 0 ✓ · profiles 306 ✓ · question_keys 72 ✓ ·
questions 72 ✓ · rate_limit_hits 20 ✓ · rate_limits 0 ✓ · registration_payments 1 ✓ · result_imports 1 ✓ · test_attempts 17 ✓ ·
user_badges 11 ✓ · video_lessons 0 ✓ · video_progress 0 ✓ · xp_events 41 ✓

Checksum = md5 over the sorted md5 of every row's text form, so a single changed value in any row would fail the match.

## What this proves and what it does not
- Proves: every table and every row (including generated columns, constraints and defaults) can be serialised and restored
  byte-for-byte into a separate schema without touching live data.
- Does **not** prove the `pg_dump`/`pg_restore` path of `.github/workflows/db-backup.yml`: that needs the database
  connection string, which only the owner can add as a GitHub secret (`SUPABASE_DB_URL`, plus `BACKUP_PASSPHRASE`).
  The free plan has no second spare project for a full restore target (2 active projects per free organisation).
- Storage files (question papers, answer-sheet photos) are not inside the database; see BACKUP_AND_RECOVERY.md.
