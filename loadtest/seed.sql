-- Creates N confirmed load-test members (loadtest+1..N@mythree.test) directly in auth.users.
-- Replace :PASSWORD and :N before running. Remove them afterwards with cleanup.sql.
-- The .test TLD is reserved, so no real mailbox can ever receive mail for these accounts.
do $$
declare
  i integer;
  uid uuid;
begin
  for i in 1..:N loop
    uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      'loadtest+' || i || '@mythree.test', extensions.crypt(':PASSWORD', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', 'Load Tester ' || i, 'phone', '+9180000' || lpad(i::text, 5, '0'), 'age', '30',
        'address_line1', 'Test address ' || i, 'city', 'Bengaluru', 'state', 'Karnataka', 'pincode', '560001'),
      now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', 'loadtest+' || i || '@mythree.test', 'email_verified', true),
      'email', now(), now(), now());
  end loop;
end $$;
