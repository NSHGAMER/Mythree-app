-- Mythree – 0005: mandatory registration fee, permanent member UID, date of birth,
-- adult/guardian contact rules and exam preference. Additive only: no data is deleted.
-- Existing members keep access (registration_status defaults to 'confirmed' for existing rows).

-- ---------------------------------------------------------------------------
-- Types and profile columns
-- ---------------------------------------------------------------------------
create type public.registration_status as enum ('pending_payment', 'confirmed', 'cancelled');
create type public.exam_mode as enum ('online', 'offline');

alter table public.profiles
  add column date_of_birth date check (date_of_birth >= date '1900-01-01'),
  add column guardian_name text check (char_length(guardian_name) between 2 and 100),
  add column guardian_phone text check (guardian_phone ~ '^\+[1-9][0-9]{7,14}$'),
  add column exam_preference public.exam_mode not null default 'offline',
  add column member_uid text unique check (member_uid ~ '^[A-Z]{4}[0-9]{4}(-[0-9]{1,3})?$'),
  add column registration_status public.registration_status not null default 'confirmed',
  add column registration_confirmed_at timestamptz,
  add column registration_note text check (char_length(registration_note) <= 300);

-- Agreed rule: phone numbers are NOT globally unique (siblings share a guardian's number).
alter table public.profiles drop constraint if exists profiles_phone_key;
create index if not exists profiles_phone_idx on public.profiles (phone);
create index if not exists profiles_guardian_phone_idx on public.profiles (guardian_phone);
create index if not exists profiles_registration_idx on public.profiles (registration_status, created_at desc);

alter table public.app_settings
  add column registration_fee integer not null default 151 check (registration_fee between 1 and 100000),
  add column registration_payment_required boolean not null default true;

-- Members may edit these new personal fields (UID, status and fee fields stay server-controlled).
grant update (date_of_birth, guardian_name, guardian_phone, exam_preference) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Age, applicable phone and UID
-- ---------------------------------------------------------------------------
create or replace function public.age_on(p_dob date, p_on date default null)
returns integer language sql stable set search_path = '' as $$
  select case when p_dob is null then null
              else extract(year from age(coalesce(p_on, public.ist_today()), p_dob))::integer end;
$$;

-- Adults (18+) use their own phone; minors use the guardian's phone. Legacy rows without DOB use own phone.
create or replace function public.applicable_phone(p_dob date, p_phone text, p_guardian_phone text)
returns text language sql stable set search_path = '' as $$
  select case when p_dob is not null and public.age_on(p_dob) < 18 then coalesce(p_guardian_phone, p_phone)
              else coalesce(p_phone, p_guardian_phone) end;
$$;

-- UID base: first four Latin letters of the name (spaces/punctuation ignored, padded with X),
-- followed by the last four digits of the applicable phone (left-padded with 0).
create or replace function public.member_uid_base(p_name text, p_phone text)
returns text language sql immutable set search_path = '' as $$
  select rpad(left(upper(regexp_replace(coalesce(p_name, ''), '[^A-Za-z]', '', 'g')), 4), 4, 'X')
      || lpad(right(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), 4), 4, '0');
$$;

-- Assigns a permanent UID once. Collisions get -2, -3 … ; an advisory lock per base makes
-- concurrent confirmations of e.g. two siblings safe, and the unique index is the final guard.
create or replace function public.assign_member_uid(p_user uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_p public.profiles;
  v_base text;
  v_candidate text;
  v_n integer := 1;
begin
  select * into v_p from public.profiles where id = p_user for update;
  if not found then raise exception 'MEMBER_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_p.member_uid is not null then return v_p.member_uid; end if;

  v_base := public.member_uid_base(v_p.full_name, public.applicable_phone(v_p.date_of_birth, v_p.phone, v_p.guardian_phone));
  perform pg_advisory_xact_lock(hashtext('member_uid:' || v_base));
  v_candidate := v_base;
  while exists (select 1 from public.profiles where member_uid = v_candidate) loop
    v_n := v_n + 1;
    if v_n > 999 then raise exception 'UID_SPACE_EXHAUSTED' using errcode = 'P0001'; end if;
    v_candidate := v_base || '-' || v_n;
  end loop;

  update public.profiles set member_uid = v_candidate where id = p_user;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'uid_assigned', 'profiles', p_user::text, jsonb_build_object('uid', v_candidate));
  return v_candidate;
end $$;

-- ---------------------------------------------------------------------------
-- Registration payments (separate from Guru Dakshina contributions)
-- ---------------------------------------------------------------------------
create table public.registration_payments (
  id uuid primary key default gen_random_uuid(),
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
  failure_reason text check (char_length(failure_reason) <= 300),
  manual_reference text check (char_length(manual_reference) <= 200),
  confirmed_by uuid,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  last_checked_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
-- Never more than one successful registration payment per member.
create unique index registration_payments_one_paid on public.registration_payments (user_id) where status = 'paid';
create index registration_payments_user_idx on public.registration_payments (user_id, created_at desc);
create index registration_payments_open_idx on public.registration_payments (created_at) where status = 'created';
create sequence public.registration_receipt_seq;
create trigger registration_payments_touch before update on public.registration_payments
  for each row execute function public.touch_updated_at();

alter table public.registration_payments enable row level security;
create policy registration_payments_read on public.registration_payments for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
revoke insert, update, delete on public.registration_payments from authenticated, anon;

-- ---------------------------------------------------------------------------
-- Sign-up trigger: DOB, guardian, exam preference, pending registration
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role public.app_role := 'member';
  v_dob date;
  v_age integer;
  v_phone text := nullif(trim(m->>'phone'), '');
  v_gphone text := nullif(trim(m->>'guardian_phone'), '');
  v_exam public.exam_mode := 'offline';
  v_required boolean;
begin
  if exists (select 1 from public.admin_allowlist a where a.email = lower(new.email)) then
    v_role := 'admin';
  end if;
  if coalesce(m->>'date_of_birth', '') ~ '^\d{4}-\d{2}-\d{2}$' then
    v_dob := (m->>'date_of_birth')::date;
    v_age := public.age_on(v_dob);
  elsif coalesce(m->>'age', '') ~ '^[0-9]{1,3}$' then
    v_age := (m->>'age')::integer;
  end if;
  if m->>'exam_preference' in ('online', 'offline') then
    v_exam := (m->>'exam_preference')::public.exam_mode;
  end if;
  -- Contact rule (also validated in the app): minors need a guardian phone, adults their own phone.
  if v_dob is not null and v_age < 18 and v_gphone is null then
    raise exception 'GUARDIAN_PHONE_REQUIRED' using errcode = '22023';
  end if;
  if v_dob is not null and v_age >= 18 and v_phone is null then
    raise exception 'PHONE_REQUIRED' using errcode = '22023';
  end if;
  select registration_payment_required into v_required from public.app_settings where id = 1;

  insert into public.profiles (id, email, full_name, phone, age, date_of_birth, guardian_name, guardian_phone,
    exam_preference, address_line1, address_line2, city, state, pincode, country, role,
    registration_status, registration_confirmed_at)
  values (
    new.id, lower(new.email),
    coalesce(nullif(trim(m->>'full_name'), ''), split_part(new.email, '@', 1)),
    v_phone, v_age, v_dob,
    nullif(trim(m->>'guardian_name'), ''), v_gphone, v_exam,
    nullif(trim(m->>'address_line1'), ''), nullif(trim(m->>'address_line2'), ''),
    nullif(trim(m->>'city'), ''), nullif(trim(m->>'state'), ''), nullif(trim(m->>'pincode'), ''),
    coalesce(nullif(trim(m->>'country'), ''), 'India'), v_role,
    case when v_role = 'admin' or not coalesce(v_required, true) then 'confirmed'::public.registration_status
         else 'pending_payment'::public.registration_status end,
    case when v_role = 'admin' or not coalesce(v_required, true) then now() end);

  if v_role = 'admin' or not coalesce(v_required, true) then
    perform public.assign_member_uid(new.id);
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Confirming a registration (service role from Edge Functions, or admin manual override)
-- ---------------------------------------------------------------------------
create or replace function public.confirm_registration(p_user uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_uid text; v_was public.registration_status; v_name text;
begin
  select registration_status, full_name into v_was, v_name from public.profiles where id = p_user for update;
  if not found then raise exception 'MEMBER_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_was <> 'confirmed' then
    update public.profiles set registration_status = 'confirmed', registration_confirmed_at = now(),
      -- the 180-day journey starts when access begins
      programme_start_date = public.ist_today()
    where id = p_user;
  end if;
  v_uid := public.assign_member_uid(p_user);
  if v_was <> 'confirmed' then
    insert into public.admin_notifications (kind, title, body, link, user_id)
    values ('registration', 'New member registered: ' || v_name, v_name || ' (' || v_uid || ') completed registration.',
            '/admin/registrations', p_user);
  end if;
  return v_uid;
end $$;

create or replace function public.mark_registration_paid(p_order_id text, p_payment_id text, p_amount_paise integer, p_method text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_r public.registration_payments; v_uid text;
begin
  select * into v_r from public.registration_payments where razorpay_order_id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_r.status = 'paid' then
    return jsonb_build_object('payment', to_jsonb(v_r), 'member_uid', (select member_uid from public.profiles where id = v_r.user_id), 'already', true);
  end if;
  if v_r.amount_paise <> p_amount_paise then raise exception 'AMOUNT_MISMATCH' using errcode = 'P0001'; end if;
  if exists (select 1 from public.registration_payments where user_id = v_r.user_id and status = 'paid') then
    -- A second captured payment for an already-paid member: record it for refund, never confirm twice.
    update public.registration_payments set status = 'failed', razorpay_payment_id = p_payment_id,
      failure_reason = 'DUPLICATE_PAYMENT_REFUND_REQUIRED', paid_at = now()
    where id = v_r.id returning * into v_r;
    insert into public.admin_notifications (kind, title, body, link, user_id)
    values ('payment_duplicate', 'Duplicate registration payment – refund needed',
            'Payment ' || p_payment_id || ' was captured for a member who had already paid.', '/admin/registrations', v_r.user_id);
    return jsonb_build_object('payment', to_jsonb(v_r), 'duplicate', true);
  end if;

  update public.registration_payments set status = 'paid', razorpay_payment_id = p_payment_id, payment_method = p_method,
    paid_at = now(), failure_reason = null,
    receipt_no = 'MYR-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY') || '-' ||
                 lpad(nextval('public.registration_receipt_seq')::text, 6, '0')
  where id = v_r.id returning * into v_r;
  v_uid := public.confirm_registration(v_r.user_id);
  return jsonb_build_object('payment', to_jsonb(v_r), 'member_uid', v_uid, 'already', false);
end $$;

create or replace function public.mark_registration_failed(p_order_id text, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.registration_payments set status = 'failed', failure_reason = left(p_reason, 300), last_checked_at = now()
  where razorpay_order_id = p_order_id and status = 'created';
end $$;

-- ---------------------------------------------------------------------------
-- Member: own registration status
-- ---------------------------------------------------------------------------
create or replace function public.my_registration()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_p public.profiles; v_s public.app_settings;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  select * into v_p from public.profiles where id = v_uid;
  select * into v_s from public.app_settings where id = 1;
  return jsonb_build_object(
    'status', v_p.registration_status, 'member_uid', v_p.member_uid, 'confirmed_at', v_p.registration_confirmed_at,
    'fee', v_s.registration_fee, 'payment_required', v_s.registration_payment_required,
    'exam_preference', v_p.exam_preference,
    'payments', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'status', r.status, 'amount_paise', r.amount_paise,
        'razorpay_order_id', r.razorpay_order_id, 'razorpay_payment_id', r.razorpay_payment_id, 'receipt_no', r.receipt_no,
        'created_at', r.created_at, 'paid_at', r.paid_at, 'failure_reason', r.failure_reason) order by r.created_at desc)
      from public.registration_payments r where r.user_id = v_uid), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------------
-- Access gate: learning/exam rows can only be created for confirmed members (or admins).
-- Implemented as triggers so every existing RPC is covered without being rewritten.
-- ---------------------------------------------------------------------------
create or replace function public.require_confirmed_registration() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles p where p.id = new.user_id
                 and (p.registration_status = 'confirmed' or p.role = 'admin')) then
    raise exception 'REGISTRATION_PENDING' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger test_attempts_require_registration before insert on public.test_attempts
  for each row execute function public.require_confirmed_registration();
create trigger challenge_instances_require_registration before insert on public.challenge_instances
  for each row execute function public.require_confirmed_registration();
create trigger exam_requests_require_registration before insert on public.exam_requests
  for each row execute function public.require_confirmed_registration();

-- ---------------------------------------------------------------------------
-- Admin: registrations list, UID lookup, manual confirmation (cash/offline payments)
-- ---------------------------------------------------------------------------
create or replace function public.admin_registrations(p_search text default null, p_status text default null,
  p_limit integer default 50, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_search text := nullif(trim(coalesce(p_search, '')), ''); v_total integer; v_rows jsonb;
begin
  perform public.assert_admin();
  if v_search is not null then
    v_search := '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;
  p_limit := least(greatest(coalesce(p_limit, 50), 1), 500);

  with base as (
    select p.* from public.profiles p
    where p.role = 'member'
      and (p_status is null or p_status = '' or p.registration_status::text = p_status)
      and (v_search is null or p.full_name ilike v_search or p.email ilike v_search or p.member_uid ilike v_search
           or p.phone ilike v_search or p.guardian_phone ilike v_search)
  )
  select (select count(*) from base),
         coalesce((select jsonb_agg(x) from (
           select jsonb_build_object('id', b.id, 'full_name', b.full_name, 'email', b.email, 'member_uid', b.member_uid,
             'phone', b.phone, 'guardian_name', b.guardian_name, 'guardian_phone', b.guardian_phone,
             'date_of_birth', b.date_of_birth, 'age', public.age_on(b.date_of_birth), 'exam_preference', b.exam_preference,
             'registration_status', b.registration_status, 'registration_confirmed_at', b.registration_confirmed_at,
             'created_at', b.created_at,
             'payment', (select jsonb_build_object('status', r.status, 'amount_paise', r.amount_paise, 'receipt_no', r.receipt_no,
                           'razorpay_payment_id', r.razorpay_payment_id, 'manual_reference', r.manual_reference,
                           'paid_at', r.paid_at, 'created_at', r.created_at)
                         from public.registration_payments r where r.user_id = b.id
                         order by (r.status = 'paid') desc, r.created_at desc limit 1)) x
           from base b order by b.created_at desc limit p_limit offset greatest(coalesce(p_offset, 0), 0)) s), '[]'::jsonb)
  into v_total, v_rows;
  return jsonb_build_object('total', v_total, 'rows', v_rows);
end $$;

create or replace function public.admin_confirm_registration(p_user uuid, p_reference text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_uid text; v_fee integer; v_p public.profiles;
begin
  perform public.assert_admin();
  if char_length(trim(coalesce(p_reference, ''))) < 3 then raise exception 'REFERENCE_REQUIRED' using errcode = '22023'; end if;
  select * into v_p from public.profiles where id = p_user;
  if not found then raise exception 'MEMBER_NOT_FOUND' using errcode = 'P0002'; end if;
  select registration_fee into v_fee from public.app_settings where id = 1;
  if not exists (select 1 from public.registration_payments where user_id = p_user and status = 'paid') then
    insert into public.registration_payments (user_id, payer_name, payer_email, amount_paise, status, idempotency_key,
      payment_method, manual_reference, confirmed_by, paid_at, receipt_no)
    values (p_user, v_p.full_name, v_p.email, v_fee * 100, 'paid', gen_random_uuid(), 'manual', trim(p_reference), auth.uid(), now(),
      'MYR-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY') || '-' || lpad(nextval('public.registration_receipt_seq')::text, 6, '0'));
  end if;
  v_uid := public.confirm_registration(p_user);
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'registration_manual_confirm', 'profiles', p_user::text, jsonb_build_object('reference', trim(p_reference), 'uid', v_uid));
  return v_uid;
end $$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
revoke execute on function public.assign_member_uid(uuid) from public, anon, authenticated;
revoke execute on function public.confirm_registration(uuid) from public, anon, authenticated;
revoke execute on function public.mark_registration_paid(text, text, integer, text) from public, anon, authenticated;
revoke execute on function public.mark_registration_failed(text, text) from public, anon, authenticated;
revoke execute on function public.require_confirmed_registration() from public, anon, authenticated;
grant execute on function public.mark_registration_paid(text, text, integer, text) to service_role;
grant execute on function public.mark_registration_failed(text, text) to service_role;
grant execute on function public.confirm_registration(uuid) to service_role;

revoke execute on function public.my_registration() from public, anon;
grant execute on function public.my_registration() to authenticated;
revoke execute on function public.admin_registrations(text, text, integer, integer) from public, anon;
grant execute on function public.admin_registrations(text, text, integer, integer) to authenticated;
revoke execute on function public.admin_confirm_registration(uuid, text) from public, anon;
grant execute on function public.admin_confirm_registration(uuid, text) to authenticated;

-- The phone pre-check is no longer used by registration (phones are not unique); keep it callable
-- only by signed-in users to remove the anonymous enumeration surface.
revoke execute on function public.check_phone_available(text) from public, anon;
grant execute on function public.check_phone_available(text) to authenticated;
