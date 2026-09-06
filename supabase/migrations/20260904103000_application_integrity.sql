-- Enforce one application per student/drive and validate drive eligibility
-- for every application insert, including requests that bypass the frontend.

begin;

select pg_advisory_xact_lock(
  hashtext('campus-placement-portal:application-integrity')
);

-- Stop before changing the schema if the live columns differ from the schema
-- this migration was written against or duplicate pairs need manual review.
do $preflight$
declare
  duplicate_groups jsonb;
  column_definition record;
begin
  for column_definition in
    select *
    from (
      values
        ('applications', 'student_id', 'uuid'),
        ('applications', 'drive_id', 'uuid'),
        ('applications', 'status', 'text'),
        ('students', 'id', 'uuid'),
        ('students', 'branch', 'text'),
        ('students', 'cgpa', 'numeric'),
        ('placement_drives', 'id', 'uuid'),
        ('placement_drives', 'min_cgpa', 'numeric'),
        ('placement_drives', 'allowed_branches', 'text')
    ) as expected(table_name, column_name, data_type)
  loop
    if not exists (
      select 1
      from information_schema.columns as live_column
      where live_column.table_schema = 'public'
        and live_column.table_name = column_definition.table_name
        and live_column.column_name = column_definition.column_name
        and live_column.udt_name = column_definition.data_type
    ) then
      raise exception 'Application integrity migration stopped: expected public.%.% to have type %',
        column_definition.table_name,
        column_definition.column_name,
        column_definition.data_type;
    end if;
  end loop;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'student_id', duplicate.student_id,
        'drive_id', duplicate.drive_id,
        'count', duplicate.row_count,
        'application_ids', duplicate.application_ids
      ) order by duplicate.student_id, duplicate.drive_id
    ),
    '[]'::jsonb
  )
  into duplicate_groups
  from (
    select
      application.student_id,
      application.drive_id,
      count(*) as row_count,
      array_agg(application.id order by application.applied_at, application.id) as application_ids
    from public.applications as application
    group by application.student_id, application.drive_id
    having count(*) > 1
  ) as duplicate;

  if jsonb_array_length(duplicate_groups) > 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Application integrity migration stopped: duplicate student/drive pairs exist: %s',
        duplicate_groups
      ),
      hint = 'Review each group, retain the intended application, archive the others outside this migration, then rerun it. No rows were changed.';
  end if;
end
$preflight$;

do $uniqueness$
declare
  student_column smallint;
  drive_column smallint;
  equivalent_constraint text;
  equivalent_index text;
begin
  select attribute.attnum
  into student_column
  from pg_attribute as attribute
  where attribute.attrelid = 'public.applications'::regclass
    and attribute.attname = 'student_id'
    and attribute.attnum > 0
    and not attribute.attisdropped;

  select attribute.attnum
  into drive_column
  from pg_attribute as attribute
  where attribute.attrelid = 'public.applications'::regclass
    and attribute.attname = 'drive_id'
    and attribute.attnum > 0
    and not attribute.attisdropped;

  select constraint_metadata.conname
  into equivalent_constraint
  from pg_constraint as constraint_metadata
  where constraint_metadata.conrelid = 'public.applications'::regclass
    and constraint_metadata.contype = 'u'
    and cardinality(constraint_metadata.conkey) = 2
    and constraint_metadata.conkey @> array[student_column, drive_column]::smallint[]
  order by constraint_metadata.oid
  limit 1;

  if equivalent_constraint is not null then
    raise notice 'Keeping existing application uniqueness constraint public.applications.%',
      equivalent_constraint;
    return;
  end if;

  select index_relation.relname
  into equivalent_index
  from pg_index as index_metadata
  join pg_class as index_relation on index_relation.oid = index_metadata.indexrelid
  where index_metadata.indrelid = 'public.applications'::regclass
    and index_metadata.indisunique
    and index_metadata.indisvalid
    and index_metadata.indisready
    and index_metadata.indpred is null
    and index_metadata.indexprs is null
    and index_metadata.indnkeyatts = 2
    and (
      select count(*)
      from unnest(index_metadata.indkey::smallint[]) with ordinality as indexed_column(attnum, position)
      where indexed_column.position <= index_metadata.indnkeyatts
        and indexed_column.attnum in (student_column, drive_column)
    ) = 2
  order by index_relation.oid
  limit 1;

  if equivalent_index is not null then
    raise notice 'Keeping existing application uniqueness index public.%',
      equivalent_index;
    return;
  end if;

  if exists (
    select 1
    from pg_constraint as named_constraint
    where named_constraint.conrelid = 'public.applications'::regclass
      and named_constraint.conname = 'applications_student_drive_unique'
  ) then
    raise exception 'Constraint public.applications.applications_student_drive_unique exists with an unexpected definition';
  end if;

  alter table public.applications
    add constraint applications_student_drive_unique
    unique (student_id, drive_id);
end
$uniqueness$;

create function public.portal_enforce_application_eligibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  student_cgpa numeric;
  student_branch text;
  drive_min_cgpa numeric;
  drive_allowed_branches text;
  branch_criteria text;
  branch_json jsonb;
  branch_json_value jsonb;
  branch_values text[] := array[]::text[];
  normalized_allowed_branches text[] := array[]::text[];
  branch_value text;
  normalized_branch text;
  normalized_student_branch text;
begin
  select student.cgpa, student.branch
  into student_cgpa, student_branch
  from public.students as student
  where student.id = new.student_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'APPLICATION_NOT_ELIGIBLE: The student record does not exist.',
      constraint = 'applications_eligibility_check';
  end if;

  select drive.min_cgpa, drive.allowed_branches
  into drive_min_cgpa, drive_allowed_branches
  from public.placement_drives as drive
  where drive.id = new.drive_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'APPLICATION_NOT_ELIGIBLE: The placement drive does not exist.',
      constraint = 'applications_eligibility_check';
  end if;

  if drive_min_cgpa is not null then
    if drive_min_cgpa < 0 or drive_min_cgpa > 10 then
      raise exception using
        errcode = 'P0001',
        message = 'APPLICATION_NOT_ELIGIBLE: The drive has an invalid minimum CGPA criterion.',
        constraint = 'applications_eligibility_check';
    end if;

    if student_cgpa is null or student_cgpa < drive_min_cgpa then
      raise exception using
        errcode = 'P0001',
        message = 'APPLICATION_NOT_ELIGIBLE: You do not meet the minimum CGPA requirement.',
        constraint = 'applications_eligibility_check';
    end if;
  end if;

  branch_criteria := btrim(coalesce(drive_allowed_branches, ''));

  if branch_criteria = '' then
    return new;
  end if;

  if left(branch_criteria, 1) = '[' then
    begin
      branch_json := branch_criteria::jsonb;
    exception
      when invalid_text_representation then
        raise exception using
          errcode = 'P0001',
          message = 'APPLICATION_NOT_ELIGIBLE: The drive has malformed branch criteria.',
          constraint = 'applications_eligibility_check';
    end;

    if jsonb_typeof(branch_json) <> 'array' then
      raise exception using
        errcode = 'P0001',
        message = 'APPLICATION_NOT_ELIGIBLE: The drive has malformed branch criteria.',
        constraint = 'applications_eligibility_check';
    end if;

    for branch_json_value in
      select branch_element.value
      from jsonb_array_elements(branch_json) as branch_element(value)
    loop
      if jsonb_typeof(branch_json_value) <> 'string' then
        raise exception using
          errcode = 'P0001',
          message = 'APPLICATION_NOT_ELIGIBLE: The drive has malformed branch criteria.',
          constraint = 'applications_eligibility_check';
      end if;

      branch_values := array_append(
        branch_values,
        branch_json_value #>> '{}'
      );
    end loop;
  else
    branch_values := regexp_split_to_array(
      branch_criteria,
      E'[,;|\\n\\r]+'
    );
  end if;

  foreach branch_value in array branch_values
  loop
    normalized_branch := lower(
      regexp_replace(btrim(branch_value), '[[:space:]]+', ' ', 'g')
    );

    if normalized_branch <> '' then
      normalized_allowed_branches := array_append(
        normalized_allowed_branches,
        normalized_branch
      );
    end if;
  end loop;

  if cardinality(normalized_allowed_branches) = 0
    or normalized_allowed_branches && array['all', 'all branches', 'any', '*']::text[] then
    return new;
  end if;

  normalized_student_branch := lower(
    regexp_replace(btrim(coalesce(student_branch, '')), '[[:space:]]+', ' ', 'g')
  );

  if normalized_student_branch = ''
    or not (normalized_student_branch = any(normalized_allowed_branches)) then
    raise exception using
      errcode = 'P0001',
      message = 'APPLICATION_NOT_ELIGIBLE: Your branch is not allowed for this drive.',
      constraint = 'applications_eligibility_check';
  end if;

  return new;
end
$function$;

alter function public.portal_enforce_application_eligibility() owner to postgres;
revoke all on function public.portal_enforce_application_eligibility()
from public, anon, authenticated;

create trigger applications_enforce_eligibility_before_insert
before insert on public.applications
for each row
execute function public.portal_enforce_application_eligibility();

do $verification$
begin
  if not exists (
    select 1
    from pg_constraint as constraint_metadata
    where constraint_metadata.conrelid = 'public.applications'::regclass
      and constraint_metadata.contype = 'u'
      and pg_get_constraintdef(constraint_metadata.oid, true)
        in (
          'UNIQUE (student_id, drive_id)',
          'UNIQUE (drive_id, student_id)'
        )
  ) and not exists (
    select 1
    from pg_index as index_metadata
    where index_metadata.indrelid = 'public.applications'::regclass
      and index_metadata.indisunique
      and index_metadata.indisvalid
      and index_metadata.indisready
      and index_metadata.indpred is null
      and index_metadata.indexprs is null
      and index_metadata.indnkeyatts = 2
      and (
        select count(*)
        from unnest(index_metadata.indkey::smallint[]) with ordinality as indexed_column(attnum, position)
        join pg_attribute as attribute
          on attribute.attrelid = 'public.applications'::regclass
         and attribute.attnum = indexed_column.attnum
        where indexed_column.position <= index_metadata.indnkeyatts
          and attribute.attname in ('student_id', 'drive_id')
      ) = 2
  ) then
    raise exception 'Application uniqueness verification failed';
  end if;

  if not exists (
    select 1
    from pg_trigger as trigger_metadata
    where trigger_metadata.tgrelid = 'public.applications'::regclass
      and trigger_metadata.tgname = 'applications_enforce_eligibility_before_insert'
      and not trigger_metadata.tgisinternal
      and trigger_metadata.tgenabled <> 'D'
  ) then
    raise exception 'Application eligibility trigger verification failed';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'applications'
      and policyname = 'Students can create own applications'
      and cmd = 'INSERT'
      and with_check like '%status = ''Applied''%'
      and with_check like '%portal_owns_student(student_id)%'
  ) then
    raise exception 'Existing student ownership/status RLS policy was not preserved';
  end if;
end
$verification$;

notify pgrst, 'reload schema';

commit;
