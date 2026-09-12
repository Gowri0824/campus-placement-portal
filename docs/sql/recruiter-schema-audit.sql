-- Durable read-only audit for the Recruiter foundation. Run in Supabase SQL Editor.
-- No application rows, credentials or auth-user records are selected.
begin transaction read only;
set local statement_timeout = '15s';
set local lock_timeout = '3s';

-- Inventory all public tables/views so an existing membership table is not missed.
select table_schema, table_name, table_type
from information_schema.tables
where table_schema = 'public'
order by table_name;

select table_name, column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

select ns.nspname as schema_name, tbl.relname as table_name,
       con.conname, con.contype, con.convalidated,
       pg_get_constraintdef(con.oid, true) as definition
from pg_constraint con
join pg_class tbl on tbl.oid = con.conrelid
join pg_namespace ns on ns.oid = tbl.relnamespace
where ns.nspname = 'public'
order by tbl.relname, con.conname;

select schemaname, tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;

select ns.nspname as schema_name, tbl.relname as table_name,
       tbl.relrowsecurity as rls_enabled, tbl.relforcerowsecurity as force_rls
from pg_class tbl
join pg_namespace ns on ns.oid = tbl.relnamespace
where (ns.nspname = 'public' and tbl.relkind in ('r', 'p'))
   or (ns.nspname = 'storage' and tbl.relname = 'objects')
order by schema_name, table_name;

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
   or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;

select grantee, table_schema, table_name, privilege_type
from information_schema.table_privileges
where table_schema in ('public', 'storage')
  and grantee in ('anon', 'authenticated', 'PUBLIC')
order by table_schema, table_name, grantee, privilege_type;

select grantee, table_name, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public'
  and grantee in ('anon', 'authenticated', 'PUBLIC')
order by table_name, grantee, column_name, privilege_type;

select tbl.relname as table_name, trg.tgname,
       pg_get_triggerdef(trg.oid, true) as definition
from pg_trigger trg
join pg_class tbl on tbl.oid = trg.tgrelid
join pg_namespace ns on ns.oid = tbl.relnamespace
where ns.nspname = 'public' and not trg.tgisinternal
order by tbl.relname, trg.tgname;

select proc.proname, pg_get_function_identity_arguments(proc.oid) as arguments,
       proc.prosecdef as security_definer, proc.proconfig, proc.proacl,
       pg_get_functiondef(proc.oid) as definition
from pg_proc proc
join pg_namespace ns on ns.oid = proc.pronamespace
where ns.nspname = 'public' and proc.prokind = 'f'
  and (proc.proname like 'portal_%' or proc.proname ilike '%recruit%')
order by proc.proname;

select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'resumes';

rollback;
