# Backup and disaster recovery (Supabase Free + Vercel Hobby)

> A Git repository backup is **not** a database backup. Git holds code and migrations only; member data lives in Supabase.

## 1. What is backed up
| Asset | How | Where | Retention |
|---|---|---|---|
| Database: `public` (members, progress, payments, exams, results), `auth` (accounts), `storage` (file metadata) | `.github/workflows/db-backup.yml` – nightly `pg_dump` (PostgreSQL 17 client), verified with `pg_restore --list`, AES-256 encrypted with `gpg` | Private GitHub Actions artifact | 30 days |
| Uploaded files (answer sheets, question papers) | Admin downloads each exam's ZIP after evaluation (Phase 3 tool); optional manual export of the `exam-papers` bucket | Organisation's own drive | Organisation policy |
| Code, migrations, docs | Git (GitHub) + tag `v1.0.0-baseline` | GitHub | Permanent |
| Configuration (env vars, Auth settings, secrets list) | `.env.example`, this file, `REPORT.md §9` | Git (no secret values) | Permanent |

Supabase Free does not provide downloadable daily backups or point-in-time recovery – this workflow is the backup.

## 2. One-time setup (owner)
1. Supabase → Project Settings → Database → **Connection string → Session pooler** → copy the URI and insert the database password.
2. GitHub → repository → Settings → Secrets and variables → Actions → **New repository secret**:
   - `SUPABASE_DB_URL` = the URI from step 1
   - `BACKUP_PASSPHRASE` = a long random passphrase (also store it in the organisation password manager – without it backups cannot be decrypted)
3. GitHub → Actions → *Database backup* → **Run workflow** once and confirm it is green.
4. Do the restore drill in §4 once.

Security notes: the workflow never prints the connection string (errors are redacted), the dump is encrypted before upload, artifacts are visible only to repository collaborators, and the job has read-only repository permissions.

## 3. Restoring
### 3.1 Download and decrypt
```bash
# Actions → Database backup → choose a run → download artifact → unzip
gpg --decrypt --output mythree.dump mythree-<STAMP>.dump.gpg     # asks for BACKUP_PASSPHRASE
sha256sum mythree-<STAMP>.dump.gpg   # compare with mythree-<STAMP>.sha256
```
### 3.2 Restore into an isolated project first (never straight over production)
1. Use the staging project `mythree-staging` (a free organisation allows only 2 active projects, so a third restore project would require pausing staging first).
2. Apply the repository migrations if you only need structure: `supabase db push` – or restore everything from the dump:
```bash
pg_restore --dbname "<restore-project session URI>" --no-owner --no-privileges --clean --if-exists \
  --schema=public mythree.dump
# auth accounts (only when rebuilding production after a disaster):
pg_restore --dbname "<target URI>" --no-owner --no-privileges --data-only --schema=auth mythree.dump
```
3. Check counts: `select count(*) from profiles; select count(*) from registration_payments; select count(*) from exam_submission_pages;`
4. Point a Vercel **preview** deployment at the restored project (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) and sign in with a test account.
5. Only after verification, and with the owner's approval, switch production env vars or restore into production.

## 4. Restore drill (do once, then quarterly)
- [ ] Download latest artifact and decrypt
- [ ] Restore `public` schema into an isolated free project
- [ ] Row counts match the production dashboard (±activity since backup time)
- [ ] Run `npx vitest run -c vitest.db.config.ts` against the restored project with test accounts
- [ ] Record date, duration and result in `IMPLEMENTATION_REPORT.md`

## 5. Supabase Free project pause
Free projects are paused after a period of inactivity (about a week). Symptoms: the site loads but sign-in/dashboards fail with network errors.
1. Log in to https://supabase.com/dashboard → project **mythree** → **Restore project** (takes a few minutes).
2. Check https://mythree-five.vercel.app → sign in → dashboard loads.
3. Data is preserved during a pause. If the project cannot be restored, follow §3 with the latest backup.
Prevention: regular member traffic; the scheduled backup job also connects nightly.

## 6. Admin recovery checklist
| Situation | Action |
|---|---|
| Site down, Vercel status OK | Check Supabase project status (paused? restore). Check Supabase status page. |
| Bad deploy | Vercel → Deployments → previous production deployment → **Promote to Production** (instant rollback). |
| Bad code merged | `git revert` the merge on `main` (or redeploy tag `v1.0.0-baseline`) – never force-push. |
| Bad migration | Migrations are additive; write a corrective migration. If data was damaged, restore the affected tables from the latest backup into an isolated project and copy rows back after review. |
| Payment shows "pending" but member was charged | Admin → Payments → *Reconcile* (Phase 5) or member presses *Check payment status*; the server re-checks Razorpay and confirms. Never mark paid by hand without the Razorpay payment ID. |
| Lost admin access | Another admin promotes you (Admin → Member → Make admin) or run `update profiles set role='admin' where email='…'` in the SQL editor. |
| Leaked key | Rotate in Supabase (API keys) / Razorpay dashboard, update Vercel/Supabase secrets, redeploy. |
| Storage full (1 GB free) | Download evaluated exam ZIPs, then use the admin purge tool for evaluated exams. |

## 7. Drill log
| Date | What | Result | Evidence |
|---|---|---|---|
| 28 Nov 2026 | Logical backup of all 33 tables (`public` + `auth.users`, 2,168 rows) and restore into the isolated schema `drill_restore` on staging (`scripts/backup_restore_drill.sql`) | **33/33 tables: row counts and checksums identical**, 0.67 s; drill schemas dropped afterwards | `docs/verification/backup-restore-drill.md` |
| 27–28 Nov 2026 | Schema rollback to v1 and re-upgrade 0005 → 0009 on staging (the production upgrade path) | v1 tests 17/17 after rollback with all v1 data kept; 46/46 after re-upgrade | `docs/verification/rehearsal-1-after-rollback-v1-tests.log`, `docs/verification/db-tests.log` |
| pending | Nightly `pg_dump` workflow + `pg_restore` drill (§4) | needs the owner's `SUPABASE_DB_URL` and `BACKUP_PASSPHRASE` GitHub secrets | — |
