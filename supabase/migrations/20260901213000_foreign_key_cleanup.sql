-- Campus Recruitment Portal foreign-key cleanup migration.
--
-- Run this migration as the database owner in the Supabase SQL Editor.
-- It is intentionally conservative:
--   * the transaction aborts before schema changes if a referenced object/type is wrong;
--   * the transaction aborts if any non-null child value has no matching parent;
--   * an existing foreign key is reused even when it has a different name;
--   * existing CASCADE/SET NULL/SET DEFAULT delete behavior is never replaced silently;
--   * parent deletion is restricted so recruitment and application history is preserved.

begin;

select pg_advisory_xact_lock(
  hashtext('campus-placement-portal:foreign-key-cleanup')
);

-- Preflight report: this result set must be empty. It identifies every row that
-- would prevent the requested foreign keys from being validated.
select
  'students.profile_id -> profiles.id' as relationship,
  student.id::text as child_id,
  student.profile_id::text as missing_parent_id
from public.students as student
left join public.profiles as profile on profile.id = student.profile_id
where student.profile_id is not null
  and profile.id is null

union all

select
  'placement_drives.company_id -> companies.id',
  drive.id::text,
  drive.company_id::text
from public.placement_drives as drive
left join public.companies as company on company.id = drive.company_id
where drive.company_id is not null
  and company.id is null

union all

select
  'applications.student_id -> students.id',
  application.id::text,
  application.student_id::text
from public.applications as application
left join public.students as student on student.id = application.student_id
where application.student_id is not null
  and student.id is null

union all

select
  'applications.drive_id -> placement_drives.id',
  application.id::text,
  application.drive_id::text
from public.applications as application
left join public.placement_drives as drive on drive.id = application.drive_id
where application.drive_id is not null
  and drive.id is null
order by relationship, child_id;

-- Validate tables, columns, UUID compatibility, parent uniqueness, and orphans.
-- Raising an exception here rolls back the transaction before any ALTER TABLE.
do $preflight$
declare
  relation record;
  child_table regclass;
  parent_table regclass;
  child_attnum smallint;
  parent_attnum smallint;
  child_type regtype;
  parent_type regtype;
  orphan_count bigint;
  orphan_summaries text[] := array[]::text[];
begin
  for relation in
    select *
    from (
      values
        ('students', 'profile_id', 'profiles', 'id'),
        ('placement_drives', 'company_id', 'companies', 'id'),
        ('applications', 'student_id', 'students', 'id'),
        ('applications', 'drive_id', 'placement_drives', 'id')
    ) as requested(child_table_name, child_column_name, parent_table_name, parent_column_name)
  loop
    child_table := to_regclass(format('public.%I', relation.child_table_name));
    parent_table := to_regclass(format('public.%I', relation.parent_table_name));

    if child_table is null then
      raise exception 'Required table public.% does not exist', relation.child_table_name;
    end if;

    if parent_table is null then
      raise exception 'Required table public.% does not exist', relation.parent_table_name;
    end if;

    child_attnum := null;
    child_type := null;
    select attribute.attnum, attribute.atttypid::regtype
    into child_attnum, child_type
    from pg_attribute as attribute
    where attribute.attrelid = child_table
      and attribute.attname = relation.child_column_name
      and attribute.attnum > 0
      and not attribute.attisdropped;

    if child_attnum is null then
      raise exception 'Required column public.%.% does not exist',
        relation.child_table_name,
        relation.child_column_name;
    end if;

    parent_attnum := null;
    parent_type := null;
    select attribute.attnum, attribute.atttypid::regtype
    into parent_attnum, parent_type
    from pg_attribute as attribute
    where attribute.attrelid = parent_table
      and attribute.attname = relation.parent_column_name
      and attribute.attnum > 0
      and not attribute.attisdropped;

    if parent_attnum is null then
      raise exception 'Required column public.%.% does not exist',
        relation.parent_table_name,
        relation.parent_column_name;
    end if;

    if child_type <> 'uuid'::regtype or parent_type <> 'uuid'::regtype then
      raise exception 'Type mismatch for public.%.% (%) -> public.%.% (%); both columns must remain UUID',
        relation.child_table_name,
        relation.child_column_name,
        child_type,
        relation.parent_table_name,
        relation.parent_column_name,
        parent_type;
    end if;

    if not exists (
      select 1
      from pg_constraint as parent_constraint
      where parent_constraint.conrelid = parent_table
        and parent_constraint.contype in ('p', 'u')
        and parent_constraint.conkey = array[parent_attnum]::smallint[]
    ) then
      raise exception 'Referenced column public.%.% is not protected by a single-column PRIMARY KEY or UNIQUE constraint',
        relation.parent_table_name,
        relation.parent_column_name;
    end if;

    execute format(
      'select count(*) from %s as child left join %s as parent on parent.%I = child.%I where child.%I is not null and parent.%I is null',
      child_table,
      parent_table,
      relation.parent_column_name,
      relation.child_column_name,
      relation.child_column_name,
      relation.parent_column_name
    ) into orphan_count;

    if orphan_count > 0 then
      orphan_summaries := array_append(
        orphan_summaries,
        format(
          'public.%I.%I -> public.%I.%I: %s orphan(s)',
          relation.child_table_name,
          relation.child_column_name,
          relation.parent_table_name,
          relation.parent_column_name,
          orphan_count
        )
      );
    end if;
  end loop;

  if cardinality(orphan_summaries) > 0 then
    raise exception 'Foreign-key cleanup stopped; repair these relationships first: %',
      array_to_string(orphan_summaries, '; ');
  end if;
end
$preflight$;

-- Add only relationships that do not already exist. Existing NO ACTION or
-- RESTRICT foreign keys are retained under their current names.
do $foreign_keys$
declare
  relation record;
  child_table regclass;
  parent_table regclass;
  child_attnum smallint;
  parent_attnum smallint;
  existing_constraint_name text;
  existing_delete_action "char";
  existing_is_valid boolean;
begin
  for relation in
    select *
    from (
      values
        ('students', 'profile_id', 'profiles', 'id', 'students_profile_id_fkey'),
        ('placement_drives', 'company_id', 'companies', 'id', 'placement_drives_company_id_fkey'),
        ('applications', 'student_id', 'students', 'id', 'applications_student_id_fkey'),
        ('applications', 'drive_id', 'placement_drives', 'id', 'applications_drive_id_fkey')
    ) as requested(
      child_table_name,
      child_column_name,
      parent_table_name,
      parent_column_name,
      desired_constraint_name
    )
  loop
    child_table := to_regclass(format('public.%I', relation.child_table_name));
    parent_table := to_regclass(format('public.%I', relation.parent_table_name));

    select attribute.attnum
    into child_attnum
    from pg_attribute as attribute
    where attribute.attrelid = child_table
      and attribute.attname = relation.child_column_name
      and attribute.attnum > 0
      and not attribute.attisdropped;

    select attribute.attnum
    into parent_attnum
    from pg_attribute as attribute
    where attribute.attrelid = parent_table
      and attribute.attname = relation.parent_column_name
      and attribute.attnum > 0
      and not attribute.attisdropped;

    existing_constraint_name := null;
    existing_delete_action := null;
    existing_is_valid := null;

    select
      foreign_key.conname,
      foreign_key.confdeltype,
      foreign_key.convalidated
    into
      existing_constraint_name,
      existing_delete_action,
      existing_is_valid
    from pg_constraint as foreign_key
    where foreign_key.contype = 'f'
      and foreign_key.conrelid = child_table
      and foreign_key.confrelid = parent_table
      and foreign_key.conkey = array[child_attnum]::smallint[]
      and foreign_key.confkey = array[parent_attnum]::smallint[]
    order by foreign_key.oid
    limit 1;

    if existing_constraint_name is not null then
      if existing_delete_action not in ('a', 'r') then
        raise exception 'Existing constraint public.%.% uses unsafe ON DELETE behavior (%). Review it manually; this migration will not replace it.',
          relation.child_table_name,
          existing_constraint_name,
          case existing_delete_action
            when 'c' then 'CASCADE'
            when 'n' then 'SET NULL'
            when 'd' then 'SET DEFAULT'
            else existing_delete_action::text
          end;
      end if;

      if not existing_is_valid then
        execute format(
          'alter table %s validate constraint %I',
          child_table,
          existing_constraint_name
        );
      end if;

      raise notice 'Keeping existing foreign key public.%.%',
        relation.child_table_name,
        existing_constraint_name;
      continue;
    end if;

    if exists (
      select 1
      from pg_constraint as named_constraint
      where named_constraint.conrelid = child_table
        and named_constraint.conname = relation.desired_constraint_name
    ) then
      raise exception 'Constraint name public.%.% already exists for a different definition',
        relation.child_table_name,
        relation.desired_constraint_name;
    end if;

    execute format(
      'alter table %s add constraint %I foreign key (%I) references %s (%I) on update no action on delete restrict not valid',
      child_table,
      relation.desired_constraint_name,
      relation.child_column_name,
      parent_table,
      relation.parent_column_name
    );

    execute format(
      'alter table %s validate constraint %I',
      child_table,
      relation.desired_constraint_name
    );
  end loop;
end
$foreign_keys$;

-- A foreign key does not automatically create an index on its child column.
-- Reuse any valid, ready, non-partial index whose leading key is the FK column.
do $indexes$
declare
  requested_index record;
  table_oid regclass;
  column_attnum smallint;
  covering_index_name text;
begin
  for requested_index in
    select *
    from (
      values
        ('students', 'profile_id', 'idx_students_profile_id'),
        ('placement_drives', 'company_id', 'idx_placement_drives_company_id'),
        ('applications', 'student_id', 'idx_applications_student_id'),
        ('applications', 'drive_id', 'idx_applications_drive_id')
    ) as requested(table_name, column_name, desired_index_name)
  loop
    table_oid := to_regclass(format('public.%I', requested_index.table_name));

    select attribute.attnum
    into column_attnum
    from pg_attribute as attribute
    where attribute.attrelid = table_oid
      and attribute.attname = requested_index.column_name
      and attribute.attnum > 0
      and not attribute.attisdropped;

    covering_index_name := null;
    select index_relation.relname
    into covering_index_name
    from pg_index as index_metadata
    join pg_class as index_relation on index_relation.oid = index_metadata.indexrelid
    where index_metadata.indrelid = table_oid
      and index_metadata.indisvalid
      and index_metadata.indisready
      and index_metadata.indpred is null
      and index_metadata.indnkeyatts >= 1
      and index_metadata.indkey[0] = column_attnum
    order by index_relation.oid
    limit 1;

    if covering_index_name is not null then
      raise notice 'Keeping existing index public.% for public.%.%',
        covering_index_name,
        requested_index.table_name,
        requested_index.column_name;
      continue;
    end if;

    if to_regclass(format('public.%I', requested_index.desired_index_name)) is not null then
      raise exception 'Index public.% already exists but does not provide the required leading-column coverage for public.%.%',
        requested_index.desired_index_name,
        requested_index.table_name,
        requested_index.column_name;
    end if;

    execute format(
      'create index %I on %s (%I)',
      requested_index.desired_index_name,
      table_oid,
      requested_index.column_name
    );
  end loop;
end
$indexes$;

-- Ask PostgREST to refresh its relationship cache after the transaction commits.
notify pgrst, 'reload schema';

commit;

-- Verification report: four rows are expected, one for each requested mapping.
select
  child_table.relname as child_table,
  foreign_key.conname as constraint_name,
  pg_get_constraintdef(foreign_key.oid, true) as definition,
  foreign_key.convalidated as validated
from pg_constraint as foreign_key
join pg_class as child_table on child_table.oid = foreign_key.conrelid
join pg_namespace as child_namespace on child_namespace.oid = child_table.relnamespace
where foreign_key.contype = 'f'
  and child_namespace.nspname = 'public'
  and (
    (child_table.relname = 'students' and foreign_key.conkey = array[
      (select attnum from pg_attribute where attrelid = 'public.students'::regclass and attname = 'profile_id')
    ]::smallint[])
    or
    (child_table.relname = 'placement_drives' and foreign_key.conkey = array[
      (select attnum from pg_attribute where attrelid = 'public.placement_drives'::regclass and attname = 'company_id')
    ]::smallint[])
    or
    (child_table.relname = 'applications' and foreign_key.conkey in (
      array[(select attnum from pg_attribute where attrelid = 'public.applications'::regclass and attname = 'student_id')]::smallint[],
      array[(select attnum from pg_attribute where attrelid = 'public.applications'::regclass and attname = 'drive_id')]::smallint[]
    ))
  )
order by child_table.relname, foreign_key.conname;

select
  table_name,
  column_name,
  index_name,
  index_definition
from (
  select
    table_relation.relname as table_name,
    attribute.attname as column_name,
    index_relation.relname as index_name,
    pg_get_indexdef(index_relation.oid) as index_definition
  from pg_index as index_metadata
  join pg_class as table_relation on table_relation.oid = index_metadata.indrelid
  join pg_namespace as table_namespace on table_namespace.oid = table_relation.relnamespace
  join pg_class as index_relation on index_relation.oid = index_metadata.indexrelid
  join pg_attribute as attribute
    on attribute.attrelid = table_relation.oid
   and attribute.attnum = index_metadata.indkey[0]
  where table_namespace.nspname = 'public'
    and index_metadata.indisvalid
    and index_metadata.indisready
    and index_metadata.indpred is null
) as available_indexes
where (table_name, column_name) in (
  ('students', 'profile_id'),
  ('placement_drives', 'company_id'),
  ('applications', 'student_id'),
  ('applications', 'drive_id')
)
order by table_name, column_name, index_name;
