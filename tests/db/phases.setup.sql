-- Run on the STAGING project before tests/db/phases.test.ts (after loadtest/reset.sql):
-- gives two online members an approved readiness request so they may start the online exam.
insert into public.exam_requests (user_id, programme_start_date, days_taken, chapters_completed, address_snapshot, status)
select id, programme_start_date, 1, 12, jsonb_build_object('full_name', full_name), 'approved' from public.profiles
where email in ('loadtest+5@mythree.test', 'loadtest+7@mythree.test')
on conflict do nothing;
