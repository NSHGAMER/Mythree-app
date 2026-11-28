-- Mythree – logical backup / isolated restore drill (STAGING ONLY).
-- 1. BACKUP: every table in schema public (+ auth.users) is serialised to JSON in drill_backup.archive,
--    together with a row count and an order-independent checksum.
-- 2. RESTORE: each table is re-created in the isolated schema drill_restore (same columns, defaults and
--    constraints via LIKE … INCLUDING ALL) and filled from the archive – public is never touched.
-- 3. VERIFY: row counts and checksums of restored tables are compared with the live tables.
-- 4. CLEAN UP: both drill schemas are dropped (they contain copies of personal/test data).
-- Returns one JSON report. Production must use the pg_dump workflow in .github/workflows/db-backup.yml.
do $drill$
declare
  t record; n bigint; c text; rn bigint; rc text; ok_all boolean := true;
  report jsonb := '[]'::jsonb; started timestamptz := clock_timestamp();
begin
  drop schema if exists drill_backup cascade;
  drop schema if exists drill_restore cascade;
  create schema drill_backup;
  create schema drill_restore;
  create table drill_backup.archive (schema_name text, table_name text, row_count bigint, checksum text, rows jsonb, taken_at timestamptz default clock_timestamp());

  for t in
    select n.nspname as s, c.relname as r from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'r' and ((n.nspname = 'public' and c.relname not like '\_%') or (n.nspname = 'auth' and c.relname = 'users'))
    order by 1, 2
  loop
    -- backup
    execute format($q$insert into drill_backup.archive (schema_name, table_name, row_count, checksum, rows)
      select %L, %L, count(*), coalesce(md5(string_agg(md5(x::text), '' order by md5(x::text))), md5('')), coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
      from %I.%I x$q$, t.s, t.r, t.s, t.r);
    -- isolated restore
    execute format('create table drill_restore.%I (like %I.%I including defaults including constraints including generated)', t.s || '__' || t.r, t.s, t.r);
    -- generated columns are recomputed on insert, so restore only the stored (non-generated) columns
    execute format($q$insert into drill_restore.%I (%s) select %s from drill_backup.archive a,
        jsonb_populate_recordset(null::%I.%I, a.rows) r where a.schema_name = %L and a.table_name = %L$q$,
      t.s || '__' || t.r,
      (select string_agg(quote_ident(attname), ', ' order by attnum) from pg_attribute where attrelid = format('%I.%I', t.s, t.r)::regclass and attnum > 0 and not attisdropped and attgenerated = ''),
      (select string_agg('r.' || quote_ident(attname), ', ' order by attnum) from pg_attribute where attrelid = format('%I.%I', t.s, t.r)::regclass and attnum > 0 and not attisdropped and attgenerated = ''),
      t.s, t.r, t.s, t.r);
    -- verify
    select row_count, checksum into n, c from drill_backup.archive where schema_name = t.s and table_name = t.r;
    execute format($q$select count(*), coalesce(md5(string_agg(md5(x::text), '' order by md5(x::text))), md5('')) from drill_restore.%I x$q$, t.s || '__' || t.r) into rn, rc;
    if rn <> n or rc <> c then ok_all := false; end if;
    report := report || jsonb_build_object('table', t.s || '.' || t.r, 'rows', n, 'restored_rows', rn, 'checksum_match', rc = c);
  end loop;

  report := jsonb_build_object('all_match', ok_all, 'tables', jsonb_array_length(report),
    'rows_total', (select sum(row_count) from drill_backup.archive),
    'archive_bytes', (select sum(pg_column_size(rows)) from drill_backup.archive),
    'seconds', round(extract(epoch from clock_timestamp() - started)::numeric, 2), 'detail', report);
  drop schema drill_backup cascade;
  drop schema drill_restore cascade;
  raise notice 'DRILL %', report;
  -- surface the report to the caller
  perform set_config('mythree.drill_report', report::text, false);
end $drill$;
select current_setting('mythree.drill_report')::jsonb as drill_report;
