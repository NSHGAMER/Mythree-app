-- Mythree – 0006: scheduled video lessons with server-verified watch progress, and admin-managed
-- daily/weekly challenge sets. Additive; existing auto-generated challenges keep working when no set is configured.

-- ---------------------------------------------------------------------------
-- Video lessons
-- ---------------------------------------------------------------------------
create table public.video_lessons (
  id uuid primary key default gen_random_uuid(),
  position integer not null check (position > 0),
  title text not null check (char_length(title) between 2 and 160),
  title_sanskrit text check (char_length(title_sanskrit) <= 160),
  description text check (char_length(description) <= 2000),
  provider text not null default 'youtube' check (provider in ('youtube', 'url')),
  video_ref text not null check (char_length(video_ref) between 5 and 500), -- YouTube id, or https URL of an MP4
  duration_seconds integer not null check (duration_seconds between 10 and 36000),
  chapter_id uuid references public.chapters (id) on delete set null,
  publish_at timestamptz not null default now(),
  is_published boolean not null default true,
  completion_percentage integer not null default 90 check (completion_percentage between 50 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index video_lessons_publish_idx on public.video_lessons (publish_at, position) where is_published;
create trigger video_lessons_touch before update on public.video_lessons for each row execute function public.touch_updated_at();

-- Watched seconds are tracked in 10-second buckets; a bucket is credited only when the player advances
-- through it at (up to) real-time speed, so seeking to the end or refreshing never marks a video complete.
create table public.video_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  video_id uuid not null references public.video_lessons (id) on delete cascade,
  watched_buckets text not null default '',
  watched_seconds integer not null default 0,
  last_position integer not null default 0,
  last_heartbeat_at timestamptz,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, video_id)
);
create index video_progress_completed_idx on public.video_progress (user_id) where completed_at is not null;

alter table public.video_lessons enable row level security;
alter table public.video_progress enable row level security;
create policy video_lessons_admin on public.video_lessons for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy video_progress_read on public.video_progress for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
revoke insert, update, delete on public.video_progress from authenticated, anon;

-- Members get lessons only through this RPC: published, scheduled time reached, registration confirmed.
create or replace function public.my_videos()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_ok boolean;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  select registration_status = 'confirmed' or role = 'admin' into v_ok from public.profiles where id = v_uid;
  if not coalesce(v_ok, false) then raise exception 'REGISTRATION_PENDING' using errcode = 'P0001'; end if;
  return jsonb_build_object(
    'videos', coalesce((select jsonb_agg(jsonb_build_object(
        'id', v.id, 'position', v.position, 'title', v.title, 'title_sanskrit', v.title_sanskrit, 'description', v.description,
        'provider', v.provider, 'video_ref', v.video_ref, 'duration_seconds', v.duration_seconds,
        'completion_percentage', v.completion_percentage, 'publish_at', v.publish_at, 'chapter_id', v.chapter_id,
        'watched_seconds', coalesce(p.watched_seconds, 0), 'last_position', coalesce(p.last_position, 0),
        'completed_at', p.completed_at) order by v.position, v.publish_at)
      from public.video_lessons v
      left join public.video_progress p on p.video_id = v.id and p.user_id = v_uid
      where v.is_published and v.publish_at <= now()), '[]'::jsonb),
    'upcoming', coalesce((select jsonb_agg(jsonb_build_object('position', v.position, 'title', v.title, 'publish_at', v.publish_at) order by v.publish_at)
      from public.video_lessons v where v.is_published and v.publish_at > now()), '[]'::jsonb));
end $$;

-- Heartbeat sent by the player every ~10 s while playing (and on pause/end).
create or replace function public.record_video_progress(p_video_id uuid, p_position integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_v public.video_lessons;
  v_p public.video_progress;
  v_buckets integer;
  v_bits text;
  v_elapsed numeric;
  v_from integer; v_to integer; i integer;
  v_watched integer;
  v_done boolean;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  select * into v_v from public.video_lessons where id = p_video_id and is_published and publish_at <= now();
  if not found then raise exception 'VIDEO_NOT_AVAILABLE' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.profiles where id = v_uid and (registration_status = 'confirmed' or role = 'admin')) then
    raise exception 'REGISTRATION_PENDING' using errcode = 'P0001';
  end if;
  p_position := least(greatest(coalesce(p_position, 0), 0), v_v.duration_seconds);
  v_buckets := ceil(v_v.duration_seconds / 10.0)::integer;

  insert into public.video_progress as vp (user_id, video_id, watched_buckets, last_position, last_heartbeat_at)
  values (v_uid, p_video_id, repeat('0', v_buckets), p_position, now())
  on conflict (user_id, video_id) do nothing;

  select * into v_p from public.video_progress where user_id = v_uid and video_id = p_video_id for update;
  v_bits := rpad(coalesce(v_p.watched_buckets, ''), v_buckets, '0');
  v_elapsed := extract(epoch from (now() - coalesce(v_p.last_heartbeat_at, now())));

  -- Credit only forward playback no faster than wall-clock time (+25 % for 1.25x speed, +3 s jitter).
  if p_position > v_p.last_position and (p_position - v_p.last_position) <= v_elapsed * 1.25 + 3 then
    v_from := v_p.last_position / 10;
    v_to := least((p_position - 1) / 10, v_buckets - 1);
    for i in v_from..v_to loop
      v_bits := overlay(v_bits placing '1' from i + 1 for 1);
    end loop;
  end if;

  v_watched := least(v_v.duration_seconds, (char_length(v_bits) - char_length(replace(v_bits, '1', ''))) * 10);
  v_done := v_p.completed_at is not null or v_watched * 100 >= v_v.duration_seconds * v_v.completion_percentage;

  update public.video_progress set watched_buckets = v_bits, watched_seconds = v_watched, last_position = p_position,
    last_heartbeat_at = now(), updated_at = now(),
    completed_at = case when v_done then coalesce(completed_at, now()) else null end
  where user_id = v_uid and video_id = p_video_id;

  if v_done and v_p.completed_at is null then
    perform public.award_xp(v_uid, 15, 'video_complete', p_video_id::text);
    perform public.touch_activity(v_uid);
  end if;

  return jsonb_build_object('watched_seconds', v_watched, 'completed', v_done,
    'percent', round(100.0 * v_watched / v_v.duration_seconds, 1));
end $$;

-- ---------------------------------------------------------------------------
-- Admin-managed daily / weekly challenge sets
-- ---------------------------------------------------------------------------
create table public.challenge_sets (
  id uuid primary key default gen_random_uuid(),
  kind public.challenge_kind not null,
  title text not null check (char_length(title) between 2 and 120),
  available_from date not null,
  available_to date not null,
  question_ids uuid[] not null check (cardinality(question_ids) between 1 and 50),
  xp_base integer not null default 10 check (xp_base between 0 and 500),
  xp_per_correct integer not null default 4 check (xp_per_correct between 0 and 100),
  pass_percentage integer check (pass_percentage between 1 and 100),
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (available_to >= available_from)
);
create index challenge_sets_active_idx on public.challenge_sets (kind, available_from, available_to) where is_active;
create trigger challenge_sets_touch before update on public.challenge_sets for each row execute function public.touch_updated_at();
alter table public.challenge_sets enable row level security;
create policy challenge_sets_admin on public.challenge_sets for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

alter table public.challenge_instances add column set_id uuid references public.challenge_sets (id) on delete set null;

create or replace function public.active_challenge_set(p_kind public.challenge_kind)
returns public.challenge_sets language sql stable security definer set search_path = '' as $$
  select * from public.challenge_sets
  where is_active and kind = p_kind and public.ist_today() between available_from and available_to
  order by available_from desc, created_at desc limit 1;
$$;

create or replace function public.get_challenge(p_kind public.challenge_kind)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_key text := public.challenge_period_key(p_kind);
  v_inst public.challenge_instances;
  v_set public.challenge_sets;
  v_frontier integer;
  v_count integer;
  v_qids uuid[];
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  select * into v_inst from public.challenge_instances where user_id = v_uid and kind = p_kind and period_key = v_key;
  if not found then
    v_set := public.active_challenge_set(p_kind);
    if v_set.id is not null then
      -- Admin-configured set: its questions (active ones only), in a per-member random order.
      select array_agg(q.id order by random()) into v_qids from public.questions q
        join public.question_keys k on k.question_id = q.id
        where q.id = any (v_set.question_ids) and q.is_active;
    else
      -- Fallback: auto-generated from chapters up to the member's current chapter.
      select coalesce(min(c.position), 2147483647) into v_frontier from public.chapters c
       where c.is_published and not exists (select 1 from public.chapter_progress cp
         where cp.user_id = v_uid and cp.chapter_id = c.id and cp.status = 'completed');
      select case when p_kind = 'daily' then daily_question_count else weekly_question_count end
        into v_count from public.app_settings where id = 1;
      select array_agg(s.id) into v_qids from (
        select q.id from public.questions q
        join public.chapters c on c.id = q.chapter_id and c.is_published and c.position <= v_frontier
        join public.question_keys k on k.question_id = q.id
        where q.is_active
        order by random() limit v_count) s;
    end if;
    if v_qids is null then raise exception 'NO_QUESTIONS' using errcode = 'P0001'; end if;
    insert into public.challenge_instances (user_id, kind, period_key, question_ids, set_id)
    values (v_uid, p_kind, v_key, v_qids, v_set.id)
    on conflict (user_id, kind, period_key) do nothing;
    select * into v_inst from public.challenge_instances where user_id = v_uid and kind = p_kind and period_key = v_key;
  end if;
  select * into v_set from public.challenge_sets where id = v_inst.set_id;

  return jsonb_build_object(
    'instance_id', v_inst.id, 'kind', v_inst.kind, 'period_key', v_inst.period_key,
    'title', v_set.title,
    'submitted', v_inst.submitted_at is not null,
    'result', case when v_inst.submitted_at is null then null else jsonb_build_object(
        'score', v_inst.score, 'total', v_inst.total, 'percentage', v_inst.percentage,
        'passed', v_inst.passed, 'xp_awarded', v_inst.xp_awarded, 'review', v_inst.review) end,
    'questions', case when v_inst.submitted_at is null then public.questions_payload(v_inst.question_ids) else '[]'::jsonb end,
    'weekly_pass_percentage', coalesce(v_set.pass_percentage, (select weekly_pass_percentage from public.app_settings where id = 1)));
end $$;

create or replace function public.submit_challenge(p_instance_id uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_inst public.challenge_instances;
  v_set public.challenge_sets;
  v_review jsonb;
  v_score integer; v_total integer; v_pct numeric; v_passed boolean;
  v_pass integer;
  v_xp integer := 0;
  v_badges text[];
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'INVALID_ANSWERS' using errcode = '22023';
  end if;
  select * into v_inst from public.challenge_instances where id = p_instance_id and user_id = v_uid for update;
  if not found then raise exception 'CHALLENGE_NOT_FOUND' using errcode = 'P0002'; end if;

  if v_inst.submitted_at is not null then
    return jsonb_build_object('score', v_inst.score, 'total', v_inst.total, 'percentage', v_inst.percentage,
      'passed', v_inst.passed, 'xp_awarded', v_inst.xp_awarded, 'review', v_inst.review,
      'new_badges', '[]'::jsonb, 'already_submitted', true);
  end if;
  if v_inst.period_key <> public.challenge_period_key(v_inst.kind) then
    raise exception 'CHALLENGE_EXPIRED' using errcode = 'P0001';
  end if;

  select * into v_set from public.challenge_sets where id = v_inst.set_id;
  v_pass := coalesce(v_set.pass_percentage, (select weekly_pass_percentage from public.app_settings where id = 1));
  v_review := public.grade_answers(v_inst.question_ids, p_answers);
  select count(*) filter (where (r->>'correct')::boolean), count(*) into v_score, v_total
    from jsonb_array_elements(v_review) r;
  v_pct := case when v_total = 0 then 0 else round(100.0 * v_score / v_total, 2) end;
  v_passed := case when v_inst.kind = 'daily' and v_set.pass_percentage is null then true else v_pct >= v_pass end;

  if v_set.id is not null then
    v_xp := public.award_xp(v_uid, case when v_passed then v_set.xp_base + v_set.xp_per_correct * v_score else least(v_set.xp_base, 20) end,
      v_inst.kind::text || '_challenge', v_inst.period_key);
  elsif v_inst.kind = 'daily' then
    v_xp := public.award_xp(v_uid, 10 + 4 * v_score, 'daily_challenge', v_inst.period_key);
  else
    v_xp := public.award_xp(v_uid, case when v_passed then 100 + 5 * v_score else 20 end, 'weekly_challenge', v_inst.period_key);
  end if;

  update public.challenge_instances set submitted_at = now(), score = v_score, total = v_total, percentage = v_pct,
    passed = v_passed, answers = p_answers, review = v_review, xp_awarded = v_xp
  where id = v_inst.id;

  perform public.touch_activity(v_uid);
  v_badges := public.award_badges(v_uid);

  return jsonb_build_object('score', v_score, 'total', v_total, 'percentage', v_pct, 'passed', v_passed,
    'xp_awarded', v_xp, 'review', v_review, 'already_submitted', false,
    'new_badges', coalesce((select jsonb_agg(jsonb_build_object('code', b.code, 'name', b.name, 'icon', b.icon, 'tier', b.tier))
                            from public.badges b where b.code = any (v_badges)), '[]'::jsonb));
end $$;

-- Admin overview of video completion per lesson
create or replace function public.admin_video_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'position', v.position, 'title', v.title,
      'publish_at', v.publish_at, 'is_published', v.is_published,
      'started', (select count(*) from public.video_progress p where p.video_id = v.id),
      'completed', (select count(*) from public.video_progress p where p.video_id = v.id and p.completed_at is not null),
      'avg_watched_pct', (select round(avg(100.0 * p.watched_seconds / v.duration_seconds), 1) from public.video_progress p where p.video_id = v.id))
    order by v.position) from public.video_lessons v), '[]'::jsonb);
end $$;

revoke execute on function public.active_challenge_set(public.challenge_kind) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['public.my_videos()', 'public.record_video_progress(uuid, integer)', 'public.admin_video_stats()'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
