-- Rollback 0006 (videos & challenge sets). DESTROYS video lessons, watch progress and challenge sets.
-- @restore 20261126000002_functions.sql get_challenge
-- @restore 20261126000002_functions.sql submit_challenge
drop function if exists public.admin_video_stats();
drop function if exists public.record_video_progress(uuid, integer);
drop function if exists public.my_videos();
drop function if exists public.active_challenge_set(public.challenge_kind);
alter table public.challenge_instances drop column if exists set_id;
drop table if exists public.challenge_sets;
drop table if exists public.video_progress;
drop table if exists public.video_lessons;
