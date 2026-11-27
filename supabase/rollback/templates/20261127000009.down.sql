-- Rollback 0009 (English spelling for member IDs). Existing UIDs are kept.
-- @restore 20261127000005_registration.sql handle_new_user
-- @restore 20261127000005_registration.sql assign_member_uid
revoke execute on function public.assign_member_uid(uuid) from public, anon, authenticated;
revoke update (name_english) on public.profiles from authenticated;
alter table public.profiles drop column if exists name_english;
