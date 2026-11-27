-- Staging only. Exam deadline enforcement + rate limiter. Rolled back by the final RAISE.
-- Expected: late_page/late_submit = EXAM_CLOSED, status_after = expired, uploads/paper closed,
-- restart returns the same (expired) session, rate_limit_sequence = [true,true,true,false].
do $t$
declare r jsonb := '{}'; u uuid; s jsonb; sid uuid; i int; arr boolean[] := '{}';
begin
  select id into u from public.profiles where email = 'loadtest+7@mythree.test';
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  s := public.start_exam(); sid := (s->>'id')::uuid;
  r := r || jsonb_build_object('started', s->>'status', 'grace_min', round(extract(epoch from ((s->>'upload_until')::timestamptz - (s->>'deadline_at')::timestamptz))/60));
  update public.exam_sessions set started_at = now() - interval '200 minutes', deadline_at = now() - interval '20 minutes', upload_until = now() - interval '5 minutes' where id = sid;
  begin perform public.register_exam_page(sid, 1, u || '/' || sid || '/p1.jpg', 10); r := r || '{"late_page":"ACCEPTED (bug)"}';
  exception when others then r := r || jsonb_build_object('late_page', sqlerrm); end;
  begin perform public.submit_exam(sid); r := r || '{"late_submit":"ACCEPTED (bug)"}';
  exception when others then r := r || jsonb_build_object('late_submit', sqlerrm); end;
  r := r || jsonb_build_object('can_upload_after_deadline', public.can_upload_answer_sheet(u || '/' || sid || '/p1.jpg'),
     'can_read_paper_after_deadline', public.can_read_question_paper('staging/paper.pdf'));
  s := public.my_exam();
  r := r || jsonb_build_object('status_after', s->'session'->>'status', 'paper_hidden', s->'session'->>'question_paper_path' is null);
  s := public.start_exam();
  r := r || jsonb_build_object('restart_gives_same_session', (s->>'id')::uuid = sid, 'restart_status', s->>'status');
  for i in 1..4 loop arr := arr || public.check_rate_limit('stg_test_key', 3, 60); end loop;
  r := r || jsonb_build_object('rate_limit_sequence', to_jsonb(arr));
  raise exception 'RESULTS %', r;
end $t$;
