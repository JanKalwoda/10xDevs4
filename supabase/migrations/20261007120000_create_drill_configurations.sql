-- S-10 save-named-drill: private, named drill (timer) configurations.
--
-- The database is the security boundary: ownership (RLS per operation), name rules,
-- the 50-per-user limit and the parameter ranges are enforced here, not only in the app.
-- The CHECK bounds mirror parseDrillConfig in src/lib/drill-timer.ts (0-600 s preparation,
-- 1-600 s exercise, 0-600 s rest, 1-100 repetitions); a unit test guards the drift.
-- There is deliberately no column for phase colors (S-05 is deferred).
--
-- Production order: `npx supabase db push` BEFORE merging the PR that uses the table.
-- Until the table exists the app only answers 503 on POST /api/drills.
--
-- Rollback: ship a NEW forward migration that drops the trigger, the table and
-- public.enforce_drill_configuration_limit() (and public.set_updated_at() if no other table
-- uses it). For an emergency manual `drop table`, follow it with
--   npx supabase migration repair --status reverted 20261007120000
-- A bare manual drop is not a rollback: the version stays recorded in
-- supabase_migrations.schema_migrations and the next `db push` would not recreate the table.

create table public.drill_configurations (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
    name text not null,
    preparation_seconds integer not null,
    exercise_seconds integer not null,
    rest_seconds integer not null,
    repetitions integer not null,
    random_start_enabled boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    -- char_length counts code points, like the service's [...name].length.
    constraint drill_configurations_name_length check (char_length(name) between 1 and 200),
    constraint drill_configurations_name_trimmed check (name = btrim(name)),
    -- NFC and NFD forms of the same text must not slip past the lower(name) uniqueness.
    constraint drill_configurations_name_nfc check (name = normalize(name, nfc)),
    -- C0 (except NUL, which text cannot hold), DEL and C1 control characters, as an explicit
    -- class so the rule does not depend on the locale behind [[:cntrl:]].
    constraint drill_configurations_name_no_control_chars check (name !~ '[\x01-\x1f\x7f-\x9f]'),
    constraint drill_configurations_preparation_range check (preparation_seconds between 0 and 600),
    constraint drill_configurations_exercise_range check (exercise_seconds between 1 and 600),
    constraint drill_configurations_rest_range check (rest_seconds between 0 and 600),
    constraint drill_configurations_repetitions_range check (repetitions between 1 and 100)
);

-- Case-insensitive unique name per user; the leading user_id also serves per-user lookups (S-11).
create unique index drill_configurations_user_name_key on public.drill_configurations (user_id, lower(name));

create function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger drill_configurations_set_updated_at
before update on public.drill_configurations
for each row execute function public.set_updated_at();

-- At most 50 rows per user. The advisory lock serialises concurrent inserts of one user so two
-- requests cannot both read 49 and both insert. It must stay VOLATILE (the default): a multi-row
-- INSERT relies on later rows of the same statement seeing the earlier ones. security invoker +
-- RLS means the count sees only the caller's own rows, which is exactly what is limited.
create function public.enforce_drill_configuration_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

    if (select count(*) from public.drill_configurations where user_id = new.user_id) >= 50 then
        raise exception 'drill_configuration_limit_reached' using errcode = '54000';
    end if;

    return new;
end;
$$;

create trigger drill_configurations_enforce_limit
before insert on public.drill_configurations
for each row execute function public.enforce_drill_configuration_limit();

-- Trigger functions are never meant to be called by clients. Triggers still fire: EXECUTE is
-- checked when a trigger is created, not when it fires.
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.enforce_drill_configuration_limit() from public, anon, authenticated;

alter table public.drill_configurations enable row level security;

-- Supabase grants new public tables to anon and authenticated by default. Start from nothing,
-- then grant authenticated only what a client may do. id, created_at and updated_at are server
-- owned; user_id can be supplied on insert (WITH CHECK pins it to auth.uid()) and never changed.
revoke all on table public.drill_configurations from anon, authenticated;
grant select, delete on table public.drill_configurations to authenticated;
grant insert (user_id, name, preparation_seconds, exercise_seconds, rest_seconds, repetitions, random_start_enabled)
    on table public.drill_configurations to authenticated;
grant update (name, preparation_seconds, exercise_seconds, rest_seconds, repetitions, random_start_enabled)
    on table public.drill_configurations to authenticated;

create policy "drill_configurations_select_own" on public.drill_configurations
    for select to authenticated
    using ((select auth.uid()) = user_id);

create policy "drill_configurations_insert_own" on public.drill_configurations
    for insert to authenticated
    with check ((select auth.uid()) = user_id);

create policy "drill_configurations_update_own" on public.drill_configurations
    for update to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

create policy "drill_configurations_delete_own" on public.drill_configurations
    for delete to authenticated
    using ((select auth.uid()) = user_id);
