-- Rollback 0007 (examinations). DESTROYS schedules, sessions, results and imports – export them first.
-- Storage objects cannot be deleted with SQL: empty the 'exam-papers' and 'answer-sheets' buckets in the
-- dashboard (Storage) BEFORE running this script, otherwise the bucket rows are kept.
drop policy if exists answer_sheets_insert on storage.objects;
drop policy if exists answer_sheets_delete_own on storage.objects;
drop policy if exists answer_sheets_read on storage.objects;
drop policy if exists answer_sheets_admin_delete on storage.objects;
drop policy if exists exam_papers_read on storage.objects;
drop policy if exists exam_papers_admin on storage.objects;
do $$ begin
  delete from storage.buckets b where b.id in ('exam-papers', 'answer-sheets')
    and not exists (select 1 from storage.objects o where o.bucket_id = b.id);
exception when others then raise notice 'buckets kept: %', sqlerrm; end $$;
drop function if exists public.admin_mark_session_purged(uuid);
drop function if exists public.admin_import_results(jsonb, uuid, numeric, text, boolean, boolean);
drop function if exists public.admin_publish_results(uuid);
drop function if exists public.admin_save_result(uuid, uuid, public.exam_mode, date, numeric, numeric, text, public.exam_result_status, boolean, boolean, text);
drop function if exists public.admin_exam_submissions(uuid, text);
drop function if exists public.admin_exam_cohorts();
drop function if exists public.submit_exam(uuid);
drop function if exists public.remove_exam_page(uuid, integer);
drop function if exists public.register_exam_page(uuid, integer, text, integer);
drop function if exists public.start_exam();
drop function if exists public.my_exam();
drop function if exists public.expire_exam_session(uuid);
drop function if exists public.can_read_question_paper(text);
drop function if exists public.can_upload_answer_sheet(text);
drop function if exists public.member_exam_schedule(uuid);
drop function if exists public.member_cohort_month(uuid);
drop function if exists public.suggested_exam_month(date);
drop table if exists public.result_imports;
drop table if exists public.exam_results;
drop table if exists public.exam_submission_pages;
drop table if exists public.exam_sessions;
alter table public.profiles drop column if exists exam_schedule_id;
drop table if exists public.exam_schedules;
drop type if exists public.exam_result_status;
drop type if exists public.exam_session_status;
