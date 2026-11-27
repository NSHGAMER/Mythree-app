-- Staging only. Sign-up validation, UIDs (siblings / shared phones / short and non-Latin names),
-- registration payment idempotency and duplicate handling. Rolled back by the final RAISE.
-- Expected (27 Nov 2026 run): SUBR3210, ALXX0007, XXXX3210, ABRA1234; GUARDIAN_PHONE_REQUIRED; PHONE_REQUIRED;
-- pending_gate = REGISTRATION_PENDING; AMOUNT_MISMATCH; first payment → ANAN5678 + MYR-YYYY-000001; replay already=true;
-- second order → duplicate=true, failed, DUPLICATE_PAYMENT_REFUND_REQUIRED; sibling ANAN5678-2; parent PARE5678;
-- late failure event leaves the paid row paid; ORDER_NOT_FOUND; one-paid unique index rejects a second paid row.
do $t$
declare r jsonb := '{}'; u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid();
  x jsonb; ch uuid; kid_dob text := to_char(now() - interval '12 years', 'YYYY-MM-DD');
begin
  r := r || jsonb_build_object('uid_base_normal', public.member_uid_base('Subramanya H', '+919876543210'),
     'uid_base_short', public.member_uid_base('Al', '+91 98765 00007'),
     'uid_base_devanagari', public.member_uid_base('सुब्रह्मण्य', '+919876543210'),
     'uid_base_spaces', public.member_uid_base('A. B. Rao', '+919876541234'));
  begin
    insert into auth.users (instance_id,id,aud,role,email,encrypted_password,raw_user_meta_data,created_at,updated_at)
    values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(),'authenticated','authenticated','t-minor-bad@mythree.test','x',
      jsonb_build_object('full_name','Kid Bad','date_of_birth',kid_dob),now(),now());
    r := r || '{"minor_without_guardian":"ACCEPTED (bug)"}';
  exception when others then r := r || jsonb_build_object('minor_without_guardian', sqlerrm); end;
  begin
    insert into auth.users (instance_id,id,aud,role,email,encrypted_password,raw_user_meta_data,created_at,updated_at)
    values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(),'authenticated','authenticated','t-adult-bad@mythree.test','x',
      jsonb_build_object('full_name','Adult Bad','date_of_birth','1990-01-01'),now(),now());
    r := r || '{"adult_without_phone":"ACCEPTED (bug)"}';
  exception when others then r := r || jsonb_build_object('adult_without_phone', sqlerrm); end;
  insert into auth.users (instance_id,id,aud,role,email,encrypted_password,raw_user_meta_data,created_at,updated_at) values
   ('00000000-0000-0000-0000-000000000000', u1,'authenticated','authenticated','t-sib1@mythree.test','x',
     jsonb_build_object('full_name','Ananya K','date_of_birth',kid_dob,'guardian_name','Parent K','guardian_phone','+919812345678','exam_preference','online'),now(),now()),
   ('00000000-0000-0000-0000-000000000000', u2,'authenticated','authenticated','t-sib2@mythree.test','x',
     jsonb_build_object('full_name','Anand K','date_of_birth',kid_dob,'guardian_name','Parent K','guardian_phone','+919812345678'),now(),now()),
   ('00000000-0000-0000-0000-000000000000', u3,'authenticated','authenticated','t-parent@mythree.test','x',
     jsonb_build_object('full_name','Parent K','date_of_birth','1980-05-05','phone','+919812345678'),now(),now());
  select jsonb_agg(jsonb_build_object('email',email,'status',registration_status,'phone',phone,'gphone',guardian_phone,'pref',exam_preference) order by email) into x
    from public.profiles where id in (u1,u2,u3);
  r := r || jsonb_build_object('signup_rows', x);
  select id into ch from public.chapters where is_published order by position limit 1;
  begin
    insert into public.test_attempts (user_id, chapter_id, question_ids) values (u1, ch, '{}');
    r := r || '{"pending_gate":"ACCEPTED (bug)"}';
  exception when others then r := r || jsonb_build_object('pending_gate', sqlerrm); end;
  insert into public.registration_payments (user_id, amount_paise, idempotency_key, razorpay_order_id) values (u1, 15100, gen_random_uuid(), 'order_T1');
  insert into public.registration_payments (user_id, amount_paise, idempotency_key, razorpay_order_id) values (u1, 15100, gen_random_uuid(), 'order_T2');
  begin perform public.mark_registration_paid('order_T1','pay_T1',100,'upi'); r := r || '{"amount_mismatch":"ACCEPTED (bug)"}';
  exception when others then r := r || jsonb_build_object('amount_mismatch', sqlerrm); end;
  x := public.mark_registration_paid('order_T1','pay_T1',15100,'upi');
  r := r || jsonb_build_object('paid_first', jsonb_build_object('uid', x->>'member_uid', 'already', x->'already', 'receipt', x->'payment'->>'receipt_no'));
  x := public.mark_registration_paid('order_T1','pay_T1',15100,'upi');
  r := r || jsonb_build_object('paid_replay_already', x->'already');
  x := public.mark_registration_paid('order_T2','pay_T2',15100,'upi');
  r := r || jsonb_build_object('second_order_duplicate', x->'duplicate', 'second_order_status', x->'payment'->>'status', 'second_reason', x->'payment'->>'failure_reason');
  r := r || jsonb_build_object('paid_rows_u1', (select count(*) from public.registration_payments where user_id=u1 and status='paid'),
     'dup_notification', (select count(*) from public.admin_notifications where user_id=u1 and kind='payment_duplicate'),
     'reg_notification', (select count(*) from public.admin_notifications where user_id=u1 and kind='registration'));
  r := r || jsonb_build_object('uid_sib2', public.confirm_registration(u2), 'uid_parent', public.confirm_registration(u3),
     'uid_sib2_again', public.confirm_registration(u2));
  begin insert into public.test_attempts (user_id, chapter_id, question_ids) values (u1, ch, '{}'); r := r || '{"confirmed_can_learn":true}';
  exception when others then r := r || jsonb_build_object('confirmed_can_learn', sqlerrm); end;
  insert into public.registration_payments (user_id, amount_paise, idempotency_key, razorpay_order_id) values (u2, 15100, gen_random_uuid(), 'order_T3');
  perform public.mark_registration_failed('order_T3','payment_failed');
  perform public.mark_registration_failed('order_T1','late_failure_event');
  r := r || jsonb_build_object('t3_status', (select status from public.registration_payments where razorpay_order_id='order_T3'),
    't1_status_after_late_fail', (select status from public.registration_payments where razorpay_order_id='order_T1'));
  begin perform public.mark_registration_paid('order_nope','p',15100,'upi'); exception when others then r := r || jsonb_build_object('unknown_order', sqlerrm); end;
  begin insert into public.registration_payments (user_id, amount_paise, idempotency_key, status) values (u1, 15100, gen_random_uuid(), 'paid'); r := r || '{"second_paid_row":"ACCEPTED (bug)"}';
  exception when others then r := r || jsonb_build_object('second_paid_row', left(sqlerrm, 80)); end;
  raise exception 'RESULTS %', r;
end $t$;
