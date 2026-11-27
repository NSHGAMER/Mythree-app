-- Mythree – 0007: examination management.
-- Cohort schedules (registration month + 3), online exam sessions with a server-enforced 3-hour deadline,
-- private storage for question papers and answer-sheet photos, manual evaluation, result import and publication.
-- The existing readiness/dispatch flow (exam_requests) is preserved and reused.

-- ---------------------------------------------------------------------------
-- Schedules
-- ---------------------------------------------------------------------------
create table public.exam_schedules (
  id uuid primary key default gen_random_uuid(),
  cohort_month date not null unique check (extract(day from cohort_month) = 1), -- registration month
  title text not null default 'Mythree Final Examination',
  exam_starts_at timestamptz not null,
  entry_closes_at timestamptz not null,          -- latest moment an online member may press START
  duration_minutes integer not null default 180 check (duration_minutes between 10 and 600),
  upload_grace_minutes integer not null default 15 check (upload_grace_minutes between 0 and 120),
  max_marks numeric(6, 2) not null default 100 check (max_marks > 0),
  pass_marks numeric(6, 2) not null default 35 check (pass_marks >= 0),
  question_paper_path text,                      -- object in the private 'exam-papers' bucket
  instructions text check (char_length(instructions) <= 4000),
  is_published boolean not null default false,   -- members see the exact date only when published
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (entry_closes_at >= exam_starts_at),
  check (pass_marks <= max_marks)
);
create trigger exam_schedules_touch before update on public.exam_schedules for each row execute function public.touch_updated_at();

-- Optional per-member override (e.g. a member moved to another sitting)
alter table public.profiles add column exam_schedule_id uuid references public.exam_schedules (id) on delete set null;

-- Suggested date: first day of (registration month + 3 months); e.g. November → February.
create or replace function public.suggested_exam_month(p_registered date)
returns date language sql immutable set search_path = '' as $$
  select (date_trunc('month', p_registered) + interval '3 months')::date;
$$;

create or replace function public.member_cohort_month(p_user uuid)
returns date language sql stable security definer set search_path = '' as $$
  select date_trunc('month', (coalesce(registration_confirmed_at, created_at) at time zone 'Asia/Kolkata'))::date
  from public.profiles where id = p_user;
$$;

create or replace function public.member_exam_schedule(p_user uuid)
returns public.exam_schedules language sql stable security definer set search_path = '' as $$
  select s.* from public.exam_schedules s
  where s.id = coalesce((select exam_schedule_id from public.profiles where id = p_user),
                        (select s2.id from public.exam_schedules s2 where s2.cohort_month = public.member_cohort_month(p_user)));
$$;

-- ---------------------------------------------------------------------------
-- Online exam sessions and answer-sheet pages
-- ---------------------------------------------------------------------------
create type public.exam_session_status as enum ('in_progress', 'submitted', 'expired');

create table public.exam_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  schedule_id uuid not null references public.exam_schedules (id) on delete restrict,
  started_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  upload_until timestamptz not null,
  submitted_at timestamptz,
  status public.exam_session_status not null default 'in_progress',
  pages_count integer not null default 0,
  purged_at timestamptz,
  unique (user_id, schedule_id)
);
create index exam_sessions_schedule_idx on public.exam_sessions (schedule_id, status);

create table public.exam_submission_pages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.exam_sessions (id) on delete cascade,
  page_no integer not null check (page_no between 1 and 60),
  storage_path text not null unique,
  size_bytes integer not null check (size_bytes between 1 and 6000000),
  uploaded_at timestamptz not null default now(),
  unique (session_id, page_no)
);

-- ---------------------------------------------------------------------------
-- Results and imports
-- ---------------------------------------------------------------------------
create type public.exam_result_status as enum ('pass', 'fail', 'absent', 'withheld');

create table public.exam_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  schedule_id uuid references public.exam_schedules (id) on delete set null,
  exam_mode public.exam_mode not null,
  exam_date date,
  marks numeric(6, 2) check (marks >= 0),
  max_marks numeric(6, 2) not null check (max_marks > 0),
  remarks text check (char_length(remarks) <= 1000),
  result public.exam_result_status not null,
  source text not null default 'manual' check (source in ('manual', 'import')),
  evaluated_by uuid,
  evaluated_at timestamptz not null default now(),
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  check (marks is null or marks <= max_marks)
);
create unique index exam_results_one_per_sitting on public.exam_results (user_id, coalesce(schedule_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index exam_results_schedule_idx on public.exam_results (schedule_id, published_at);
create trigger exam_results_touch before update on public.exam_results for each row execute function public.touch_updated_at();

create table public.result_imports (
  id bigint generated always as identity primary key,
  file_name text not null,
  imported_by uuid,
  schedule_id uuid references public.exam_schedules (id) on delete set null,
  rows_total integer not null,
  rows_applied integer not null,
  rows_skipped integer not null,
  issues jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.exam_schedules enable row level security;
alter table public.exam_sessions enable row level security;
alter table public.exam_submission_pages enable row level security;
alter table public.exam_results enable row level security;
alter table public.result_imports enable row level security;

create policy exam_schedules_admin on public.exam_schedules for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy exam_sessions_read on public.exam_sessions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy exam_pages_read on public.exam_submission_pages for select to authenticated
  using ((select public.is_admin()) or exists (select 1 from public.exam_sessions s where s.id = session_id and s.user_id = (select auth.uid())));
-- Members see their own result only after publication.
create policy exam_results_read on public.exam_results for select to authenticated
  using ((select public.is_admin()) or (user_id = (select auth.uid()) and published_at is not null));
create policy result_imports_admin on public.result_imports for select to authenticated using ((select public.is_admin()));
revoke insert, update, delete on public.exam_sessions, public.exam_submission_pages, public.exam_results, public.result_imports from authenticated, anon;

-- ---------------------------------------------------------------------------
-- Storage: private buckets
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exam-papers', 'exam-papers', false, 20971520, array['application/pdf']),
       ('answer-sheets', 'answer-sheets', false, 6000000, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Upload allowed only into <user_id>/<session_id>/… of the member's own in-progress session, before upload_until.
create or replace function public.can_upload_answer_sheet(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.exam_sessions s
    where s.user_id = auth.uid()
      and split_part(p_name, '/', 1) = auth.uid()::text
      and split_part(p_name, '/', 2) = s.id::text
      and s.status = 'in_progress' and now() <= s.upload_until);
$$;

create or replace function public.can_read_question_paper(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or exists (
    select 1 from public.exam_sessions s join public.exam_schedules sc on sc.id = s.schedule_id
    where s.user_id = auth.uid() and sc.question_paper_path = p_name and now() <= s.upload_until);
$$;

create policy answer_sheets_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'answer-sheets' and public.can_upload_answer_sheet(name));
create policy answer_sheets_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'answer-sheets' and public.can_upload_answer_sheet(name));
create policy answer_sheets_read on storage.objects for select to authenticated
  using (bucket_id = 'answer-sheets' and (public.is_admin() or split_part(name, '/', 1) = auth.uid()::text));
create policy answer_sheets_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'answer-sheets' and public.is_admin());
create policy exam_papers_read on storage.objects for select to authenticated
  using (bucket_id = 'exam-papers' and public.can_read_question_paper(name));
create policy exam_papers_admin on storage.objects for all to authenticated
  using (bucket_id = 'exam-papers' and public.is_admin()) with check (bucket_id = 'exam-papers' and public.is_admin());

-- ---------------------------------------------------------------------------
-- Member RPCs
-- ---------------------------------------------------------------------------
-- Lazily mark sessions whose upload window has passed.
create or replace function public.expire_exam_session(p_session uuid)
returns void language sql security definer set search_path = '' as $$
  update public.exam_sessions set status = 'expired' where id = p_session and status = 'in_progress' and now() > upload_until;
$$;

create or replace function public.my_exam()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_p public.profiles;
  v_s public.exam_schedules;
  v_sess public.exam_sessions;
  v_req public.exam_requests;
  v_cohort date;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  select * into v_p from public.profiles where id = v_uid;
  v_cohort := public.member_cohort_month(v_uid);
  v_s := public.member_exam_schedule(v_uid);
  select * into v_req from public.exam_requests where user_id = v_uid and status <> 'cancelled';
  if v_s.id is not null then
    select * into v_sess from public.exam_sessions where user_id = v_uid and schedule_id = v_s.id;
    if v_sess.id is not null then perform public.expire_exam_session(v_sess.id); select * into v_sess from public.exam_sessions where id = v_sess.id; end if;
  end if;
  return jsonb_build_object(
    'member_uid', v_p.member_uid, 'exam_preference', v_p.exam_preference,
    'cohort_month', v_cohort, 'suggested_month', public.suggested_exam_month(v_cohort),
    'schedule', case when v_s.id is not null and v_s.is_published then jsonb_build_object(
        'id', v_s.id, 'title', v_s.title, 'exam_starts_at', v_s.exam_starts_at, 'entry_closes_at', v_s.entry_closes_at,
        'duration_minutes', v_s.duration_minutes, 'upload_grace_minutes', v_s.upload_grace_minutes,
        'max_marks', v_s.max_marks, 'instructions', v_s.instructions, 'has_paper', v_s.question_paper_path is not null) end,
    'readiness', case when v_req.id is not null then jsonb_build_object('status', v_req.status, 'requested_at', v_req.requested_at) end,
    'session', case when v_sess.id is not null then jsonb_build_object(
        'id', v_sess.id, 'status', v_sess.status, 'started_at', v_sess.started_at, 'deadline_at', v_sess.deadline_at,
        'upload_until', v_sess.upload_until, 'submitted_at', v_sess.submitted_at, 'pages_count', v_sess.pages_count,
        'question_paper_path', case when v_sess.status = 'in_progress' then v_s.question_paper_path end,
        'pages', coalesce((select jsonb_agg(jsonb_build_object('id', pg.id, 'page_no', pg.page_no, 'storage_path', pg.storage_path, 'size_bytes', pg.size_bytes) order by pg.page_no)
                 from public.exam_submission_pages pg where pg.session_id = v_sess.id), '[]'::jsonb)) end,
    'server_now', now(),
    'results', coalesce((select jsonb_agg(jsonb_build_object('exam_mode', r.exam_mode, 'exam_date', r.exam_date, 'marks', r.marks,
        'max_marks', r.max_marks, 'remarks', r.remarks, 'result', r.result, 'published_at', r.published_at) order by r.published_at desc)
      from public.exam_results r where r.user_id = v_uid and r.published_at is not null), '[]'::jsonb));
end $$;

create or replace function public.start_exam()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_p public.profiles;
  v_s public.exam_schedules;
  v_sess public.exam_sessions;
  v_deadline timestamptz;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  select * into v_p from public.profiles where id = v_uid;
  if v_p.registration_status <> 'confirmed' then raise exception 'REGISTRATION_PENDING' using errcode = 'P0001'; end if;
  v_s := public.member_exam_schedule(v_uid);
  if v_s.id is null or not v_s.is_published then raise exception 'EXAM_NOT_SCHEDULED' using errcode = 'P0001'; end if;

  -- An existing session is always resumable (e.g. after a refresh), even if the readiness status changed since START.
  select * into v_sess from public.exam_sessions where user_id = v_uid and schedule_id = v_s.id for update;
  if found then
    perform public.expire_exam_session(v_sess.id);
    return (select to_jsonb(s) || jsonb_build_object('already_started', true, 'server_now', now(),
              'question_paper_path', case when s.status = 'in_progress' then v_s.question_paper_path end)
            from public.exam_sessions s where s.id = v_sess.id);
  end if;
  if v_p.exam_preference <> 'online' then raise exception 'NOT_ONLINE_EXAM' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.exam_requests where user_id = v_uid and status in ('approved', 'paper_dispatched', 'delivered')) then
    raise exception 'EXAM_NOT_APPROVED' using errcode = 'P0001';
  end if;
  if now() < v_s.exam_starts_at then raise exception 'EXAM_NOT_OPEN' using errcode = 'P0001'; end if;
  if now() > v_s.entry_closes_at then raise exception 'EXAM_ENTRY_CLOSED' using errcode = 'P0001'; end if;
  if v_s.question_paper_path is null then raise exception 'PAPER_NOT_READY' using errcode = 'P0001'; end if;

  v_deadline := now() + make_interval(mins => v_s.duration_minutes);
  insert into public.exam_sessions (user_id, schedule_id, deadline_at, upload_until)
  values (v_uid, v_s.id, v_deadline, v_deadline + make_interval(mins => v_s.upload_grace_minutes))
  on conflict (user_id, schedule_id) do nothing
  returning * into v_sess;
  if v_sess.id is null then select * into v_sess from public.exam_sessions where user_id = v_uid and schedule_id = v_s.id; end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (v_uid, 'exam_started', 'exam_sessions', v_sess.id::text, jsonb_build_object('deadline', v_sess.deadline_at));
  return to_jsonb(v_sess) || jsonb_build_object('already_started', false, 'question_paper_path', v_s.question_paper_path, 'server_now', now());
end $$;

create or replace function public.register_exam_page(p_session uuid, p_page_no integer, p_path text, p_size integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_sess public.exam_sessions;
begin
  select * into v_sess from public.exam_sessions where id = p_session and user_id = v_uid for update;
  if not found then raise exception 'SESSION_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_sess.status <> 'in_progress' or now() > v_sess.upload_until then
    perform public.expire_exam_session(p_session);
    raise exception 'EXAM_CLOSED' using errcode = 'P0001';
  end if;
  if split_part(p_path, '/', 1) <> v_uid::text or split_part(p_path, '/', 2) <> p_session::text then
    raise exception 'INVALID_PATH' using errcode = '22023';
  end if;
  -- The file must really exist in storage (uploaded under the storage policy above).
  if not exists (select 1 from storage.objects o where o.bucket_id = 'answer-sheets' and o.name = p_path) then
    raise exception 'UPLOAD_NOT_FOUND' using errcode = 'P0002';
  end if;
  insert into public.exam_submission_pages (session_id, page_no, storage_path, size_bytes)
  values (p_session, p_page_no, p_path, p_size)
  on conflict (session_id, page_no) do update set storage_path = excluded.storage_path, size_bytes = excluded.size_bytes, uploaded_at = now();
  update public.exam_sessions set pages_count = (select count(*) from public.exam_submission_pages where session_id = p_session) where id = p_session;
  return jsonb_build_object('ok', true, 'pages_count', (select pages_count from public.exam_sessions where id = p_session));
end $$;

create or replace function public.remove_exam_page(p_session uuid, p_page_no integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_sess public.exam_sessions; v_path text;
begin
  select * into v_sess from public.exam_sessions where id = p_session and user_id = v_uid for update;
  if not found then raise exception 'SESSION_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_sess.status <> 'in_progress' or now() > v_sess.upload_until then raise exception 'EXAM_CLOSED' using errcode = 'P0001'; end if;
  delete from public.exam_submission_pages where session_id = p_session and page_no = p_page_no returning storage_path into v_path;
  update public.exam_sessions set pages_count = (select count(*) from public.exam_submission_pages where session_id = p_session) where id = p_session;
  return jsonb_build_object('removed_path', v_path);
end $$;

create or replace function public.submit_exam(p_session uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_sess public.exam_sessions;
begin
  select * into v_sess from public.exam_sessions where id = p_session and user_id = v_uid for update;
  if not found then raise exception 'SESSION_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_sess.status = 'submitted' then return to_jsonb(v_sess) || jsonb_build_object('already_submitted', true); end if;
  if now() > v_sess.upload_until then
    perform public.expire_exam_session(p_session);
    raise exception 'EXAM_CLOSED' using errcode = 'P0001';
  end if;
  if (select count(*) from public.exam_submission_pages where session_id = p_session) = 0 then
    raise exception 'NO_PAGES' using errcode = 'P0001';
  end if;
  update public.exam_sessions set status = 'submitted', submitted_at = now(),
    pages_count = (select count(*) from public.exam_submission_pages where session_id = p_session)
  where id = p_session returning * into v_sess;
  insert into public.admin_notifications (kind, title, body, link, user_id)
  select 'exam_submitted', 'Answer sheets submitted: ' || p.full_name, coalesce(p.member_uid, '') || ' submitted ' || v_sess.pages_count || ' page(s).', '/admin/evaluation', p.id
  from public.profiles p where p.id = v_uid;
  return to_jsonb(v_sess) || jsonb_build_object('already_submitted', false);
end $$;

-- ---------------------------------------------------------------------------
-- Admin RPCs
-- ---------------------------------------------------------------------------
-- Cohorts: registration months with member counts, the suggested month and any schedule.
create or replace function public.admin_exam_cohorts()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  return coalesce((select jsonb_agg(x order by (x->>'cohort_month') desc) from (
    select jsonb_build_object(
      'cohort_month', c.m, 'suggested_month', public.suggested_exam_month(c.m),
      'members', c.n, 'online', c.online, 'offline', c.offline, 'ready', c.ready,
      'schedule', (select to_jsonb(s) from public.exam_schedules s where s.cohort_month = c.m)) x
    from (select date_trunc('month', (coalesce(p.registration_confirmed_at, p.created_at) at time zone 'Asia/Kolkata'))::date m,
                 count(*) n, count(*) filter (where p.exam_preference = 'online') online,
                 count(*) filter (where p.exam_preference = 'offline') offline,
                 count(*) filter (where exists (select 1 from public.exam_requests e where e.user_id = p.id and e.status <> 'cancelled')) ready
          from public.profiles p where p.role = 'member' and p.registration_status = 'confirmed' group by 1) c
    union all
    select jsonb_build_object('cohort_month', s.cohort_month, 'suggested_month', public.suggested_exam_month(s.cohort_month),
      'members', 0, 'online', 0, 'offline', 0, 'ready', 0, 'schedule', to_jsonb(s))
    from public.exam_schedules s
    where not exists (select 1 from public.profiles p where p.role = 'member' and p.registration_status = 'confirmed'
                      and date_trunc('month', (coalesce(p.registration_confirmed_at, p.created_at) at time zone 'Asia/Kolkata'))::date = s.cohort_month)
  ) t), '[]'::jsonb);
end $$;

create or replace function public.admin_exam_submissions(p_schedule uuid default null, p_status text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  return coalesce((select jsonb_agg(jsonb_build_object(
      'session_id', s.id, 'user_id', p.id, 'member_uid', p.member_uid, 'full_name', p.full_name, 'email', p.email,
      'schedule_id', s.schedule_id, 'schedule_title', sc.title, 'exam_starts_at', sc.exam_starts_at, 'max_marks', sc.max_marks, 'pass_marks', sc.pass_marks,
      'status', case when s.status = 'in_progress' and now() > s.upload_until then 'expired' else s.status::text end,
      'started_at', s.started_at, 'deadline_at', s.deadline_at, 'submitted_at', s.submitted_at, 'pages_count', s.pages_count, 'purged_at', s.purged_at,
      'result', (select to_jsonb(r) from public.exam_results r where r.user_id = s.user_id and r.schedule_id = s.schedule_id))
      order by s.submitted_at desc nulls last, s.started_at desc)
    from public.exam_sessions s join public.profiles p on p.id = s.user_id join public.exam_schedules sc on sc.id = s.schedule_id
    where (p_schedule is null or s.schedule_id = p_schedule) and (p_status is null or p_status = '' or s.status::text = p_status)), '[]'::jsonb);
end $$;

-- Save (or update) a result. Published results are never changed silently: p_overwrite_published must be true.
create or replace function public.admin_save_result(p_user uuid, p_schedule uuid, p_mode public.exam_mode, p_exam_date date,
  p_marks numeric, p_max numeric, p_remarks text, p_result public.exam_result_status, p_publish boolean default false,
  p_overwrite_published boolean default false, p_source text default 'manual')
returns public.exam_results language plpgsql security definer set search_path = '' as $$
declare v_r public.exam_results; v_old public.exam_results;
begin
  perform public.assert_admin();
  if p_marks is not null and (p_marks < 0 or p_marks > p_max) then raise exception 'INVALID_MARKS' using errcode = '22023'; end if;
  select * into v_old from public.exam_results where user_id = p_user and coalesce(schedule_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(p_schedule, '00000000-0000-0000-0000-000000000000'::uuid) for update;
  if v_old.id is not null and v_old.published_at is not null and not p_overwrite_published then
    raise exception 'RESULT_ALREADY_PUBLISHED' using errcode = 'P0001';
  end if;
  if v_old.id is null then
    insert into public.exam_results (user_id, schedule_id, exam_mode, exam_date, marks, max_marks, remarks, result, source, evaluated_by, published_at)
    values (p_user, p_schedule, p_mode, p_exam_date, p_marks, p_max, nullif(trim(p_remarks), ''), p_result, p_source, auth.uid(), case when p_publish then now() end)
    returning * into v_r;
  else
    update public.exam_results set exam_mode = p_mode, exam_date = p_exam_date, marks = p_marks, max_marks = p_max,
      remarks = nullif(trim(p_remarks), ''), result = p_result, source = p_source, evaluated_by = auth.uid(), evaluated_at = now(),
      published_at = case when p_publish then coalesce(published_at, now()) else published_at end
    where id = v_old.id returning * into v_r;
  end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), case when v_old.id is null then 'result_created' else 'result_updated' end, 'exam_results', v_r.id::text,
          jsonb_build_object('user', p_user, 'marks', p_marks, 'result', p_result, 'published', p_publish, 'previous', to_jsonb(v_old)));
  if v_old.published_at is null and v_r.published_at is not null then
    -- mark the readiness request as completed for the dispatch view
    update public.exam_requests set status = 'exam_completed' where user_id = p_user and status <> 'cancelled';
  end if;
  return v_r;
end $$;

create or replace function public.admin_publish_results(p_schedule uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_n integer;
begin
  perform public.assert_admin();
  update public.exam_results set published_at = now() where schedule_id = p_schedule and published_at is null;
  get diagnostics v_n = row_count;
  update public.exam_requests e set status = 'exam_completed'
   where e.status <> 'cancelled' and exists (select 1 from public.exam_results r where r.user_id = e.user_id and r.schedule_id = p_schedule and r.published_at is not null);
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'results_published', 'exam_schedules', p_schedule::text, jsonb_build_object('count', v_n));
  return v_n;
end $$;

-- Excel/CSV import. p_rows = [{uid, marks, remarks, result, exam_mode?, exam_date?}]. Dry run returns the preview only.
create or replace function public.admin_import_results(p_rows jsonb, p_schedule uuid, p_max numeric, p_file_name text,
  p_dry_run boolean default true, p_publish boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r jsonb; v_user uuid; v_mode public.exam_mode; v_status text; v_marks numeric; v_date date;
  v_issues jsonb := '[]'::jsonb; v_ok jsonb := '[]'::jsonb; v_applied integer := 0; v_i integer := 0; v_seen text[] := '{}';
  v_sched public.exam_schedules;
begin
  perform public.assert_admin();
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'INVALID_FILE' using errcode = '22023'; end if;
  if jsonb_array_length(p_rows) > 5000 then raise exception 'TOO_MANY_ROWS' using errcode = '22023'; end if;
  select * into v_sched from public.exam_schedules where id = p_schedule;
  for r in select * from jsonb_array_elements(p_rows) loop
    v_i := v_i + 1;
    v_user := null; v_marks := null;
    select id, exam_preference into v_user, v_mode from public.profiles where member_uid = upper(trim(r->>'uid'));
    v_status := lower(trim(coalesce(r->>'result', '')));
    begin
      v_marks := nullif(trim(coalesce(r->>'marks', '')), '')::numeric;
    exception when others then
      v_issues := v_issues || jsonb_build_object('row', v_i, 'uid', r->>'uid', 'issue', 'Marks is not a number');
      continue;
    end;
    -- a bad date or exam mode in one row must not abort the whole import
    begin
      v_date := coalesce(nullif(trim(coalesce(r->>'exam_date', '')), '')::date, v_sched.exam_starts_at::date);
      if nullif(trim(coalesce(r->>'exam_mode', '')), '') is not null then
        v_mode := lower(trim(r->>'exam_mode'))::public.exam_mode;
      end if;
    exception when others then
      v_issues := v_issues || jsonb_build_object('row', v_i, 'uid', r->>'uid', 'issue', 'Exam date or mode is not valid');
      continue;
    end;
    if v_user is null then
      v_issues := v_issues || jsonb_build_object('row', v_i, 'uid', r->>'uid', 'issue', 'Unknown UID');
    elsif upper(trim(r->>'uid')) = any (v_seen) then
      v_issues := v_issues || jsonb_build_object('row', v_i, 'uid', r->>'uid', 'issue', 'UID appears more than once');
    elsif v_status not in ('pass', 'fail', 'absent', 'withheld') then
      v_issues := v_issues || jsonb_build_object('row', v_i, 'uid', r->>'uid', 'issue', 'Result must be PASS, FAIL, ABSENT or WITHHELD');
    elsif v_marks is not null and (v_marks < 0 or v_marks > p_max) then
      v_issues := v_issues || jsonb_build_object('row', v_i, 'uid', r->>'uid', 'issue', 'Marks outside 0–' || p_max);
    elsif exists (select 1 from public.exam_results x where x.user_id = v_user
                  and coalesce(x.schedule_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(p_schedule, '00000000-0000-0000-0000-000000000000'::uuid)
                  and x.published_at is not null) then
      v_issues := v_issues || jsonb_build_object('row', v_i, 'uid', r->>'uid', 'issue', 'Result already published – not changed');
    else
      v_seen := v_seen || upper(trim(r->>'uid'));
      v_ok := v_ok || jsonb_build_object('row', v_i, 'uid', upper(trim(r->>'uid')), 'marks', v_marks, 'result', v_status);
      if not p_dry_run then
        perform public.admin_save_result(v_user, p_schedule, v_mode, v_date,
          v_marks, p_max, r->>'remarks', v_status::public.exam_result_status, p_publish, false, 'import');
        v_applied := v_applied + 1;
      end if;
    end if;
  end loop;
  if not p_dry_run then
    insert into public.result_imports (file_name, imported_by, schedule_id, rows_total, rows_applied, rows_skipped, issues)
    values (left(coalesce(p_file_name, 'upload'), 200), auth.uid(), p_schedule, v_i, v_applied, v_i - v_applied, v_issues);
  end if;
  return jsonb_build_object('rows_total', v_i, 'valid', jsonb_array_length(v_ok), 'applied', v_applied, 'issues', v_issues, 'preview', v_ok, 'dry_run', p_dry_run);
end $$;

-- After answer sheets are downloaded (ZIP) the admin can free storage space.
create or replace function public.admin_mark_session_purged(p_session uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  if not exists (select 1 from public.exam_results r join public.exam_sessions s on s.user_id = r.user_id and s.schedule_id = r.schedule_id where s.id = p_session) then
    raise exception 'EVALUATE_BEFORE_PURGE' using errcode = 'P0001';
  end if;
  update public.exam_sessions set purged_at = now() where id = p_session;
  insert into public.audit_log (actor_id, action, entity, entity_id) values (auth.uid(), 'answer_sheets_purged', 'exam_sessions', p_session::text);
end $$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
revoke execute on function public.member_exam_schedule(uuid) from public, anon, authenticated;
revoke execute on function public.member_cohort_month(uuid) from public, anon, authenticated;
revoke execute on function public.expire_exam_session(uuid) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'public.my_exam()', 'public.start_exam()', 'public.register_exam_page(uuid, integer, text, integer)',
    'public.remove_exam_page(uuid, integer)', 'public.submit_exam(uuid)', 'public.admin_exam_cohorts()',
    'public.admin_exam_submissions(uuid, text)',
    'public.admin_save_result(uuid, uuid, public.exam_mode, date, numeric, numeric, text, public.exam_result_status, boolean, boolean, text)',
    'public.admin_publish_results(uuid)', 'public.admin_import_results(jsonb, uuid, numeric, text, boolean, boolean)',
    'public.admin_mark_session_purged(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
