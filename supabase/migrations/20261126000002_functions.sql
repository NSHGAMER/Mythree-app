-- Mythree – संस्कृतगृहम्
-- 0002: business logic. Every function that changes XP, progress, payments or exam state
-- is SECURITY DEFINER with an empty search_path, validates auth.uid(), and is idempotent.

-- ---------------------------------------------------------------------------
-- Sign-up: create the profile from auth metadata
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role public.app_role := 'member';
  v_age integer;
begin
  if exists (select 1 from public.admin_allowlist a where a.email = lower(new.email)) then
    v_role := 'admin';
  end if;
  if coalesce(m->>'age', '') ~ '^[0-9]{1,3}$' then
    v_age := (m->>'age')::integer;
  end if;

  insert into public.profiles (id, email, full_name, phone, age, address_line1, address_line2, city, state, pincode, country, role)
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(trim(m->>'full_name'), ''), split_part(new.email, '@', 1)),
    nullif(trim(m->>'phone'), ''),
    v_age,
    nullif(trim(m->>'address_line1'), ''),
    nullif(trim(m->>'address_line2'), ''),
    nullif(trim(m->>'city'), ''),
    nullif(trim(m->>'state'), ''),
    nullif(trim(m->>'pincode'), ''),
    coalesce(nullif(trim(m->>'country'), ''), 'India'),
    v_role
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_email_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = lower(new.email) where id = new.id;
  end if;
  return new;
end $$;

create trigger on_auth_user_email_change after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- Rate limiting (fixed window). Returns true when the call is allowed.
-- ---------------------------------------------------------------------------
create or replace function public.check_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  insert into public.rate_limits as r (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update set
    count = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.count + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning count into v_count;
  return v_count <= p_max;
end $$;

create or replace function public.client_ip() returns text
language sql stable set search_path = '' as $$
  select coalesce(
    nullif(trim(split_part(coalesce(current_setting('request.headers', true), '{}')::json->>'x-forwarded-for', ',', 1)), ''),
    'unknown');
$$;

-- ---------------------------------------------------------------------------
-- Registration helper: is this phone number free? (rate limited per IP)
-- ---------------------------------------------------------------------------
create or replace function public.check_phone_available(p_phone text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.check_rate_limit('phone_check:' || public.client_ip(), 30, 3600) then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;
  if p_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'INVALID_PHONE' using errcode = 'P0001';
  end if;
  return not exists (select 1 from public.profiles where phone = p_phone);
end $$;

-- ---------------------------------------------------------------------------
-- XP, streaks, levels, badges
-- ---------------------------------------------------------------------------
create or replace function public.award_xp(p_user uuid, p_amount integer, p_reason text, p_ref text)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_inserted integer;
begin
  if p_amount = 0 then return 0; end if;
  insert into public.xp_events (user_id, amount, reason, ref_id)
  values (p_user, p_amount, p_reason, p_ref)
  on conflict (user_id, reason, ref_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return 0; end if;
  update public.profiles set xp = greatest(0, xp + p_amount) where id = p_user;
  return p_amount;
end $$;

create or replace function public.touch_activity(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_today date := public.ist_today();
begin
  update public.profiles p set
    current_streak = case
      when p.last_active_date = v_today then p.current_streak
      when p.last_active_date = v_today - 1 then p.current_streak + 1
      else 1 end,
    longest_streak = greatest(p.longest_streak, case
      when p.last_active_date = v_today then p.current_streak
      when p.last_active_date = v_today - 1 then p.current_streak + 1
      else 1 end),
    last_active_date = v_today,
    last_seen_at = now()
  where p.id = p_user;
end $$;

-- Streak shown to users: a streak is broken once a full IST day passes with no activity.
create or replace function public.effective_streak(p_last date, p_streak integer)
returns integer language sql stable set search_path = '' as $$
  select case when p_last is not null and p_last >= public.ist_today() - 1 then p_streak else 0 end;
$$;

create or replace function public.award_badges(p_user uuid)
returns text[] language plpgsql security definer set search_path = '' as $$
declare
  v_xp integer; v_streak integer; v_chapters integer; v_total integer;
  v_daily integer; v_weekly integer; v_perfect integer; v_exam boolean;
  v_new text[]; v_code text; v_bonus integer;
begin
  select xp, greatest(longest_streak, current_streak) into v_xp, v_streak from public.profiles where id = p_user;
  select count(*) into v_total from public.chapters where is_published;
  select count(*) into v_chapters from public.chapter_progress cp
    join public.chapters c on c.id = cp.chapter_id and c.is_published
    where cp.user_id = p_user and cp.status = 'completed';
  select count(*) filter (where kind = 'daily' and submitted_at is not null),
         count(*) filter (where kind = 'weekly' and passed)
    into v_daily, v_weekly from public.challenge_instances where user_id = p_user;
  select count(*) into v_perfect from public.test_attempts where user_id = p_user and submitted_at is not null and score = total and total > 0;
  select exists (select 1 from public.exam_requests where user_id = p_user and status <> 'cancelled') into v_exam;

  with inserted as (
    insert into public.user_badges (user_id, badge_code)
    select p_user, b.code from public.badges b
    where b.is_active
      and not exists (select 1 from public.user_badges ub where ub.user_id = p_user and ub.badge_code = b.code)
      and case b.criteria
        when 'xp' then v_xp >= b.threshold
        when 'streak' then v_streak >= b.threshold
        when 'chapters' then v_chapters >= b.threshold
        when 'all_chapters' then v_total > 0 and v_chapters >= v_total
        when 'daily' then v_daily >= b.threshold
        when 'weekly' then v_weekly >= b.threshold
        when 'perfect' then v_perfect >= b.threshold
        when 'exam_ready' then v_exam
        else false end
    on conflict do nothing
    returning badge_code
  )
  select coalesce(array_agg(badge_code), '{}') into v_new from inserted;

  foreach v_code in array v_new loop
    select xp_bonus into v_bonus from public.badges where code = v_code;
    if v_bonus > 0 then
      perform public.award_xp(p_user, v_bonus, 'badge', v_code);
    end if;
  end loop;
  return v_new;
end $$;

-- ---------------------------------------------------------------------------
-- Grading
-- ---------------------------------------------------------------------------
create or replace function public.normalize_answer(p text)
returns text language sql immutable set search_path = '' as $$
  select lower(regexp_replace(trim(coalesce(p, '')), '\s+', ' ', 'g'));
$$;

-- Grades answers for the given question ids. p_answers is {"<question_id>": "<answer>"}.
create or replace function public.grade_answers(p_qids uuid[], p_answers jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_review jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
      'question_id', q.id,
      'type', q.type,
      'prompt', q.prompt,
      'options', q.options,
      'given', p_answers->>(q.id::text),
      'correct', exists (select 1 from unnest(k.accepted_answers) a
                         where public.normalize_answer(a) = public.normalize_answer(p_answers->>(q.id::text))
                           and coalesce(p_answers->>(q.id::text), '') <> ''),
      'correct_answer', k.accepted_answers[1],
      'explanation', k.explanation
    ) order by array_position(p_qids, q.id)), '[]'::jsonb)
  into v_review
  from public.questions q
  join public.question_keys k on k.question_id = q.id
  where q.id = any (p_qids);
  return v_review;
end $$;

create or replace function public.questions_payload(p_qids uuid[])
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'type', q.type, 'prompt', q.prompt, 'options', q.options)
                  order by array_position(p_qids, q.id)), '[]'::jsonb)
  from public.questions q where q.id = any (p_qids);
$$;

-- ---------------------------------------------------------------------------
-- Chapter tests
-- ---------------------------------------------------------------------------
create or replace function public.chapter_is_unlocked(p_user uuid, p_chapter uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_pos integer; v_seq boolean;
begin
  select sequential_unlock into v_seq from public.app_settings where id = 1;
  select position into v_pos from public.chapters where id = p_chapter and is_published;
  if v_pos is null then return false; end if;
  if not coalesce(v_seq, true) then return true; end if;
  return not exists (
    select 1 from public.chapters c
    where c.is_published and c.position < v_pos
      and not exists (select 1 from public.chapter_progress cp
                      where cp.user_id = p_user and cp.chapter_id = c.id and cp.status = 'completed'));
end $$;

create or replace function public.start_chapter_test(p_chapter_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_ch public.chapters;
  v_att public.test_attempts;
  v_qids uuid[];
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  select * into v_ch from public.chapters where id = p_chapter_id and is_published;
  if not found then raise exception 'CHAPTER_NOT_FOUND' using errcode = 'P0002'; end if;
  if not public.chapter_is_unlocked(v_uid, p_chapter_id) then
    raise exception 'CHAPTER_LOCKED' using errcode = 'P0001';
  end if;
  if not public.check_rate_limit('test_start:' || v_uid, 30, 3600) then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;

  -- Resume an open attempt (e.g. after a refresh) instead of creating a new one.
  select * into v_att from public.test_attempts
   where user_id = v_uid and chapter_id = p_chapter_id and submitted_at is null
     and started_at > now() - interval '3 hours'
   order by started_at desc limit 1;

  if not found then
    select array_agg(s.id) into v_qids from (
      select q.id from public.questions q
      join public.question_keys k on k.question_id = q.id
      where q.chapter_id = p_chapter_id and q.is_active
      order by random()
      limit coalesce(v_ch.questions_per_test, 1000)) s;
    if v_qids is null then raise exception 'NO_QUESTIONS' using errcode = 'P0001'; end if;

    insert into public.test_attempts (user_id, chapter_id, question_ids)
    values (v_uid, p_chapter_id, v_qids) returning * into v_att;

    insert into public.chapter_progress as cp (user_id, chapter_id, status, started_at)
    values (v_uid, p_chapter_id, 'in_progress', now())
    on conflict (user_id, chapter_id) do update set
      status = case when cp.status = 'completed' then 'completed'::public.progress_status else 'in_progress'::public.progress_status end,
      started_at = coalesce(cp.started_at, now());
  end if;

  perform public.touch_activity(v_uid);

  return jsonb_build_object(
    'attempt_id', v_att.id,
    'started_at', v_att.started_at,
    'chapter', jsonb_build_object('id', v_ch.id, 'title', v_ch.title, 'title_sanskrit', v_ch.title_sanskrit,
                                  'position', v_ch.position, 'pass_percentage', v_ch.pass_percentage,
                                  'time_limit_minutes', v_ch.time_limit_minutes),
    'questions', public.questions_payload(v_att.question_ids));
end $$;

create or replace function public.submit_chapter_test(p_attempt_id uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_att public.test_attempts;
  v_ch public.chapters;
  v_review jsonb;
  v_score integer; v_total integer; v_pct numeric; v_passed boolean;
  v_prev_status public.progress_status;
  v_first_pass boolean := false;
  v_xp integer := 0;
  v_attempt_no integer;
  v_badges text[];
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'INVALID_ANSWERS' using errcode = '22023';
  end if;

  select * into v_att from public.test_attempts where id = p_attempt_id and user_id = v_uid for update;
  if not found then raise exception 'ATTEMPT_NOT_FOUND' using errcode = 'P0002'; end if;

  select * into v_ch from public.chapters where id = v_att.chapter_id;

  -- Idempotent: a re-submitted attempt returns the stored result.
  if v_att.submitted_at is not null then
    return jsonb_build_object('attempt_id', v_att.id, 'score', v_att.score, 'total', v_att.total,
      'percentage', v_att.percentage, 'passed', v_att.passed, 'xp_awarded', v_att.xp_awarded,
      'pass_percentage', v_ch.pass_percentage, 'review', v_att.review, 'new_badges', '[]'::jsonb,
      'chapter_completed', exists (select 1 from public.chapter_progress where user_id = v_uid and chapter_id = v_ch.id and status = 'completed'),
      'already_submitted', true);
  end if;

  v_review := public.grade_answers(v_att.question_ids, p_answers);
  select count(*) filter (where (r->>'correct')::boolean), count(*) into v_score, v_total
    from jsonb_array_elements(v_review) r;
  v_pct := case when v_total = 0 then 0 else round(100.0 * v_score / v_total, 2) end;
  v_passed := v_pct >= v_ch.pass_percentage;

  update public.test_attempts set submitted_at = now(), score = v_score, total = v_total, percentage = v_pct,
    passed = v_passed, answers = p_answers, review = v_review
  where id = v_att.id;

  select status into v_prev_status from public.chapter_progress where user_id = v_uid and chapter_id = v_ch.id for update;

  update public.chapter_progress set
    attempts_count = attempts_count + 1,
    best_percentage = greatest(best_percentage, v_pct),
    last_attempt_at = now(),
    status = case when v_passed then 'completed'::public.progress_status else status end,
    completed_at = case when v_passed and completed_at is null then now() else completed_at end
  where user_id = v_uid and chapter_id = v_ch.id
  returning attempts_count into v_attempt_no;

  if v_passed and coalesce(v_prev_status, 'not_started') <> 'completed' then
    v_first_pass := true;
    v_xp := v_xp + public.award_xp(v_uid, v_ch.xp_reward, 'chapter_pass', v_ch.id::text);
    if v_score = v_total then
      v_xp := v_xp + public.award_xp(v_uid, 20, 'chapter_perfect', v_ch.id::text);
    end if;
  elsif not v_passed and coalesce(v_prev_status, 'not_started') <> 'completed' and v_attempt_no <= 3 then
    -- Effort XP for the first three unsuccessful attempts only (no farming).
    v_xp := v_xp + public.award_xp(v_uid, 5, 'chapter_attempt', v_ch.id::text || ':' || v_attempt_no);
  end if;

  perform public.touch_activity(v_uid);
  v_badges := public.award_badges(v_uid);

  update public.test_attempts set xp_awarded = v_xp where id = v_att.id;

  return jsonb_build_object('attempt_id', v_att.id, 'score', v_score, 'total', v_total, 'percentage', v_pct,
    'passed', v_passed, 'xp_awarded', v_xp, 'pass_percentage', v_ch.pass_percentage, 'review', v_review,
    'first_pass', v_first_pass, 'chapter_completed', v_passed or coalesce(v_prev_status, 'not_started') = 'completed',
    'new_badges', coalesce((select jsonb_agg(jsonb_build_object('code', b.code, 'name', b.name, 'icon', b.icon, 'tier', b.tier))
                            from public.badges b where b.code = any (v_badges)), '[]'::jsonb),
    'already_submitted', false);
end $$;

-- ---------------------------------------------------------------------------
-- Daily & weekly challenges
-- ---------------------------------------------------------------------------
create or replace function public.challenge_period_key(p_kind public.challenge_kind)
returns text language sql stable set search_path = '' as $$
  select case when p_kind = 'daily' then to_char(public.ist_today(), 'YYYY-MM-DD')
              else to_char(public.ist_today(), 'IYYY-"W"IW') end;
$$;

create or replace function public.get_challenge(p_kind public.challenge_kind)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_key text := public.challenge_period_key(p_kind);
  v_inst public.challenge_instances;
  v_frontier integer;
  v_count integer;
  v_qids uuid[];
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;

  select * into v_inst from public.challenge_instances where user_id = v_uid and kind = p_kind and period_key = v_key;
  if not found then
    -- Question pool: chapters up to and including the member's current chapter.
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
    if v_qids is null then raise exception 'NO_QUESTIONS' using errcode = 'P0001'; end if;

    insert into public.challenge_instances (user_id, kind, period_key, question_ids)
    values (v_uid, p_kind, v_key, v_qids)
    on conflict (user_id, kind, period_key) do nothing;
    select * into v_inst from public.challenge_instances where user_id = v_uid and kind = p_kind and period_key = v_key;
  end if;

  return jsonb_build_object(
    'instance_id', v_inst.id, 'kind', v_inst.kind, 'period_key', v_inst.period_key,
    'submitted', v_inst.submitted_at is not null,
    'result', case when v_inst.submitted_at is null then null else jsonb_build_object(
        'score', v_inst.score, 'total', v_inst.total, 'percentage', v_inst.percentage,
        'passed', v_inst.passed, 'xp_awarded', v_inst.xp_awarded, 'review', v_inst.review) end,
    'questions', case when v_inst.submitted_at is null then public.questions_payload(v_inst.question_ids) else '[]'::jsonb end,
    'weekly_pass_percentage', (select weekly_pass_percentage from public.app_settings where id = 1));
end $$;

create or replace function public.submit_challenge(p_instance_id uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_inst public.challenge_instances;
  v_review jsonb;
  v_score integer; v_total integer; v_pct numeric; v_passed boolean;
  v_weekly_pass integer;
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

  select weekly_pass_percentage into v_weekly_pass from public.app_settings where id = 1;
  v_review := public.grade_answers(v_inst.question_ids, p_answers);
  select count(*) filter (where (r->>'correct')::boolean), count(*) into v_score, v_total
    from jsonb_array_elements(v_review) r;
  v_pct := case when v_total = 0 then 0 else round(100.0 * v_score / v_total, 2) end;
  v_passed := case when v_inst.kind = 'daily' then true else v_pct >= v_weekly_pass end;

  if v_inst.kind = 'daily' then
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

-- ---------------------------------------------------------------------------
-- Final exam readiness
-- ---------------------------------------------------------------------------
create or replace function public.exam_eligibility(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_total integer; v_done integer; v_weekly integer; v_required integer;
begin
  select count(*) into v_total from public.chapters where is_published;
  select count(*) into v_done from public.chapter_progress cp
    join public.chapters c on c.id = cp.chapter_id and c.is_published
    where cp.user_id = p_user and cp.status = 'completed';
  select count(*) into v_weekly from public.challenge_instances where user_id = p_user and kind = 'weekly' and passed;
  select final_exam_min_weekly_passed into v_required from public.app_settings where id = 1;
  return jsonb_build_object('eligible', v_total > 0 and v_done >= v_total and v_weekly >= coalesce(v_required, 0),
    'chapters_completed', v_done, 'chapters_total', v_total,
    'weekly_passed', v_weekly, 'weekly_required', coalesce(v_required, 0));
end $$;

create or replace function public.request_final_exam()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_elig jsonb;
  v_p public.profiles;
  v_req public.exam_requests;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;

  select * into v_req from public.exam_requests where user_id = v_uid and status <> 'cancelled';
  if found then return to_jsonb(v_req) || jsonb_build_object('already_requested', true); end if;

  v_elig := public.exam_eligibility(v_uid);
  if not (v_elig->>'eligible')::boolean then raise exception 'NOT_ELIGIBLE' using errcode = 'P0001'; end if;

  select * into v_p from public.profiles where id = v_uid;
  if v_p.address_line1 is null or v_p.pincode is null then
    raise exception 'ADDRESS_REQUIRED' using errcode = 'P0001';
  end if;

  insert into public.exam_requests (user_id, programme_start_date, days_taken, chapters_completed, address_snapshot)
  values (v_uid, v_p.programme_start_date, (public.ist_today() - v_p.programme_start_date) + 1,
    (v_elig->>'chapters_completed')::integer,
    jsonb_build_object('full_name', v_p.full_name, 'phone', v_p.phone, 'email', v_p.email,
      'address_line1', v_p.address_line1, 'address_line2', v_p.address_line2, 'city', v_p.city,
      'state', v_p.state, 'pincode', v_p.pincode, 'country', v_p.country))
  on conflict do nothing
  returning * into v_req;

  if v_req.id is null then
    select * into v_req from public.exam_requests where user_id = v_uid and status <> 'cancelled';
    return to_jsonb(v_req) || jsonb_build_object('already_requested', true);
  end if;

  insert into public.admin_notifications (kind, title, body, link, user_id)
  values ('exam_request', 'Final exam readiness: ' || v_p.full_name,
    v_p.full_name || ' completed all chapters in ' || v_req.days_taken || ' days and is ready for the final exam.',
    '/admin/exams', v_uid);

  perform public.touch_activity(v_uid);
  perform public.award_badges(v_uid);
  return to_jsonb(v_req) || jsonb_build_object('already_requested', false);
end $$;

-- ---------------------------------------------------------------------------
-- Member dashboard (one round trip)
-- ---------------------------------------------------------------------------
create or replace function public.my_dashboard()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_p public.profiles;
  v_s public.app_settings;
  v_chapters jsonb;
  v_total integer; v_done integer;
  v_current jsonb;
  v_week_start timestamptz;
  v_weekly_xp integer;
  v_rank integer;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  update public.profiles set last_seen_at = now()
   where id = v_uid and (last_seen_at is null or last_seen_at < now() - interval '5 minutes');
  select * into v_p from public.profiles where id = v_uid;
  select * into v_s from public.app_settings where id = 1;

  with ch as (
    select c.*, cp.status, cp.best_percentage, cp.attempts_count, cp.completed_at,
      coalesce(cp.status = 'completed', false) as done,
      (select count(*) from public.questions q where q.chapter_id = c.id and q.is_active) as question_count
    from public.chapters c
    left join public.chapter_progress cp on cp.chapter_id = c.id and cp.user_id = v_uid
    where c.is_published
  ), ordered as (
    select ch.*,
      (v_s.sequential_unlock and exists (select 1 from ch prev where prev.position < ch.position and not prev.done)) as locked
    from ch
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', o.id, 'position', o.position, 'title', o.title, 'title_sanskrit', o.title_sanskrit,
      'description', o.description, 'textbook_reference', o.textbook_reference,
      'learning_objectives', o.learning_objectives, 'pass_percentage', o.pass_percentage,
      'xp_reward', o.xp_reward, 'time_limit_minutes', o.time_limit_minutes,
      'question_count', least(o.question_count, coalesce(o.questions_per_test, o.question_count)),
      'status', coalesce(o.status::text, 'not_started'), 'best_percentage', coalesce(o.best_percentage, 0),
      'attempts', coalesce(o.attempts_count, 0), 'completed_at', o.completed_at, 'locked', o.locked)
      order by o.position), '[]'::jsonb),
    count(*), count(*) filter (where o.done)
  into v_chapters, v_total, v_done
  from ordered o;

  select e.value into v_current from jsonb_array_elements(v_chapters) e
   where e.value->>'status' <> 'completed' order by (e.value->>'position')::integer limit 1;

  v_week_start := (date_trunc('week', (now() at time zone 'Asia/Kolkata'))) at time zone 'Asia/Kolkata';
  select coalesce(sum(amount), 0) into v_weekly_xp from public.xp_events where user_id = v_uid and created_at >= v_week_start;
  select count(*) + 1 into v_rank from public.profiles
   where role = 'member' and show_on_leaderboard and xp > v_p.xp;

  return jsonb_build_object(
    'profile', jsonb_build_object('id', v_p.id, 'full_name', v_p.full_name, 'email', v_p.email, 'phone', v_p.phone,
       'phone_verified', v_p.phone_verified_at is not null, 'role', v_p.role, 'xp', v_p.xp,
       'current_streak', public.effective_streak(v_p.last_active_date, v_p.current_streak),
       'longest_streak', v_p.longest_streak, 'last_active_date', v_p.last_active_date,
       'programme_start_date', v_p.programme_start_date, 'created_at', v_p.created_at,
       'has_address', v_p.address_line1 is not null and v_p.pincode is not null),
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
    'weekly_xp', v_weekly_xp,
    'rank', v_rank,
    'badges_earned', (select count(*) from public.user_badges where user_id = v_uid),
    'badges_total', (select count(*) from public.badges where is_active),
    'recent_badges', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('code', b.code, 'name', b.name, 'icon', b.icon, 'tier', b.tier, 'awarded_at', ub.awarded_at) x
        from public.user_badges ub join public.badges b on b.code = ub.badge_code
        where ub.user_id = v_uid order by ub.awarded_at desc limit 4) t), '[]'::jsonb),
    'exam', public.exam_eligibility(v_uid) || jsonb_build_object('request',
        (select to_jsonb(er) - 'admin_notes' - 'updated_by' from public.exam_requests er
          where er.user_id = v_uid and er.status <> 'cancelled')),
    'contributed_paise', (select coalesce(sum(amount_paise), 0) from public.contributions where user_id = v_uid and status = 'paid'),
    'settings', jsonb_build_object('suggested_contribution', v_s.suggested_contribution,
       'require_phone_verification', v_s.require_phone_verification)
  );
end $$;

-- ---------------------------------------------------------------------------
-- Leaderboard
-- ---------------------------------------------------------------------------
create or replace function public.leaderboard(p_period text default 'all', p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_week_start timestamptz := (date_trunc('week', (now() at time zone 'Asia/Kolkata'))) at time zone 'Asia/Kolkata';
  v_rows jsonb; v_me jsonb;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  p_limit := least(greatest(coalesce(p_limit, 50), 1), 100);

  with scored as (
    select p.id, p.full_name, p.avatar_seed, p.show_on_leaderboard,
      public.effective_streak(p.last_active_date, p.current_streak) as streak,
      case when p_period = 'week' then coalesce(w.total, 0) else p.xp end as score
    from public.profiles p
    left join lateral (select sum(e.amount) as total from public.xp_events e
                       where e.user_id = p.id and e.created_at >= v_week_start) w on p_period = 'week'
    where p.role = 'member' and (p.show_on_leaderboard or p.id = v_uid)
  ), ranked as (
    select s.*, rank() over (order by s.score desc) as rnk from scored s
  )
  select
    (select coalesce(jsonb_agg(jsonb_build_object('rank', r.rnk, 'name',
        split_part(r.full_name, ' ', 1) || coalesce(' ' || nullif(left(split_part(r.full_name, ' ', 2), 1), '') || '.', ''),
        'score', r.score, 'streak', r.streak, 'is_me', r.id = v_uid, 'avatar_seed', coalesce(r.avatar_seed, r.id::text))
        order by r.rnk, r.full_name), '[]'::jsonb)
     from (select * from ranked where show_on_leaderboard order by rnk limit p_limit) r),
    (select jsonb_build_object('rank', r.rnk, 'score', r.score) from ranked r where r.id = v_uid)
  into v_rows, v_me;

  return jsonb_build_object('period', p_period, 'rows', v_rows, 'me', v_me);
end $$;

-- ---------------------------------------------------------------------------
-- FAQ chatbot: answers only from the approved knowledge base
-- ---------------------------------------------------------------------------
create or replace function public.faq_answer(p_query text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_q text := left(trim(coalesce(p_query, '')), 300);
  v_results jsonb;
  v_best_id uuid; v_best numeric;
begin
  if char_length(v_q) < 2 then return jsonb_build_object('matches', '[]'::jsonb); end if;
  if not public.check_rate_limit('faq:' || coalesce(auth.uid()::text, public.client_ip()), 60, 600) then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;

  with q as (
    select websearch_to_tsquery('simple', v_q) as tsq,
           to_tsquery('simple', coalesce(nullif(array_to_string(array(
             select regexp_replace(w, '[^[:alnum:]]', '', 'g') || ':*' from unnest(regexp_split_to_array(lower(v_q), '\s+')) w
             where char_length(regexp_replace(w, '[^[:alnum:]]', '', 'g')) >= 3), ' | '), ''), 'zzzzzz')) as prefix_q
  ), scored as (
    select f.id, f.question, f.answer, f.category,
      (ts_rank(f.search, q.tsq) * 2 + ts_rank(f.search, q.prefix_q) + extensions.similarity(f.question, v_q) * 1.5)::numeric as score
    from public.faqs f, q
    where f.is_published and (f.search @@ q.tsq or f.search @@ q.prefix_q or extensions.similarity(f.question, v_q) > 0.25)
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'question', s.question, 'answer', s.answer,
           'category', s.category, 'score', round(s.score, 3)) order by s.score desc), '[]'::jsonb)
    into v_results
  from (select * from scored order by score desc limit 3) s;

  v_best_id := nullif(v_results->0->>'id', '')::uuid;
  v_best := (v_results->0->>'score')::numeric;
  insert into public.chatbot_queries (user_id, query, matched_faq_id, confidence)
  values (auth.uid(), v_q, case when coalesce(v_best, 0) >= 0.08 then v_best_id end, least(coalesce(v_best, 0), 9.999));

  return jsonb_build_object('matches', v_results);
end $$;

-- ---------------------------------------------------------------------------
-- Public contact form (rate limited)
-- ---------------------------------------------------------------------------
create or replace function public.submit_contact_message(p_name text, p_email text, p_phone text, p_message text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.check_rate_limit('contact:' || coalesce(auth.uid()::text, public.client_ip()), 5, 3600) then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;
  if p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'INVALID_EMAIL' using errcode = '22023'; end if;
  insert into public.contact_messages (name, email, phone, message, user_id)
  values (trim(p_name), lower(trim(p_email)), nullif(trim(p_phone), ''), trim(p_message), auth.uid());
  insert into public.admin_notifications (kind, title, body, link)
  values ('contact', 'New contact message from ' || trim(p_name), left(trim(p_message), 200), '/admin/messages');
  return true;
end $$;

-- ---------------------------------------------------------------------------
-- Payments: called only by Edge Functions with the service role
-- ---------------------------------------------------------------------------
create or replace function public.mark_contribution_paid(p_order_id text, p_payment_id text, p_amount_paise integer, p_method text)
returns public.contributions language plpgsql security definer set search_path = '' as $$
declare v_c public.contributions;
begin
  select * into v_c from public.contributions where razorpay_order_id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_c.status = 'paid' then return v_c; end if;  -- idempotent (client verify + webhook may both arrive)
  if v_c.amount_paise <> p_amount_paise then raise exception 'AMOUNT_MISMATCH' using errcode = 'P0001'; end if;

  update public.contributions set status = 'paid', razorpay_payment_id = p_payment_id, payment_method = p_method,
    paid_at = now(), failure_reason = null,
    receipt_no = 'MYT-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY') || '-' ||
                 lpad(nextval('public.contribution_receipt_seq')::text, 6, '0')
  where id = v_c.id returning * into v_c;

  insert into public.admin_notifications (kind, title, body, link, user_id)
  select 'contribution', 'Guru Dakshina received', p.full_name || ' contributed ₹' || (v_c.amount_paise / 100.0)::numeric(12, 2),
         '/admin/contributions', v_c.user_id
  from public.profiles p where p.id = v_c.user_id;
  return v_c;
end $$;

create or replace function public.mark_contribution_failed(p_order_id text, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.contributions set status = 'failed', failure_reason = left(p_reason, 300)
  where razorpay_order_id = p_order_id and status = 'created';
end $$;

-- ---------------------------------------------------------------------------
-- Admin functions
-- ---------------------------------------------------------------------------
create or replace function public.assert_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
end $$;

create or replace function public.admin_member_overview(
  p_search text default null, p_filter text default 'all', p_sort text default 'registered_at',
  p_dir text default 'desc', p_limit integer default 50, p_offset integer default 0)
returns table (
  id uuid, full_name text, email text, phone text, phone_verified boolean, email_verified boolean,
  registered_at timestamptz, programme_start_date date, current_chapter text, current_chapter_position integer,
  completed_chapters integer, total_chapters integer, completion_pct numeric, last_active timestamptz,
  avg_score numeric, tests_taken integer, xp integer, current_streak integer, days_taken integer,
  exam_status text, exam_requested_at timestamptz, contributed boolean, contribution_total_paise bigint,
  city text, state text, total_count bigint)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare v_search text := nullif(trim(coalesce(p_search, '')), '');
begin
  perform public.assert_admin();
  if v_search is not null then
    v_search := '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;
  p_limit := least(greatest(coalesce(p_limit, 50), 1), 5000);

  return query
  with tc as (select count(*)::integer as n from public.chapters c where c.is_published),
  base as (
    select p.id as m_id, p.full_name as m_name, p.email as m_email, p.phone as m_phone,
      p.phone_verified_at is not null as m_pv, u.email_confirmed_at is not null as m_ev,
      p.created_at as m_created, p.programme_start_date as m_start,
      cur.title as m_cur, cur.position as m_cur_pos,
      coalesce(cp.n, 0) as m_done, tc.n as m_total,
      case when tc.n = 0 then 0::numeric else round(100.0 * coalesce(cp.n, 0) / tc.n, 1) end as m_pct,
      coalesce(p.last_seen_at, p.last_active_date::timestamptz, u.last_sign_in_at) as m_last,
      ta.avg_pct as m_avg, coalesce(ta.cnt, 0) as m_tests, p.xp as m_xp,
      public.effective_streak(p.last_active_date, p.current_streak) as m_streak,
      coalesce(er.days_taken, (public.ist_today() - p.programme_start_date) + 1) as m_days,
      coalesce(er.status::text, 'not_requested') as m_exam, er.requested_at as m_exam_at,
      coalesce(ct.total, 0) > 0 as m_contrib, coalesce(ct.total, 0)::bigint as m_contrib_total,
      p.city as m_city, p.state as m_state
    from public.profiles p
    join auth.users u on u.id = p.id
    cross join tc
    left join lateral (select count(*)::integer as n from public.chapter_progress x
                       join public.chapters c on c.id = x.chapter_id and c.is_published
                       where x.user_id = p.id and x.status = 'completed') cp on true
    left join lateral (select c.title, c.position from public.chapters c
                       where c.is_published and not exists (select 1 from public.chapter_progress x
                         where x.user_id = p.id and x.chapter_id = c.id and x.status = 'completed')
                       order by c.position limit 1) cur on true
    left join lateral (select round(avg(t.percentage), 1) as avg_pct, count(*)::integer as cnt
                       from public.test_attempts t where t.user_id = p.id and t.submitted_at is not null) ta on true
    left join lateral (select e.days_taken, e.status, e.requested_at from public.exam_requests e
                       where e.user_id = p.id and e.status <> 'cancelled' limit 1) er on true
    left join lateral (select sum(c.amount_paise) as total from public.contributions c
                       where c.user_id = p.id and c.status = 'paid') ct on true
    where p.role = 'member'
      and (v_search is null or p.full_name ilike v_search or p.email ilike v_search or p.phone ilike v_search
           or p.city ilike v_search)
  ), filtered as (
    select * from base b where case coalesce(p_filter, 'all')
      when 'not_started' then b.m_done = 0
      when 'in_progress' then b.m_done > 0 and b.m_done < b.m_total
      when 'completed' then b.m_total > 0 and b.m_done >= b.m_total
      when 'exam_ready' then b.m_exam <> 'not_requested'
      when 'contributed' then b.m_contrib
      when 'not_contributed' then not b.m_contrib
      when 'inactive' then b.m_last is null or b.m_last < now() - interval '14 days'
      when 'beyond_target' then b.m_days > (select s.programme_days from public.app_settings s where s.id = 1) and b.m_done < b.m_total
      else true end
  )
  select f.m_id, f.m_name, f.m_email, f.m_phone, f.m_pv, f.m_ev, f.m_created, f.m_start, f.m_cur, f.m_cur_pos,
    f.m_done, f.m_total, f.m_pct, f.m_last, f.m_avg, f.m_tests, f.m_xp, f.m_streak, f.m_days, f.m_exam,
    f.m_exam_at, f.m_contrib, f.m_contrib_total, f.m_city, f.m_state, count(*) over ()
  from filtered f
  order by
    case when p_sort = 'name' and p_dir = 'asc' then f.m_name end asc,
    case when p_sort = 'name' and p_dir <> 'asc' then f.m_name end desc,
    case when p_dir = 'asc' then case p_sort
      when 'progress' then f.m_pct when 'xp' then f.m_xp::numeric when 'score' then f.m_avg
      when 'days' then f.m_days::numeric when 'chapters' then f.m_done::numeric
      when 'contribution' then f.m_contrib_total::numeric end end asc nulls last,
    case when p_dir <> 'asc' then case p_sort
      when 'progress' then f.m_pct when 'xp' then f.m_xp::numeric when 'score' then f.m_avg
      when 'days' then f.m_days::numeric when 'chapters' then f.m_done::numeric
      when 'contribution' then f.m_contrib_total::numeric end end desc nulls last,
    case when p_dir = 'asc' then case p_sort when 'last_active' then f.m_last when 'registered_at' then f.m_created end end asc nulls last,
    case when p_dir <> 'asc' then case p_sort when 'last_active' then f.m_last when 'registered_at' then f.m_created end end desc nulls last,
    f.m_created desc
  limit p_limit offset greatest(coalesce(p_offset, 0), 0);
end $$;

create or replace function public.admin_member_detail(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_p public.profiles; v_u record;
begin
  perform public.assert_admin();
  select * into v_p from public.profiles where id = p_user;
  if not found then raise exception 'MEMBER_NOT_FOUND' using errcode = 'P0002'; end if;
  select email_confirmed_at, last_sign_in_at into v_u from auth.users where id = p_user;

  return jsonb_build_object(
    'profile', to_jsonb(v_p) || jsonb_build_object(
        'email_verified', v_u.email_confirmed_at is not null, 'last_sign_in_at', v_u.last_sign_in_at,
        'effective_streak', public.effective_streak(v_p.last_active_date, v_p.current_streak),
        'days_since_start', (public.ist_today() - v_p.programme_start_date) + 1),
    'chapters', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'position', c.position, 'title', c.title,
        'status', coalesce(cp.status::text, 'not_started'), 'best_percentage', coalesce(cp.best_percentage, 0),
        'attempts', coalesce(cp.attempts_count, 0), 'started_at', cp.started_at, 'completed_at', cp.completed_at,
        'pass_percentage', c.pass_percentage) order by c.position)
      from public.chapters c left join public.chapter_progress cp on cp.chapter_id = c.id and cp.user_id = p_user
      where c.is_published), '[]'::jsonb),
    'attempts', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'chapter', c.title, 'position', c.position,
        'started_at', t.started_at, 'submitted_at', t.submitted_at, 'score', t.score, 'total', t.total,
        'percentage', t.percentage, 'passed', t.passed, 'xp_awarded', t.xp_awarded) order by t.started_at desc)
      from public.test_attempts t join public.chapters c on c.id = t.chapter_id where t.user_id = p_user), '[]'::jsonb),
    'challenges', coalesce((select jsonb_agg(jsonb_build_object('kind', ci.kind, 'period_key', ci.period_key,
        'submitted_at', ci.submitted_at, 'score', ci.score, 'total', ci.total, 'passed', ci.passed,
        'xp_awarded', ci.xp_awarded) order by ci.created_at desc)
      from public.challenge_instances ci where ci.user_id = p_user), '[]'::jsonb),
    'badges', coalesce((select jsonb_agg(jsonb_build_object('code', b.code, 'name', b.name, 'icon', b.icon,
        'tier', b.tier, 'awarded_at', ub.awarded_at) order by ub.awarded_at)
      from public.user_badges ub join public.badges b on b.code = ub.badge_code where ub.user_id = p_user), '[]'::jsonb),
    'xp_events', coalesce((select jsonb_agg(x) from (select jsonb_build_object('amount', e.amount, 'reason', e.reason,
        'created_at', e.created_at) x from public.xp_events e where e.user_id = p_user order by e.created_at desc limit 100) s), '[]'::jsonb),
    'learning_minutes', (select coalesce(round(sum(extract(epoch from (least(t.submitted_at, t.started_at + interval '3 hours') - t.started_at))) / 60), 0)
      from public.test_attempts t where t.user_id = p_user and t.submitted_at is not null),
    'active_days', (select count(distinct (e.created_at at time zone 'Asia/Kolkata')::date) from public.xp_events e where e.user_id = p_user),
    'exam', (select to_jsonb(er) from public.exam_requests er where er.user_id = p_user order by er.requested_at desc limit 1),
    'eligibility', public.exam_eligibility(p_user),
    'contributions', coalesce((select jsonb_agg(jsonb_build_object('amount_paise', c.amount_paise, 'status', c.status,
        'receipt_no', c.receipt_no, 'created_at', c.created_at, 'paid_at', c.paid_at) order by c.created_at desc)
      from public.contributions c where c.user_id = p_user), '[]'::jsonb));
end $$;

create or replace function public.admin_analytics()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_total_ch integer;
begin
  perform public.assert_admin();
  select count(*) into v_total_ch from public.chapters where is_published;
  return jsonb_build_object(
    'members', (select count(*) from public.profiles where role = 'member'),
    'new_this_week', (select count(*) from public.profiles where role = 'member' and created_at > now() - interval '7 days'),
    'active_7d', (select count(*) from public.profiles where role = 'member' and last_seen_at > now() - interval '7 days'),
    'active_today', (select count(*) from public.profiles where role = 'member' and last_active_date = public.ist_today()),
    'total_chapters', v_total_ch,
    'completed_programme', (select count(*) from (select cp.user_id from public.chapter_progress cp
        join public.chapters c on c.id = cp.chapter_id and c.is_published where cp.status = 'completed'
        group by cp.user_id having count(*) >= v_total_ch and v_total_ch > 0) s),
    'exam_requests', (select jsonb_object_agg(status, n) from (select status, count(*) n from public.exam_requests group by status) s),
    'contributions_total_paise', (select coalesce(sum(amount_paise), 0) from public.contributions where status = 'paid'),
    'contributors', (select count(distinct user_id) from public.contributions where status = 'paid'),
    'tests_submitted', (select count(*) from public.test_attempts where submitted_at is not null),
    'avg_test_score', (select round(avg(percentage), 1) from public.test_attempts where submitted_at is not null),
    'registrations_by_week', coalesce((select jsonb_agg(jsonb_build_object('week', w, 'count', n) order by w) from (
        select to_char(date_trunc('week', created_at at time zone 'Asia/Kolkata'), 'YYYY-MM-DD') w, count(*) n
        from public.profiles where role = 'member' and created_at > now() - interval '12 weeks' group by 1) s), '[]'::jsonb),
    'activity_by_day', coalesce((select jsonb_agg(jsonb_build_object('day', d, 'active', n, 'xp', x) order by d) from (
        select to_char((e.created_at at time zone 'Asia/Kolkata')::date, 'YYYY-MM-DD') d, count(distinct e.user_id) n, sum(e.amount) x
        from public.xp_events e where e.created_at > now() - interval '30 days' group by 1) s), '[]'::jsonb),
    'chapter_stats', coalesce((select jsonb_agg(jsonb_build_object('position', c.position, 'title', c.title,
        'completed', (select count(*) from public.chapter_progress cp where cp.chapter_id = c.id and cp.status = 'completed'),
        'attempts', (select count(*) from public.test_attempts t where t.chapter_id = c.id and t.submitted_at is not null),
        'avg_score', (select round(avg(t.percentage), 1) from public.test_attempts t where t.chapter_id = c.id and t.submitted_at is not null),
        'pass_rate', (select round(100.0 * count(*) filter (where t.passed) / nullif(count(*), 0), 1)
                      from public.test_attempts t where t.chapter_id = c.id and t.submitted_at is not null))
        order by c.position) from public.chapters c where c.is_published), '[]'::jsonb),
    'progress_distribution', coalesce((select jsonb_agg(jsonb_build_object('bucket', bucket, 'count', n) order by bucket) from (
        select case when v_total_ch = 0 then 0 else least(4, floor(4.0 * coalesce(done, 0) / v_total_ch))::integer end bucket, count(*) n
        from public.profiles p left join (select cp.user_id, count(*) done from public.chapter_progress cp
            join public.chapters c on c.id = cp.chapter_id and c.is_published where cp.status = 'completed' group by cp.user_id) d
          on d.user_id = p.id
        where p.role = 'member' group by 1) s), '[]'::jsonb),
    'unread_notifications', (select count(*) from public.admin_notifications where read_at is null),
    'unanswered_questions_7d', (select count(*) from public.chatbot_queries where matched_faq_id is null and created_at > now() - interval '7 days'));
end $$;

create or replace function public.admin_update_exam_request(p_id uuid, p_status public.exam_status,
  p_courier text default null, p_tracking text default null, p_notes text default null)
returns public.exam_requests language plpgsql security definer set search_path = '' as $$
declare v_req public.exam_requests;
begin
  perform public.assert_admin();
  update public.exam_requests set status = p_status,
    courier = coalesce(p_courier, courier), tracking_number = coalesce(p_tracking, tracking_number),
    admin_notes = coalesce(p_notes, admin_notes),
    dispatched_at = case when p_status = 'paper_dispatched' and dispatched_at is null then now() else dispatched_at end,
    delivered_at = case when p_status = 'delivered' and delivered_at is null then now() else delivered_at end,
    updated_by = auth.uid()
  where id = p_id returning * into v_req;
  if not found then raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002'; end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'exam_status_update', 'exam_requests', p_id::text,
          jsonb_build_object('status', p_status, 'courier', p_courier, 'tracking', p_tracking));
  return v_req;
end $$;

create or replace function public.admin_exam_requests(p_status text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  return coalesce((select jsonb_agg(to_jsonb(er) || jsonb_build_object('full_name', p.full_name, 'email', p.email,
      'phone', p.phone, 'xp', p.xp) order by er.requested_at desc)
    from public.exam_requests er join public.profiles p on p.id = er.user_id
    where p_status is null or p_status = '' or er.status::text = p_status), '[]'::jsonb);
end $$;

create or replace function public.admin_contributions(p_limit integer default 500)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  return coalesce((select jsonb_agg(x) from (select jsonb_build_object('id', c.id, 'full_name', coalesce(p.full_name, c.payer_name, 'Deleted member'),
      'email', coalesce(p.email, c.payer_email), 'phone', p.phone, 'amount_paise', c.amount_paise, 'status', c.status, 'receipt_no', c.receipt_no,
      'razorpay_payment_id', c.razorpay_payment_id, 'payment_method', c.payment_method, 'created_at', c.created_at,
      'paid_at', c.paid_at) x
    from public.contributions c left join public.profiles p on p.id = c.user_id
    order by c.created_at desc limit least(greatest(p_limit, 1), 5000)) s), '[]'::jsonb);
end $$;

create or replace function public.admin_set_role(p_user uuid, p_role public.app_role)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  if p_role = 'member' and (select count(*) from public.profiles where role = 'admin') <= 1
     and exists (select 1 from public.profiles where id = p_user and role = 'admin') then
    raise exception 'LAST_ADMIN' using errcode = 'P0001';
  end if;
  update public.profiles set role = p_role where id = p_user;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'role_change', 'profiles', p_user::text, jsonb_build_object('role', p_role));
end $$;

create or replace function public.admin_save_question(p_question jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := nullif(p_question->>'id', '')::uuid;
  v_type public.question_type := (p_question->>'type')::public.question_type;
  v_options jsonb := coalesce(p_question->'options', '[]'::jsonb);
  v_answers text[];
begin
  perform public.assert_admin();
  select array_agg(trim(a)) into v_answers from jsonb_array_elements_text(coalesce(p_question->'accepted_answers', '[]'::jsonb)) a
   where trim(a) <> '';
  if v_answers is null then raise exception 'ANSWER_REQUIRED' using errcode = '22023'; end if;
  if v_type = 'mcq' then
    if jsonb_array_length(v_options) < 2 then raise exception 'OPTIONS_REQUIRED' using errcode = '22023'; end if;
    if v_answers[1] !~ '^[0-9]+$' or v_answers[1]::integer >= jsonb_array_length(v_options) then
      raise exception 'INVALID_MCQ_ANSWER' using errcode = '22023';
    end if;
  elsif v_type = 'true_false' then
    v_options := '["True", "False"]'::jsonb;
    if v_answers[1] not in ('true', 'false') then raise exception 'INVALID_TF_ANSWER' using errcode = '22023'; end if;
  else
    v_options := '[]'::jsonb;
  end if;

  if v_id is null then
    insert into public.questions (chapter_id, type, prompt, options, difficulty, position, is_active)
    values ((p_question->>'chapter_id')::uuid, v_type, trim(p_question->>'prompt'), v_options,
      coalesce((p_question->>'difficulty')::smallint, 1), coalesce((p_question->>'position')::integer, 0),
      coalesce((p_question->>'is_active')::boolean, true))
    returning id into v_id;
  else
    update public.questions set type = v_type, prompt = trim(p_question->>'prompt'), options = v_options,
      difficulty = coalesce((p_question->>'difficulty')::smallint, difficulty),
      position = coalesce((p_question->>'position')::integer, position),
      is_active = coalesce((p_question->>'is_active')::boolean, is_active)
    where id = v_id;
    if not found then raise exception 'QUESTION_NOT_FOUND' using errcode = 'P0002'; end if;
  end if;

  insert into public.question_keys (question_id, accepted_answers, explanation)
  values (v_id, v_answers, nullif(trim(p_question->>'explanation'), ''))
  on conflict (question_id) do update set accepted_answers = excluded.accepted_answers, explanation = excluded.explanation;
  return v_id;
end $$;

create or replace function public.admin_reorder_chapters(p_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  update public.chapters c set position = s.ord + 1000
    from unnest(p_ids) with ordinality s(id, ord) where c.id = s.id;
  update public.chapters c set position = s.ord
    from unnest(p_ids) with ordinality s(id, ord) where c.id = s.id;
end $$;

-- Audit settings changes
create or replace function public.audit_settings() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.updated_by := auth.uid();
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'settings_update', 'app_settings', '1', to_jsonb(new) - 'updated_at' - 'updated_by');
  return new;
end $$;
create trigger app_settings_audit before update on public.app_settings for each row execute function public.audit_settings();

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------
-- Internal helpers: no client access.
revoke execute on function public.award_xp(uuid, integer, text, text) from public, anon, authenticated;
revoke execute on function public.touch_activity(uuid) from public, anon, authenticated;
revoke execute on function public.award_badges(uuid) from public, anon, authenticated;
revoke execute on function public.grade_answers(uuid[], jsonb) from public, anon, authenticated;
revoke execute on function public.questions_payload(uuid[]) from public, anon, authenticated;
revoke execute on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.mark_contribution_paid(text, text, integer, text) from public, anon, authenticated;
revoke execute on function public.mark_contribution_failed(text, text) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_user_email_change() from public, anon, authenticated;
revoke execute on function public.chapter_is_unlocked(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.exam_eligibility(uuid) from public, anon, authenticated;
revoke execute on function public.audit_settings() from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;
grant execute on function public.mark_contribution_paid(text, text, integer, text) to service_role;
grant execute on function public.mark_contribution_failed(text, text) to service_role;

-- Member functions: signed-in users only.
do $$
declare f text;
begin
  foreach f in array array[
    'public.start_chapter_test(uuid)', 'public.submit_chapter_test(uuid, jsonb)',
    'public.get_challenge(public.challenge_kind)', 'public.submit_challenge(uuid, jsonb)',
    'public.request_final_exam()', 'public.my_dashboard()', 'public.leaderboard(text, integer)',
    'public.admin_member_overview(text, text, text, text, integer, integer)', 'public.admin_member_detail(uuid)',
    'public.admin_analytics()', 'public.admin_update_exam_request(uuid, public.exam_status, text, text, text)',
    'public.admin_exam_requests(text)', 'public.admin_contributions(integer)', 'public.admin_set_role(uuid, public.app_role)',
    'public.admin_save_question(jsonb)', 'public.admin_reorder_chapters(uuid[])', 'public.assert_admin()'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- Public functions (anon + authenticated): rate limited internally.
grant execute on function public.check_phone_available(text) to anon, authenticated;
grant execute on function public.faq_answer(text) to anon, authenticated;
grant execute on function public.submit_contact_message(text, text, text, text) to anon, authenticated;
