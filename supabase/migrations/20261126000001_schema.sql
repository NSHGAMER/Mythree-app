-- Mythree – संस्कृतगृहम्
-- 0001: core schema, indexes, row level security
-- All business rules that touch XP, completion, payments and exam readiness live in
-- SECURITY DEFINER functions (0002). Members never write those tables directly.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'member');
create type public.question_type as enum ('mcq', 'true_false', 'fill_blank');
create type public.progress_status as enum ('not_started', 'in_progress', 'completed');
create type public.challenge_kind as enum ('daily', 'weekly');
create type public.contribution_status as enum ('created', 'paid', 'failed', 'refunded');
create type public.exam_status as enum (
  'requested', 'approved', 'paper_dispatched', 'delivered', 'exam_completed', 'on_hold', 'cancelled'
);

-- ---------------------------------------------------------------------------
-- Settings (singleton row, admin editable)
-- ---------------------------------------------------------------------------
create table public.app_settings (
  id smallint primary key default 1 check (id = 1),
  suggested_contribution integer not null default 151 check (suggested_contribution between 1 and 100000),
  min_contribution integer not null default 11 check (min_contribution between 1 and 100000),
  programme_days integer not null default 180 check (programme_days between 1 and 3650),
  default_pass_percentage integer not null default 70 check (default_pass_percentage between 1 and 100),
  sequential_unlock boolean not null default true,
  daily_question_count integer not null default 5 check (daily_question_count between 1 and 30),
  weekly_question_count integer not null default 10 check (weekly_question_count between 1 and 50),
  weekly_pass_percentage integer not null default 60 check (weekly_pass_percentage between 1 and 100),
  final_exam_min_weekly_passed integer not null default 0 check (final_exam_min_weekly_passed between 0 and 100),
  require_phone_verification boolean not null default false,
  contact_email text,
  contact_phone text,
  contact_whatsapp text,
  contact_address text,
  maintenance_mode boolean not null default false,
  maintenance_message text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

-- Emails that become admins automatically on sign-up
create table public.admin_allowlist (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null check (char_length(full_name) between 2 and 100),
  phone text unique check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  phone_verified_at timestamptz,
  age integer check (age between 5 and 120),
  address_line1 text check (char_length(address_line1) <= 200),
  address_line2 text check (char_length(address_line2) <= 200),
  city text check (char_length(city) <= 100),
  state text check (char_length(state) <= 100),
  pincode text check (pincode ~ '^[0-9A-Za-z -]{3,10}$'),
  country text not null default 'India',
  role public.app_role not null default 'member',
  programme_start_date date not null default ((now() at time zone 'Asia/Kolkata')::date),
  xp integer not null default 0 check (xp >= 0),
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_active_date date,
  last_seen_at timestamptz,
  show_on_leaderboard boolean not null default true,
  avatar_seed text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role);
create index profiles_xp_idx on public.profiles (xp desc) where role = 'member';
create index profiles_created_idx on public.profiles (created_at desc);
create index profiles_name_trgm on public.profiles using gin (full_name extensions.gin_trgm_ops);
create unique index profiles_email_key on public.profiles (lower(email));

-- ---------------------------------------------------------------------------
-- Curriculum
-- ---------------------------------------------------------------------------
create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  position integer not null check (position > 0),
  title text not null check (char_length(title) between 2 and 160),
  title_sanskrit text check (char_length(title_sanskrit) <= 160),
  description text check (char_length(description) <= 2000),
  textbook_reference text check (char_length(textbook_reference) <= 200),
  learning_objectives text[] not null default '{}',
  pass_percentage integer not null default 70 check (pass_percentage between 1 and 100),
  questions_per_test integer check (questions_per_test between 1 and 100),
  time_limit_minutes integer check (time_limit_minutes between 1 and 240),
  xp_reward integer not null default 100 check (xp_reward between 0 and 1000),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index chapters_position_idx on public.chapters (position) where is_published;

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  type public.question_type not null default 'mcq',
  prompt text not null check (char_length(prompt) between 1 and 1000),
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  difficulty smallint not null default 1 check (difficulty between 1 and 3),
  position integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index questions_chapter_idx on public.questions (chapter_id) where is_active;

-- Answer keys live in a separate table that members can never read.
create table public.question_keys (
  question_id uuid primary key references public.questions (id) on delete cascade,
  accepted_answers text[] not null check (cardinality(accepted_answers) >= 1),
  explanation text check (char_length(explanation) <= 2000)
);

-- ---------------------------------------------------------------------------
-- Learning progress
-- ---------------------------------------------------------------------------
create table public.chapter_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  status public.progress_status not null default 'not_started',
  best_percentage numeric(5, 2) not null default 0,
  attempts_count integer not null default 0,
  started_at timestamptz,
  last_attempt_at timestamptz,
  completed_at timestamptz,
  primary key (user_id, chapter_id)
);
create index chapter_progress_completed_idx on public.chapter_progress (user_id) where status = 'completed';
create index chapter_progress_chapter_idx on public.chapter_progress (chapter_id, status);

create table public.test_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  question_ids uuid[] not null,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score integer,
  total integer,
  percentage numeric(5, 2),
  passed boolean,
  answers jsonb,
  review jsonb,
  xp_awarded integer not null default 0
);
create index test_attempts_user_idx on public.test_attempts (user_id, started_at desc);
create index test_attempts_chapter_idx on public.test_attempts (chapter_id) where submitted_at is not null;
create index test_attempts_open_idx on public.test_attempts (user_id, chapter_id) where submitted_at is null;

create table public.challenge_instances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.challenge_kind not null,
  period_key text not null,
  question_ids uuid[] not null,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  score integer,
  total integer,
  percentage numeric(5, 2),
  passed boolean,
  answers jsonb,
  review jsonb,
  xp_awarded integer not null default 0,
  unique (user_id, kind, period_key)
);
create index challenge_instances_user_idx on public.challenge_instances (user_id, created_at desc);

-- Every XP grant is an event. The unique key makes each award idempotent.
create table public.xp_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null check (amount <> 0),
  reason text not null,
  ref_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, reason, ref_id)
);
create index xp_events_created_idx on public.xp_events (created_at desc, user_id);
create index xp_events_user_idx on public.xp_events (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Gamification
-- ---------------------------------------------------------------------------
create table public.badges (
  code text primary key check (code ~ '^[a-z0-9_]{2,40}$'),
  name text not null,
  name_sanskrit text,
  description text not null,
  icon text not null default 'award',
  criteria text not null check (criteria in ('xp', 'streak', 'chapters', 'all_chapters', 'daily', 'weekly', 'perfect', 'exam_ready')),
  threshold integer not null default 1,
  xp_bonus integer not null default 0 check (xp_bonus between 0 and 1000),
  tier text not null default 'bronze' check (tier in ('bronze', 'silver', 'gold', 'platinum')),
  sort_order integer not null default 0,
  is_active boolean not null default true
);

create table public.user_badges (
  user_id uuid not null references public.profiles (id) on delete cascade,
  badge_code text not null references public.badges (code) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_code)
);

-- ---------------------------------------------------------------------------
-- Guru Dakshina (voluntary contributions)
-- ---------------------------------------------------------------------------
create sequence public.contribution_receipt_seq;

create table public.contributions (
  id uuid primary key default gen_random_uuid(),
  -- Kept (with a payer snapshot) when a member deletes their account: payment records must be retained.
  user_id uuid references public.profiles (id) on delete set null,
  payer_name text,
  payer_email text,
  amount_paise integer not null check (amount_paise between 100 and 10000000),
  currency text not null default 'INR',
  status public.contribution_status not null default 'created',
  idempotency_key uuid not null,
  razorpay_order_id text unique,
  razorpay_payment_id text unique,
  payment_method text,
  receipt_no text unique,
  note text check (char_length(note) <= 300),
  failure_reason text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index contributions_user_idx on public.contributions (user_id, created_at desc);
create index contributions_status_idx on public.contributions (status, paid_at desc);

-- ---------------------------------------------------------------------------
-- Final exam readiness and dispatch
-- ---------------------------------------------------------------------------
create table public.exam_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  requested_at timestamptz not null default now(),
  programme_start_date date not null,
  days_taken integer not null,
  chapters_completed integer not null,
  address_snapshot jsonb not null,
  status public.exam_status not null default 'requested',
  courier text check (char_length(courier) <= 100),
  tracking_number text check (char_length(tracking_number) <= 100),
  dispatched_at timestamptz,
  delivered_at timestamptz,
  admin_notes text check (char_length(admin_notes) <= 2000),
  notified_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create unique index exam_requests_active_user on public.exam_requests (user_id) where status <> 'cancelled';
create index exam_requests_status_idx on public.exam_requests (status, requested_at desc);

-- ---------------------------------------------------------------------------
-- Admin notifications, audit, support
-- ---------------------------------------------------------------------------
create table public.admin_notifications (
  id bigint generated always as identity primary key,
  kind text not null,
  title text not null,
  body text,
  link text,
  user_id uuid references public.profiles (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index admin_notifications_unread_idx on public.admin_notifications (created_at desc) where read_at is null;

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);

-- array_to_string() is only STABLE, so wrap the vector in an IMMUTABLE helper for the generated column.
create or replace function public.faq_search_vector(q text, kw text[], a text) returns tsvector
language sql immutable parallel safe set search_path = '' as $$
  select setweight(to_tsvector('simple'::regconfig, coalesce(q, '')), 'A') ||
         setweight(to_tsvector('simple'::regconfig, coalesce(array_to_string(kw, ' '), '')), 'A') ||
         setweight(to_tsvector('simple'::regconfig, coalesce(a, '')), 'C');
$$;

create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null check (char_length(question) between 3 and 300),
  answer text not null check (char_length(answer) between 1 and 4000),
  keywords text[] not null default '{}',
  category text not null default 'General',
  is_published boolean not null default true,
  sort_order integer not null default 0,
  search tsvector generated always as (public.faq_search_vector(question, keywords, answer)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index faqs_search_idx on public.faqs using gin (search);
create index faqs_question_trgm on public.faqs using gin (question extensions.gin_trgm_ops);

create table public.chatbot_queries (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id) on delete set null,
  query text not null check (char_length(query) <= 500),
  matched_faq_id uuid references public.faqs (id) on delete set null,
  confidence numeric(4, 3),
  created_at timestamptz not null default now()
);
create index chatbot_queries_unmatched_idx on public.chatbot_queries (created_at desc) where matched_faq_id is null;

create table public.contact_messages (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 2 and 100),
  email text not null check (char_length(email) <= 200),
  phone text check (char_length(phone) <= 20),
  message text not null check (char_length(message) between 5 and 3000),
  user_id uuid references public.profiles (id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);

-- Server-side rate limiting buckets and OTP codes: service role / definer functions only.
create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count integer not null
);

create table public.otp_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  phone text not null,
  code_hash text not null,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index otp_codes_user_idx on public.otp_codes (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger chapters_touch before update on public.chapters for each row execute function public.touch_updated_at();
create trigger questions_touch before update on public.questions for each row execute function public.touch_updated_at();
create trigger faqs_touch before update on public.faqs for each row execute function public.touch_updated_at();
create trigger contributions_touch before update on public.contributions for each row execute function public.touch_updated_at();
create trigger exam_requests_touch before update on public.exam_requests for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.app_settings for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Helpers used by policies
-- ---------------------------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.ist_today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Kolkata')::date;
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.app_settings enable row level security;
alter table public.admin_allowlist enable row level security;
alter table public.profiles enable row level security;
alter table public.chapters enable row level security;
alter table public.questions enable row level security;
alter table public.question_keys enable row level security;
alter table public.chapter_progress enable row level security;
alter table public.test_attempts enable row level security;
alter table public.challenge_instances enable row level security;
alter table public.xp_events enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.contributions enable row level security;
alter table public.exam_requests enable row level security;
alter table public.admin_notifications enable row level security;
alter table public.audit_log enable row level security;
alter table public.faqs enable row level security;
alter table public.chatbot_queries enable row level security;
alter table public.contact_messages enable row level security;
alter table public.rate_limits enable row level security;
alter table public.otp_codes enable row level security;

-- Settings: everyone can read (public contact info, programme length); admins edit.
create policy settings_read on public.app_settings for select using (true);
create policy settings_admin_update on public.app_settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy allowlist_admin on public.admin_allowlist for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Profiles: own row or admin. Members may update only whitelisted columns (see grants below).
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Curriculum: members see published content; admins manage everything.
create policy chapters_read on public.chapters for select to authenticated
  using (is_published or (select public.is_admin()));
create policy chapters_admin on public.chapters for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy questions_admin on public.questions for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
-- Members receive questions only through start_chapter_test / get_challenge.

create policy question_keys_admin on public.question_keys for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Progress & history: read own, admins read all. Writes only via definer functions.
create policy progress_read on public.chapter_progress for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy attempts_read on public.test_attempts for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy challenges_read on public.challenge_instances for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy xp_read on public.xp_events for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy user_badges_read on public.user_badges for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy badges_read on public.badges for select to authenticated using (true);
create policy badges_admin on public.badges for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy contributions_read on public.contributions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy exam_read on public.exam_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy notifications_admin on public.admin_notifications for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy audit_admin_read on public.audit_log for select to authenticated using ((select public.is_admin()));

create policy faqs_read on public.faqs for select using (is_published or (select public.is_admin()));
create policy faqs_admin on public.faqs for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy chatbot_admin_read on public.chatbot_queries for select to authenticated using ((select public.is_admin()));
create policy contact_admin on public.contact_messages for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
-- rate_limits, otp_codes: no policies -> no client access at all.

-- ---------------------------------------------------------------------------
-- Column-level privileges: members can only edit personal details.
-- ---------------------------------------------------------------------------
revoke update on public.profiles from authenticated, anon;
grant update (full_name, phone, age, address_line1, address_line2, city, state, pincode, country,
  show_on_leaderboard, avatar_seed) on public.profiles to authenticated;
revoke insert, delete on public.profiles from authenticated, anon;

-- Tables that are written only by definer functions or the service role
revoke insert, update, delete on public.chapter_progress, public.test_attempts, public.challenge_instances,
  public.xp_events, public.user_badges, public.contributions, public.exam_requests, public.otp_codes,
  public.rate_limits, public.chatbot_queries from authenticated, anon;
revoke all on public.otp_codes, public.rate_limits from authenticated, anon;
revoke insert on public.contact_messages from anon;

-- Changing a phone number clears its verification
create or replace function public.profiles_phone_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.phone is distinct from old.phone then
    new.phone_verified_at := null;
  end if;
  return new;
end $$;
create trigger profiles_phone_guard before update on public.profiles
  for each row execute function public.profiles_phone_guard();
