-- Mythree – 0008: free-tier performance and traffic control.
--  * contention-free rate limiter + trusted client IP
--  * chapter question counts, lean read-only my_dashboard (adds registration/video/exam summary)
--  * leaderboard snapshot (self-refreshing, also refreshed by pg_cron)
--  * missing indexes, split admin policies
--  * maintenance + payment reconciliation + notification queue (pg_cron, pg_net, pgmq – all free)
-- Business rules and RPC signatures used by the app are unchanged.

-- ---------------------------------------------------------------------------
-- 1. Rate limiting without hot rows
-- ---------------------------------------------------------------------------
-- Append-only hits: concurrent callers never wait on the same row. UNLOGGED = faster; losing
-- these counters on a crash only resets rate limits, never business data.
create unlogged table public.rate_limit_hits (
  key text not null,
  at timestamptz not null default now()
);
create index rate_limit_hits_key_at on public.rate_limit_hits (key, at);
alter table public.rate_limit_hits enable row level security;
revoke all on public.rate_limit_hits from anon, authenticated;

create or replace function public.check_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  insert into public.rate_limit_hits (key) values (p_key);
  select count(*) into v_count from public.rate_limit_hits
   where key = p_key and at > now() - make_interval(secs => p_window_seconds);
  return v_count <= p_max;
end $$;

-- Prefer headers set by the edge network (cannot be supplied by the client), then the LAST
-- X-Forwarded-For hop (appended by our proxy), never the first (client-controlled) value.
create or replace function public.client_ip() returns text
language sql stable set search_path = '' as $$
  with h as (select coalesce(current_setting('request.headers', true), '{}')::json as j)
  select coalesce(
    nullif(trim(j->>'cf-connecting-ip'), ''),
    nullif(trim(j->>'x-real-ip'), ''),
    nullif(trim((regexp_split_to_array(coalesce(j->>'x-forwarded-for', ''), '\s*,\s*'))[
      array_length(regexp_split_to_array(coalesce(j->>'x-forwarded-for', ''), '\s*,\s*'), 1)]), ''),
    'unknown')
  from h;
$$;

-- ---------------------------------------------------------------------------
-- 2. Chapter question counts (maintained, not recomputed on every dashboard load)
-- ---------------------------------------------------------------------------
alter table public.chapters add column question_count integer not null default 0;
update public.chapters c set question_count = (select count(*) from public.questions q where q.chapter_id = c.id and q.is_active);

create or replace function public.sync_chapter_question_count() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.chapters c set question_count = (select count(*) from public.questions q where q.chapter_id = c.id and q.is_active)
  where c.id in (coalesce(new.chapter_id, old.chapter_id), coalesce(old.chapter_id, new.chapter_id));
  return null;
end $$;
create trigger questions_sync_count after insert or update of is_active, chapter_id or delete on public.questions
  for each row execute function public.sync_chapter_question_count();

-- ---------------------------------------------------------------------------
-- 3. Leaderboard snapshot
-- ---------------------------------------------------------------------------
create table public.leaderboard_snapshot (
  period text not null check (period in ('all', 'week')),
  user_id uuid not null references public.profiles (id) on delete cascade,
  rank integer not null,
  score integer not null,
  name text not null,
  streak integer not null,
  avatar_seed text not null,
  visible boolean not null,
  refreshed_at timestamptz not null default now(),
  primary key (period, user_id)
);
create index leaderboard_snapshot_rank_idx on public.leaderboard_snapshot (period, rank) where visible;
alter table public.leaderboard_snapshot enable row level security;
revoke all on public.leaderboard_snapshot from anon, authenticated;

create or replace function public.refresh_leaderboard()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_week_start timestamptz := (date_trunc('week', (now() at time zone 'Asia/Kolkata'))) at time zone 'Asia/Kolkata'; v_n integer;
begin
  -- only one refresher at a time; others simply keep reading the current snapshot
  if not pg_try_advisory_xact_lock(hashtext('mythree:refresh_leaderboard')) then return 0; end if;
  delete from public.leaderboard_snapshot;
  insert into public.leaderboard_snapshot (period, user_id, rank, score, name, streak, avatar_seed, visible)
  select per.p, s.id, rank() over (partition by per.p order by case per.p when 'week' then coalesce(w.total, 0) else s.xp end desc),
         case per.p when 'week' then coalesce(w.total, 0) else s.xp end,
         split_part(s.full_name, ' ', 1) || coalesce(' ' || nullif(left(split_part(s.full_name, ' ', 2), 1), '') || '.', ''),
         public.effective_streak(s.last_active_date, s.current_streak), coalesce(s.avatar_seed, s.id::text), s.show_on_leaderboard
  from public.profiles s
  cross join (values ('all'), ('week')) per(p)
  left join lateral (select sum(e.amount)::integer total from public.xp_events e where e.user_id = s.id and e.created_at >= v_week_start) w on per.p = 'week'
  where s.role = 'member' and s.registration_status = 'confirmed';
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create or replace function public.leaderboard(p_period text default 'all', p_limit integer default 50)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_at timestamptz; v_rows jsonb; v_me jsonb;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  p_limit := least(greatest(coalesce(p_limit, 50), 1), 100);
  if p_period not in ('all', 'week') then p_period := 'all'; end if;
  select max(refreshed_at) into v_at from public.leaderboard_snapshot;
  -- self-healing if the scheduled refresh is not running: refresh at most every 5 minutes
  if v_at is null or v_at < now() - interval '5 minutes' then perform public.refresh_leaderboard(); end if;
  select coalesce(jsonb_agg(jsonb_build_object('rank', l.rank, 'name', l.name, 'score', l.score, 'streak', l.streak,
           'is_me', l.user_id = v_uid, 'avatar_seed', l.avatar_seed) order by l.rank, l.name), '[]'::jsonb)
    into v_rows
  from (select * from public.leaderboard_snapshot where period = p_period and visible order by rank limit p_limit) l;
  select jsonb_build_object('rank', rank, 'score', score) into v_me from public.leaderboard_snapshot where period = p_period and user_id = v_uid;
  return jsonb_build_object('period', p_period, 'rows', v_rows, 'me', v_me,
    'refreshed_at', (select max(refreshed_at) from public.leaderboard_snapshot));
end $$;

-- ---------------------------------------------------------------------------
-- 4. Lean, read-only member dashboard
-- ---------------------------------------------------------------------------
create or replace function public.touch_last_seen()
returns void language sql security definer set search_path = '' as $$
  update public.profiles set last_seen_at = now()
  where id = auth.uid() and (last_seen_at is null or last_seen_at < now() - interval '30 minutes');
$$;

create or replace function public.my_dashboard()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_p public.profiles;
  v_s public.app_settings;
  v_chapters jsonb;
  v_total integer; v_done integer;
  v_current jsonb;
  v_week_start timestamptz := (date_trunc('week', (now() at time zone 'Asia/Kolkata'))) at time zone 'Asia/Kolkata';
  v_sched public.exam_schedules;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  select * into v_p from public.profiles where id = v_uid;
  select * into v_s from public.app_settings where id = 1;
  v_sched := public.member_exam_schedule(v_uid);

  with ch as (
    select c.*, cp.status as p_status, cp.best_percentage, cp.attempts_count, cp.completed_at,
      coalesce(cp.status = 'completed', false) as done
    from public.chapters c
    left join public.chapter_progress cp on cp.chapter_id = c.id and cp.user_id = v_uid
    where c.is_published
  ), ordered as (
    select ch.*, (v_s.sequential_unlock and count(*) filter (where not ch.done) over (order by ch.position rows between unbounded preceding and 1 preceding) > 0) as locked
    from ch
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', o.id, 'position', o.position, 'title', o.title, 'title_sanskrit', o.title_sanskrit,
      'description', o.description, 'textbook_reference', o.textbook_reference,
      'learning_objectives', o.learning_objectives, 'pass_percentage', o.pass_percentage,
      'xp_reward', o.xp_reward, 'time_limit_minutes', o.time_limit_minutes,
      'question_count', least(o.question_count, coalesce(o.questions_per_test, o.question_count)),
      'status', coalesce(o.p_status::text, 'not_started'), 'best_percentage', coalesce(o.best_percentage, 0),
      'attempts', coalesce(o.attempts_count, 0), 'completed_at', o.completed_at, 'locked', coalesce(o.locked, false))
      order by o.position), '[]'::jsonb),
    count(*), count(*) filter (where o.done)
  into v_chapters, v_total, v_done
  from ordered o;

  select e.value into v_current from jsonb_array_elements(v_chapters) e
   where e.value->>'status' <> 'completed' order by (e.value->>'position')::integer limit 1;

  return jsonb_build_object(
    'profile', jsonb_build_object('id', v_p.id, 'full_name', v_p.full_name, 'email', v_p.email, 'phone', v_p.phone,
       'phone_verified', v_p.phone_verified_at is not null, 'role', v_p.role, 'xp', v_p.xp,
       'current_streak', public.effective_streak(v_p.last_active_date, v_p.current_streak),
       'longest_streak', v_p.longest_streak, 'last_active_date', v_p.last_active_date,
       'programme_start_date', v_p.programme_start_date, 'created_at', v_p.created_at,
       'has_address', v_p.address_line1 is not null and v_p.pincode is not null,
       'member_uid', v_p.member_uid, 'registration_status', v_p.registration_status, 'exam_preference', v_p.exam_preference),
    'programme', jsonb_build_object('start_date', v_p.programme_start_date, 'target_days', v_s.programme_days,
       'days_elapsed', (public.ist_today() - v_p.programme_start_date) + 1,
       'total_chapters', v_total, 'completed_chapters', v_done, 'remaining_chapters', v_total - v_done,
       'percent', case when v_total = 0 then 0 else round(100.0 * v_done / v_total, 1) end,
       'current_chapter', v_current),
    'chapters', v_chapters,
    'daily', (select jsonb_build_object('period_key', ci.period_key, 'submitted', ci.submitted_at is not null,
                'score', ci.score, 'total', ci.total, 'xp_awarded', ci.xp_awarded)
              from public.challenge_instances ci where ci.user_id = v_uid and ci.kind = 'daily'
               and ci.period_key = public.challenge_period_key('daily')),
    'weekly', (select jsonb_build_object('period_key', ci.period_key, 'submitted', ci.submitted_at is not null,
                'score', ci.score, 'total', ci.total, 'passed', ci.passed, 'xp_awarded', ci.xp_awarded)
              from public.challenge_instances ci where ci.user_id = v_uid and ci.kind = 'weekly'
               and ci.period_key = public.challenge_period_key('weekly')),
    'weekly_xp', (select coalesce(sum(amount), 0) from public.xp_events where user_id = v_uid and created_at >= v_week_start),
    'rank', (select rank from public.leaderboard_snapshot where period = 'all' and user_id = v_uid),
    'badges_earned', (select count(*) from public.user_badges where user_id = v_uid),
    'badges_total', (select count(*) from public.badges where is_active),
    'recent_badges', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('code', b.code, 'name', b.name, 'icon', b.icon, 'tier', b.tier, 'awarded_at', ub.awarded_at) x
        from public.user_badges ub join public.badges b on b.code = ub.badge_code
        where ub.user_id = v_uid order by ub.awarded_at desc limit 4) t), '[]'::jsonb),
    'exam', public.exam_eligibility(v_uid) || jsonb_build_object('request',
        (select to_jsonb(er) - 'admin_notes' - 'updated_by' from public.exam_requests er
          where er.user_id = v_uid and er.status <> 'cancelled')),
    'videos', (select jsonb_build_object('total', count(*), 'completed', count(p.completed_at),
                  'percent', case when count(*) = 0 then 0 else round(100.0 * count(p.completed_at) / count(*), 1) end)
               from public.video_lessons v left join public.video_progress p on p.video_id = v.id and p.user_id = v_uid
               where v.is_published and v.publish_at <= now()),
    'exam_schedule', case when v_sched.id is not null and v_sched.is_published then jsonb_build_object(
        'exam_starts_at', v_sched.exam_starts_at, 'title', v_sched.title,
        'session_status', (select status from public.exam_sessions where user_id = v_uid and schedule_id = v_sched.id)) end,
    'suggested_exam_month', public.suggested_exam_month(public.member_cohort_month(v_uid)),
    'result', (select jsonb_build_object('result', r.result, 'marks', r.marks, 'max_marks', r.max_marks)
               from public.exam_results r where r.user_id = v_uid and r.published_at is not null order by r.published_at desc limit 1),
    'contributed_paise', (select coalesce(sum(amount_paise), 0) from public.contributions where user_id = v_uid and status = 'paid'),
    'settings', jsonb_build_object('suggested_contribution', v_s.suggested_contribution,
       'require_phone_verification', v_s.require_phone_verification)
  );
end $$;

-- ---------------------------------------------------------------------------
-- 5. Indexes and policies
-- ---------------------------------------------------------------------------
create index if not exists chatbot_queries_user_idx on public.chatbot_queries (user_id);
create index if not exists chatbot_queries_faq_idx on public.chatbot_queries (matched_faq_id);
create index if not exists admin_notifications_user_idx on public.admin_notifications (user_id);
create index if not exists contact_messages_user_idx on public.contact_messages (user_id);
create index if not exists user_badges_code_idx on public.user_badges (badge_code);
create index if not exists challenge_instances_done_idx on public.challenge_instances (user_id, kind) where submitted_at is not null;
create index if not exists profiles_email_trgm on public.profiles using gin (email extensions.gin_trgm_ops);
create index if not exists profiles_uid_trgm on public.profiles using gin (member_uid extensions.gin_trgm_ops);
create index if not exists otp_codes_expires_idx on public.otp_codes (expires_at);

-- One SELECT policy per table: admin "ALL" policies are split into write-only policies.
drop policy if exists badges_admin on public.badges;
create policy badges_admin_write on public.badges for insert to authenticated with check ((select public.is_admin()));
create policy badges_admin_update on public.badges for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy badges_admin_delete on public.badges for delete to authenticated using ((select public.is_admin()));
drop policy if exists chapters_admin on public.chapters;
create policy chapters_admin_write on public.chapters for insert to authenticated with check ((select public.is_admin()));
create policy chapters_admin_update on public.chapters for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy chapters_admin_delete on public.chapters for delete to authenticated using ((select public.is_admin()));
drop policy if exists faqs_admin on public.faqs;
create policy faqs_admin_write on public.faqs for insert to authenticated with check ((select public.is_admin()));
create policy faqs_admin_update on public.faqs for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy faqs_admin_delete on public.faqs for delete to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- 6. Maintenance (cleanup) – idempotent, safe to run any time
-- ---------------------------------------------------------------------------
create or replace function public.run_maintenance()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a integer; b integer; c integer; d integer; e integer;
begin
  delete from public.rate_limit_hits where at < now() - interval '1 day'; get diagnostics a = row_count;
  delete from public.rate_limits where window_start < now() - interval '2 days'; get diagnostics b = row_count;
  delete from public.otp_codes where expires_at < now() - interval '1 day'; get diagnostics c = row_count;
  delete from public.chatbot_queries where created_at < now() - interval '180 days'; get diagnostics d = row_count;
  update public.exam_sessions set status = 'expired' where status = 'in_progress' and now() > upload_until; get diagnostics e = row_count;
  return jsonb_build_object('rate_limit_hits', a, 'rate_limits', b, 'otp_codes', c, 'chatbot_queries', d, 'expired_exam_sessions', e, 'at', now());
end $$;

-- ---------------------------------------------------------------------------
-- 7. Background jobs: pg_cron + pg_net + pgmq (free extensions)
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists pgmq;

select pgmq.create('notifications') where not exists (select 1 from pgmq.list_queues() where queue_name = 'notifications');

-- Every admin notification is also queued so a worker can e-mail it (when e-mail is configured).
create or replace function public.queue_admin_notification() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pgmq.send('notifications', jsonb_build_object('id', new.id, 'kind', new.kind, 'title', new.title, 'body', new.body, 'link', new.link, 'created_at', new.created_at));
  return null;
end $$;
create trigger admin_notifications_queue after insert on public.admin_notifications
  for each row execute function public.queue_admin_notification();

-- Worker helpers (service role only)
create or replace function public.notifications_read(p_qty integer default 20, p_vt integer default 120)
returns table (msg_id bigint, read_ct integer, message jsonb) language sql security definer set search_path = '' as $$
  select msg_id, read_ct, message from pgmq.read('notifications', p_vt, p_qty);
$$;
create or replace function public.notifications_archive(p_ids bigint[])
returns integer language plpgsql security definer set search_path = '' as $$
declare i bigint; n integer := 0;
begin
  foreach i in array p_ids loop
    if pgmq.archive('notifications', i) then n := n + 1; end if;
  end loop;
  return n;
end $$;
create or replace function public.notifications_depth()
returns bigint language sql security definer set search_path = '' as $$
  select queue_length from pgmq.metrics('notifications');
$$;

-- Shared secret for cron → Edge Function calls, generated and kept inside the database (Vault).
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'mythree_cron_secret', 'pg_cron → Edge Function shared secret')
where not exists (select 1 from vault.secrets where name = 'mythree_cron_secret');

create or replace function public.verify_cron_secret(p_secret text)
returns boolean language sql security definer set search_path = '' as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'mythree_cron_secret' and decrypted_secret = p_secret);
$$;

-- Payment reconciliation candidates for the worker: open orders older than 15 minutes (≤ 7 days).
create or replace function public.open_orders_for_reconciliation(p_limit integer default 50)
returns table (kind text, order_id text, amount_paise integer, created_at timestamptz) language sql security definer set search_path = '' as $$
  (select 'registration', razorpay_order_id, amount_paise, created_at from public.registration_payments
    where status = 'created' and razorpay_order_id is not null and created_at < now() - interval '15 minutes' and created_at > now() - interval '7 days'
      and (last_checked_at is null or last_checked_at < now() - interval '10 minutes')
    order by created_at limit p_limit)
  union all
  (select 'contribution', razorpay_order_id, amount_paise, created_at from public.contributions
    where status = 'created' and razorpay_order_id is not null and created_at < now() - interval '15 minutes' and created_at > now() - interval '7 days'
    order by created_at limit p_limit);
$$;

-- Schedules the jobs for THIS environment (run once per project with its own functions URL):
--   select public.schedule_mythree_jobs('https://<project-ref>.supabase.co/functions/v1');
create or replace function public.schedule_mythree_jobs(p_functions_url text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_secret text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'mythree_cron_secret';
  perform cron.schedule('mythree-leaderboard', '*/5 * * * *', 'select public.refresh_leaderboard()');
  perform cron.schedule('mythree-maintenance', '17 * * * *', 'select public.run_maintenance()');
  perform cron.schedule('mythree-reconcile-payments', '*/10 * * * *',
    format($j$select net.http_post(url := %L, headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'mythree_cron_secret')), body := '{}'::jsonb, timeout_milliseconds := 20000)$j$,
           rtrim(p_functions_url, '/') || '/payments-reconcile'));
  perform cron.schedule('mythree-notifications', '*/2 * * * *',
    format($j$select net.http_post(url := %L, headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'mythree_cron_secret')), body := '{}'::jsonb, timeout_milliseconds := 20000)$j$,
           rtrim(p_functions_url, '/') || '/notifications-worker'));
  return (select jsonb_agg(jsonb_build_object('job', jobname, 'schedule', schedule)) from cron.job where jobname like 'mythree-%');
end $$;

-- ---------------------------------------------------------------------------
-- 8. Admin: system health (queue depth, job runs, table sizes)
-- ---------------------------------------------------------------------------
create or replace function public.admin_system_health()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  return jsonb_build_object(
    'notifications_queue', (select queue_length from pgmq.metrics('notifications')),
    'open_registration_orders', (select count(*) from public.registration_payments where status = 'created'),
    'open_contribution_orders', (select count(*) from public.contributions where status = 'created'),
    'leaderboard_refreshed_at', (select max(refreshed_at) from public.leaderboard_snapshot),
    'jobs', coalesce((select jsonb_agg(jsonb_build_object('job', j.jobname, 'schedule', j.schedule,
        'last_status', (select d.status from cron.job_run_details d where d.jobid = j.jobid order by d.start_time desc limit 1),
        'last_run', (select d.start_time from cron.job_run_details d where d.jobid = j.jobid order by d.start_time desc limit 1)))
      from cron.job j where j.jobname like 'mythree-%'), '[]'::jsonb),
    'db_size', pg_size_pretty(pg_database_size(current_database())),
    'storage_bytes', (select coalesce(sum((metadata->>'size')::bigint), 0) from storage.objects));
end $$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
revoke execute on function public.refresh_leaderboard() from public, anon, authenticated;
revoke execute on function public.run_maintenance() from public, anon, authenticated;
revoke execute on function public.sync_chapter_question_count() from public, anon, authenticated;
revoke execute on function public.queue_admin_notification() from public, anon, authenticated;
revoke execute on function public.notifications_read(integer, integer) from public, anon, authenticated;
revoke execute on function public.notifications_archive(bigint[]) from public, anon, authenticated;
revoke execute on function public.notifications_depth() from public, anon, authenticated;
revoke execute on function public.verify_cron_secret(text) from public, anon, authenticated;
revoke execute on function public.open_orders_for_reconciliation(integer) from public, anon, authenticated;
revoke execute on function public.schedule_mythree_jobs(text) from public, anon, authenticated;
grant execute on function public.notifications_read(integer, integer) to service_role;
grant execute on function public.notifications_archive(bigint[]) to service_role;
grant execute on function public.notifications_depth() to service_role;
grant execute on function public.verify_cron_secret(text) to service_role;
grant execute on function public.open_orders_for_reconciliation(integer) to service_role;
grant execute on function public.run_maintenance() to service_role;
revoke execute on function public.touch_last_seen() from public, anon;
grant execute on function public.touch_last_seen() to authenticated;
revoke execute on function public.admin_system_health() from public, anon;
grant execute on function public.admin_system_health() to authenticated;
