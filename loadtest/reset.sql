-- Resets learning state of test accounts so the integration/load tests can be re-run.
delete from public.exam_requests where user_id in (select id from public.profiles where email like '%@mythree.test');
delete from public.test_attempts where user_id in (select id from public.profiles where email like '%@mythree.test');
delete from public.chapter_progress where user_id in (select id from public.profiles where email like '%@mythree.test');
delete from public.challenge_instances where user_id in (select id from public.profiles where email like '%@mythree.test');
delete from public.xp_events where user_id in (select id from public.profiles where email like '%@mythree.test');
delete from public.user_badges where user_id in (select id from public.profiles where email like '%@mythree.test');
delete from public.admin_notifications where user_id in (select id from public.profiles where email like '%@mythree.test');
update public.profiles set xp = 0, current_streak = 0, longest_streak = 0, last_active_date = null, city = 'Bengaluru'
 where email like '%@mythree.test';
delete from public.rate_limits;
