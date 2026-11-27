-- Rollback 0008 (performance & jobs). Extensions pg_cron/pg_net/pgmq stay installed (harmless, unused).
do $$ begin
  perform cron.unschedule(jobid) from cron.job where jobname like 'mythree-%';
exception when undefined_table or invalid_schema_name then null; end $$;
drop trigger if exists admin_notifications_queue on public.admin_notifications;
drop trigger if exists questions_sync_count on public.questions;
do $$ begin
  if exists (select 1 from pgmq.list_queues() where queue_name = 'notifications') then perform pgmq.drop_queue('notifications'); end if;
exception when undefined_function or invalid_schema_name then null; end $$;
delete from vault.secrets where name = 'mythree_cron_secret';
drop function if exists public.schedule_mythree_jobs(text);
drop function if exists public.admin_system_health();
drop function if exists public.open_orders_for_reconciliation(integer);
drop function if exists public.verify_cron_secret(text);
drop function if exists public.notifications_depth();
drop function if exists public.notifications_archive(bigint[]);
drop function if exists public.notifications_read(integer, integer);
drop function if exists public.queue_admin_notification();
drop function if exists public.run_maintenance();
drop function if exists public.touch_last_seen();
drop function if exists public.refresh_leaderboard();
drop function if exists public.sync_chapter_question_count();
drop table if exists public.leaderboard_snapshot;
drop table if exists public.rate_limit_hits;
alter table public.chapters drop column if exists question_count;
-- restore the v1 versions of replaced functions
-- @restore 20261126000002_functions.sql client_ip
-- @restore 20261126000002_functions.sql check_rate_limit
-- @restore 20261126000002_functions.sql leaderboard
-- @restore 20261126000002_functions.sql my_dashboard
-- restore the single admin ALL policies
drop policy if exists badges_admin_write on public.badges;
drop policy if exists badges_admin_update on public.badges;
drop policy if exists badges_admin_delete on public.badges;
drop policy if exists chapters_admin_write on public.chapters;
drop policy if exists chapters_admin_update on public.chapters;
drop policy if exists chapters_admin_delete on public.chapters;
drop policy if exists faqs_admin_write on public.faqs;
drop policy if exists faqs_admin_update on public.faqs;
drop policy if exists faqs_admin_delete on public.faqs;
create policy badges_admin on public.badges for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy chapters_admin on public.chapters for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy faqs_admin on public.faqs for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
-- extra indexes (harmless to keep; removed for a clean v1 schema)
drop index if exists public.chatbot_queries_user_idx;
drop index if exists public.chatbot_queries_faq_idx;
drop index if exists public.admin_notifications_user_idx;
drop index if exists public.contact_messages_user_idx;
drop index if exists public.user_badges_code_idx;
drop index if exists public.challenge_instances_done_idx;
drop index if exists public.profiles_email_trgm;
drop index if exists public.profiles_uid_trgm;
drop index if exists public.otp_codes_expires_idx;
