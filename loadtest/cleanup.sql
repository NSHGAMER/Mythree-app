-- Removes all load-test accounts and everything that cascades from them.
delete from auth.users where email like 'loadtest+%@mythree.test';
delete from public.rate_limits where key like 'phone_check:%' or key like 'faq:%' or key like 'test_start:%';
