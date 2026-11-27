-- Mythree – 0009: English spelling of the name for member IDs.
-- Members may write their name in Kannada, Devanagari or any script. When the name contains non-Latin
-- characters an English spelling is collected separately and used for the first four UID letters
-- (e.g. "सुब्रह्मण्य" + "Subramanya" → SUBR1234). Additive and backwards compatible: existing rows keep their UID.

alter table public.profiles
  add column name_english text check (name_english is null or name_english ~ '^[A-Za-z][A-Za-z .''-]{0,99}$');

grant update (name_english) on public.profiles to authenticated;

-- The UID uses the English spelling when present, otherwise the name itself.
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

  v_base := public.member_uid_base(coalesce(nullif(trim(v_p.name_english), ''), v_p.full_name),
                                   public.applicable_phone(v_p.date_of_birth, v_p.phone, v_p.guardian_phone));
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
revoke execute on function public.assign_member_uid(uuid) from public, anon, authenticated;

-- Sign-up: same as 0005 plus name_english (required when the name is not written in English letters).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role public.app_role := 'member';
  v_dob date;
  v_age integer;
  v_phone text := nullif(trim(m->>'phone'), '');
  v_gphone text := nullif(trim(m->>'guardian_phone'), '');
  v_name text := coalesce(nullif(trim(m->>'full_name'), ''), split_part(new.email, '@', 1));
  v_name_en text := nullif(trim(m->>'name_english'), '');
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
  if v_dob is not null and v_age < 18 and v_gphone is null then
    raise exception 'GUARDIAN_PHONE_REQUIRED' using errcode = '22023';
  end if;
  if v_dob is not null and v_age >= 18 and v_phone is null then
    raise exception 'PHONE_REQUIRED' using errcode = '22023';
  end if;
  -- A name in Kannada/Devanagari/… needs an English spelling for the member ID.
  if v_name_en is null and v_name ~ '[^\x01-\x7F]' then
    raise exception 'ENGLISH_NAME_REQUIRED' using errcode = '22023';
  end if;
  if v_name_en is not null and v_name_en !~ '^[A-Za-z][A-Za-z .''-]{0,99}$' then
    raise exception 'ENGLISH_NAME_INVALID' using errcode = '22023';
  end if;
  select registration_payment_required into v_required from public.app_settings where id = 1;

  insert into public.profiles (id, email, full_name, name_english, phone, age, date_of_birth, guardian_name, guardian_phone,
    exam_preference, address_line1, address_line2, city, state, pincode, country, role,
    registration_status, registration_confirmed_at)
  values (
    new.id, lower(new.email), v_name, v_name_en,
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

-- Backfill: members who were already confirmed before member IDs existed (registration_status defaults to
-- 'confirmed' for pre-existing rows in 0005) receive their permanent UID now. Names written in another
-- script are skipped (production had none on 27 Nov 2026); for such a row an operator sets name_english and
-- runs select public.assign_member_uid(<id>).
do $$
declare r record;
begin
  for r in select id from public.profiles
           where member_uid is null and registration_status = 'confirmed' and full_name !~ '[^\x01-\x7F]'
           order by created_at
  loop
    perform public.assign_member_uid(r.id);
  end loop;
end $$;
