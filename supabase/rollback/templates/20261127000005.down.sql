-- Rollback 0005 (registration fee & member IDs). DESTROYS registration payments, UIDs, DOB/guardian data.
-- Export registration_payments first if any real payment was taken.
drop trigger if exists test_attempts_require_registration on public.test_attempts;
drop trigger if exists challenge_instances_require_registration on public.challenge_instances;
drop trigger if exists exam_requests_require_registration on public.exam_requests;
-- @restore 20261126000002_functions.sql handle_new_user
drop function if exists public.require_confirmed_registration();
drop function if exists public.admin_confirm_registration(uuid, text);
drop function if exists public.admin_registrations(text, text, integer, integer);
drop function if exists public.my_registration();
drop function if exists public.mark_registration_failed(text, text);
drop function if exists public.mark_registration_paid(text, text, integer, text);
drop function if exists public.confirm_registration(uuid);
drop function if exists public.assign_member_uid(uuid);
drop function if exists public.member_uid_base(text, text);
drop function if exists public.applicable_phone(date, text, text);
drop table if exists public.registration_payments;
drop sequence if exists public.registration_receipt_seq;
revoke update (date_of_birth, guardian_name, guardian_phone, exam_preference) on public.profiles from authenticated;
drop index if exists public.profiles_phone_idx;
drop index if exists public.profiles_guardian_phone_idx;
drop index if exists public.profiles_registration_idx;
alter table public.profiles
  drop column if exists registration_note,
  drop column if exists registration_confirmed_at,
  drop column if exists registration_status,
  drop column if exists member_uid,
  drop column if exists exam_preference,
  drop column if exists guardian_phone,
  drop column if exists guardian_name,
  drop column if exists date_of_birth;
drop function if exists public.age_on(date, date);
alter table public.app_settings drop column if exists registration_payment_required, drop column if exists registration_fee;
drop type if exists public.registration_status;
drop type if exists public.exam_mode;
-- v1 required unique phone numbers. This fails (and the whole script rolls back) if members share a phone –
-- in that case clear or change the duplicate numbers first.
alter table public.profiles add constraint profiles_phone_key unique (phone);
grant execute on function public.check_phone_available(text) to anon, authenticated;
