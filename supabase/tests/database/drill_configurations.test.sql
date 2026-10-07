-- pgTAP suite for public.drill_configurations (S-10). Run with `supabase test db`.
-- One transaction, fixed UUIDs, no sleeps and no dependence on other tables or seed data;
-- everything is rolled back at the end.

begin;

create extension if not exists pgtap with schema extensions;

select plan(105);

-- Fixtures: five users (A and B for ownership, L for the limit, M for the multi-row boundary,
-- C for cascade and updated_at). Created as postgres, which bypasses RLS.
insert into auth.users (id, aud, role, email)
values
    ('00000000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'a@example.test'),
    ('00000000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'b@example.test'),
    ('00000000-0000-4000-8000-00000000000c', 'authenticated', 'authenticated', 'c@example.test'),
    ('00000000-0000-4000-8000-00000000000d', 'authenticated', 'authenticated', 'l@example.test'),
    ('00000000-0000-4000-8000-00000000000e', 'authenticated', 'authenticated', 'm@example.test');

-- ---------------------------------------------------------------------------
-- Structure, RLS and policies
-- ---------------------------------------------------------------------------

select has_table('public', 'drill_configurations', 'table exists');

select is(
    (select relrowsecurity from pg_class where oid = 'public.drill_configurations'::regclass),
    true,
    'RLS is enabled'
);

select is(
    (select count(*) from pg_policies where schemaname = 'public' and tablename = 'drill_configurations'),
    4::bigint,
    'exactly four policies exist'
);

select is(
    (select array_agg(cmd order by cmd) from pg_policies where schemaname = 'public' and tablename = 'drill_configurations'),
    array['DELETE', 'INSERT', 'SELECT', 'UPDATE']::text[],
    'one policy per operation'
);

select is(
    (select count(*) from pg_policies
        where schemaname = 'public' and tablename = 'drill_configurations' and roles = array['authenticated']::name[]),
    4::bigint,
    'every policy is limited to the authenticated role'
);

select is(
    has_function_privilege('authenticated', 'public.set_updated_at()', 'execute'),
    false,
    'authenticated cannot execute set_updated_at'
);
select is(
    has_function_privilege('anon', 'public.enforce_drill_configuration_limit()', 'execute'),
    false,
    'anon cannot execute the limit function'
);
select is(
    has_function_privilege('authenticated', 'public.enforce_drill_configuration_limit()', 'execute'),
    false,
    'authenticated cannot execute the limit function'
);

-- ---------------------------------------------------------------------------
-- anon has no access
-- ---------------------------------------------------------------------------

set local role anon;

select throws_ok(
    $$select * from public.drill_configurations$$,
    '42501',
    null,
    'anon cannot select'
);
select throws_ok(
    $$insert into public.drill_configurations (user_id, name, preparation_seconds, exercise_seconds, rest_seconds, repetitions)
      values ('00000000-0000-4000-8000-00000000000a', 'anon', 0, 10, 0, 1)$$,
    '42501',
    null,
    'anon cannot insert'
);

reset role;

-- ---------------------------------------------------------------------------
-- Owner happy path and isolation
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
    $$insert into public.drill_configurations (user_id, name, preparation_seconds, exercise_seconds, rest_seconds, repetitions, random_start_enabled)
      values ('00000000-0000-4000-8000-00000000000a', 'Run', 5, 4, 2, 3, true)$$,
    'user A inserts a row with an explicit user_id'
);
select lives_ok(
    $$insert into public.drill_configurations (name, preparation_seconds, exercise_seconds, rest_seconds, repetitions)
      values ('Default owner', 0, 10, 0, 1)$$,
    'user_id defaults to auth.uid()'
);
select is(
    (select count(*) from public.drill_configurations where user_id = '00000000-0000-4000-8000-00000000000a'),
    2::bigint,
    'user A sees both own rows'
);
select is(
    (select random_start_enabled from public.drill_configurations where name = 'Run'),
    true,
    'parameters are stored as sent'
);

select throws_ok(
    $$insert into public.drill_configurations (user_id, name, preparation_seconds, exercise_seconds, rest_seconds, repetitions)
      values ('00000000-0000-4000-8000-00000000000b', 'Spoofed', 0, 10, 0, 1)$$,
    '42501',
    null,
    'user A cannot insert a row for user B'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);

select lives_ok(
    $$insert into public.drill_configurations (user_id, name, preparation_seconds, exercise_seconds, rest_seconds, repetitions)
      values ('00000000-0000-4000-8000-00000000000b', 'Run', 0, 10, 0, 1)$$,
    'the same name is allowed for a different user'
);
select is(
    (select count(*) from public.drill_configurations),
    1::bigint,
    'user B sees only own rows'
);

-- Updates and deletes of user A's rows by B affect nothing (RLS hides them).
select lives_ok(
    $$update public.drill_configurations set name = 'Hijacked' where user_id = '00000000-0000-4000-8000-00000000000a'$$,
    'user B updating user A rows is a silent no-op'
);
select lives_ok(
    $$delete from public.drill_configurations where user_id = '00000000-0000-4000-8000-00000000000a'$$,
    'user B deleting user A rows is a silent no-op'
);

reset role;

-- ---------------------------------------------------------------------------
-- S-11 reads: list and open-by-id with the exact column list and ordering the app uses.
-- A foreign id and a random id must be indistinguishable (zero rows), anon must be refused.
-- ---------------------------------------------------------------------------

select set_config('test.a_row_id', (select id::text from public.drill_configurations where name = 'Run' and user_id = '00000000-0000-4000-8000-00000000000a'), true);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
set local role authenticated;

select is(
    (select count(*) from public.drill_configurations where id = current_setting('test.a_row_id')::uuid),
    0::bigint,
    'user B opening user A row by id gets zero rows'
);
select is(
    (select count(*) from public.drill_configurations where id = '99999999-9999-4999-8999-999999999999'),
    0::bigint,
    'a random id also gets zero rows (same result as a foreign id)'
);
select is(
    (select count(*) from (
        select id, name, preparation_seconds, exercise_seconds, rest_seconds, repetitions, random_start_enabled, created_at, updated_at
        from public.drill_configurations order by created_at desc, id desc limit 50
    ) listed),
    1::bigint,
    'user B list query returns only user B rows'
);
select is(
    (select array_agg(name) from public.drill_configurations),
    array['Run'],
    'user B sees only own names, none of user A names'
);
select is(
    (select jsonb_agg(jsonb_build_array(name, preparation_seconds, exercise_seconds, rest_seconds, repetitions, random_start_enabled))
       from public.drill_configurations),
    '[["Run", 0, 10, 0, 1, false]]'::jsonb,
    'user B list row content is exactly the stored parameters'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

select is(
    (select count(*) from public.drill_configurations where id = current_setting('test.a_row_id')::uuid),
    1::bigint,
    'user A opens own row by id'
);
select is(
    (select count(*) from (
        select id, name, preparation_seconds, exercise_seconds, rest_seconds, repetitions, random_start_enabled, created_at, updated_at
        from public.drill_configurations order by created_at desc, id desc limit 50
    ) listed),
    2::bigint,
    'user A list query returns exactly the two own rows'
);
select is(
    (select array_agg(id) from (select id, name, preparation_seconds, exercise_seconds, rest_seconds, repetitions, random_start_enabled, created_at, updated_at
        from public.drill_configurations order by created_at desc, id desc limit 50) listed),
    (select array_agg(id order by id desc) from public.drill_configurations),
    'user A list is ordered by created_at desc with id desc as tie-break (both rows share a created_at here)'
);
select is(
    (select jsonb_agg(jsonb_build_array(name, preparation_seconds, exercise_seconds, rest_seconds, repetitions, random_start_enabled) order by name)
       from public.drill_configurations),
    '[["Default owner", 0, 10, 0, 1, false], ["Run", 5, 4, 2, 3, true]]'::jsonb,
    'user A list row content is exactly the stored parameters'
);

reset role;
set local role anon;

select throws_ok(
    $$select id, name from public.drill_configurations where id = '99999999-9999-4999-8999-999999999999'$$,
    '42501',
    null,
    'anon cannot open a row by id'
);

reset role;

select is(
    (select count(*) from public.drill_configurations where user_id = '00000000-0000-4000-8000-00000000000a' and name in ('Run', 'Default owner')),
    2::bigint,
    'user A rows are untouched by user B'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
    $$update public.drill_configurations set user_id = '00000000-0000-4000-8000-00000000000b' where name = 'Run'$$,
    '42501',
    null,
    'user_id cannot be changed (no column privilege)'
);
select lives_ok(
    $$update public.drill_configurations set name = 'Run renamed', repetitions = 7 where name = 'Run'$$,
    'the owner can update user-owned columns'
);
select lives_ok(
    $$update public.drill_configurations set name = 'RUN RENAMED' where name = 'Run renamed'$$,
    'a case-only rename of the same row does not violate uniqueness'
);

-- ---------------------------------------------------------------------------
-- Client-forbidden columns
-- ---------------------------------------------------------------------------

select throws_ok(
    $$insert into public.drill_configurations (id, user_id, name, preparation_seconds, exercise_seconds, rest_seconds, repetitions)
      values (gen_random_uuid(), '00000000-0000-4000-8000-00000000000a', 'Forged id', 0, 10, 0, 1)$$,
    '42501',
    null,
    'a client cannot supply id'
);
select throws_ok(
    $$insert into public.drill_configurations (user_id, name, preparation_seconds, exercise_seconds, rest_seconds, repetitions, created_at)
      values ('00000000-0000-4000-8000-00000000000a', 'Forged created', 0, 10, 0, 1, '2000-01-01')$$,
    '42501',
    null,
    'a client cannot supply created_at'
);
select throws_ok(
    $$update public.drill_configurations set created_at = now() where name = 'RUN RENAMED'$$,
    '42501',
    null,
    'a client cannot update created_at'
);
select throws_ok(
    $$update public.drill_configurations set updated_at = now() where name = 'RUN RENAMED'$$,
    '42501',
    null,
    'a client cannot update updated_at'
);
select throws_ok(
    $$update public.drill_configurations set id = gen_random_uuid() where name = 'RUN RENAMED'$$,
    '42501',
    null,
    'a client cannot update id'
);

-- ---------------------------------------------------------------------------
-- Name rules
-- ---------------------------------------------------------------------------

select throws_ok(
    $$insert into public.drill_configurations (name, preparation_seconds, exercise_seconds, rest_seconds, repetitions) values ('', 0, 10, 0, 1)$$,
    '23514', null, 'an empty name is rejected'
);
select throws_ok(
    $$insert into public.drill_configurations (name, preparation_seconds, exercise_seconds, rest_seconds, repetitions) values (repeat('x', 201), 0, 10, 0, 1)$$,
    '23514', null, '201 characters are rejected'
);
select lives_ok(
    $$insert into public.drill_configurations (name, preparation_seconds, exercise_seconds, rest_seconds, repetitions) values (repeat('x', 200), 0, 10, 0, 1)$$,
    '200 characters are accepted'
);
select throws_ok(
    $$insert into public.drill_configurations (name, preparation_seconds, exercise_seconds, rest_seconds, repetitions) values (repeat(E'\U0001F600', 201), 0, 10, 0, 1)$$,
    '23514', null, '201 astral characters are rejected (code points are counted)'
);
select lives_ok(
    $$insert into public.drill_configurations (name, preparation_seconds, exercise_seconds, rest_seconds, repetitions) values (repeat(E'\U0001F600', 200), 0, 10, 0, 1)$$,
    '200 astral characters are accepted (code points, not UTF-16 units)'
);
select throws_ok(
    $$insert into public.drill_configurations (name, preparation_seconds, exercise_seconds, rest_seconds, repetitions) values (' leading', 0, 10, 0, 1)$$,
    '23514', null, 'a leading space is rejected'
);
select throws_ok(
    $$insert into public.drill_configurations (name, preparation_seconds, exercise_seconds, rest_seconds, repetitions) values ('   ', 0, 10, 0, 1)$$,
    '23514', null, 'a whitespace-only name is rejected'
);
select throws_ok(
    $$insert into public.drill_configurations (name, preparation_seconds, exercise_seconds, rest_seconds, repetitions) values (E'Trailing\n', 0, 10, 0, 1)$$,
    '23514', null, 'a trailing newline is rejected'
);
select throws_ok(
    $$insert into public.drill_configurations (name, preparation_seconds, exercise_seconds, rest_seconds, repetitions) values (E'\tTabbed', 0, 10, 0, 1)$$,
    '23514', null, 'a leading tab is rejected'
);
select throws_ok(
    $$insert into public.drill_configurations (name, preparation_seconds, exercise_seconds, rest_seconds, repetitions) values (E'in\u0085side', 0, 10, 0, 1)$$,
    '23514', null, 'a C1 control character is rejected'
);
select throws_ok(
    $$insert into public.drill_configurations (name, preparation_seconds, exercise_seconds, rest_seconds, repetitions) values (E'é', 0, 10, 0, 1)$$,
    '23514', null, 'a decomposed (NFD) name is rejected'
);
select lives_ok(
    $$insert into public.drill_configurations (name, preparation_seconds, exercise_seconds, rest_seconds, repetitions) values (E'é', 0, 10, 0, 1)$$,
    'the composed (NFC) form is accepted'
);
select throws_ok(
    $$insert into public.drill_configurations (name, preparation_seconds, exercise_seconds, rest_seconds, repetitions) values ('RUN renamed', 0, 10, 0, 1)$$,
    '23505',
    'duplicate key value violates unique constraint "drill_configurations_user_name_key"',
    'a name differing only by case is a duplicate for the same user'
);
select throws_ok(
    $$insert into public.drill_configurations (name, preparation_seconds, exercise_seconds, rest_seconds, repetitions) values ('Default owner', 0, 10, 0, 1)$$,
    '23505',
    'duplicate key value violates unique constraint "drill_configurations_user_name_key"',
    'an identical name is a duplicate for the same user'
);

-- ---------------------------------------------------------------------------
-- Parameter ranges
-- ---------------------------------------------------------------------------

select throws_ok(
    $$insert into public.drill_configurations (name, preparation_seconds, exercise_seconds, rest_seconds, repetitions) values ('p-1', -1, 10, 0, 1)$$,
    '23514', null, 'preparation -1 is rejected'
);
select throws_ok(
    $$insert into public.drill_configurations (name, preparation_seconds, exercise_seconds, rest_seconds, repetitions) values ('p601', 601, 10, 0, 1)$$,
    '23514', null, 'preparation 601 is rejected'
);
select throws_ok(
    $$insert into public.drill_configurations (name, preparation_seconds, exercise_seconds, rest_seconds, repetitions) values ('e0', 0, 0, 0, 1)$$,
    '23514', null, 'exercise 0 is rejected'
);
select throws_ok(
    $$insert into public.drill_configurations (name, preparation_seconds, exercise_seconds, rest_seconds, repetitions) values ('e601', 0, 601, 0, 1)$$,
    '23514', null, 'exercise 601 is rejected'
);
select throws_ok(
    $$insert into public.drill_configurations (name, preparation_seconds, exercise_seconds, rest_seconds, repetitions) values ('r-1', 0, 10, -1, 1)$$,
    '23514', null, 'rest -1 is rejected'
);
select throws_ok(
    $$insert into public.drill_configurations (name, preparation_seconds, exercise_seconds, rest_seconds, repetitions) values ('r601', 0, 10, 601, 1)$$,
    '23514', null, 'rest 601 is rejected'
);
select throws_ok(
    $$insert into public.drill_configurations (name, preparation_seconds, exercise_seconds, rest_seconds, repetitions) values ('n0', 0, 10, 0, 0)$$,
    '23514', null, 'repetitions 0 is rejected'
);
select throws_ok(
    $$insert into public.drill_configurations (name, preparation_seconds, exercise_seconds, rest_seconds, repetitions) values ('n101', 0, 10, 0, 101)$$,
    '23514', null, 'repetitions 101 is rejected'
);
select lives_ok(
    $$insert into public.drill_configurations (name, preparation_seconds, exercise_seconds, rest_seconds, repetitions) values ('lower bounds', 0, 1, 0, 1)$$,
    'lower bounds (0 / 1 / 0 / 1) are accepted'
);
select lives_ok(
    $$insert into public.drill_configurations (name, preparation_seconds, exercise_seconds, rest_seconds, repetitions) values ('upper bounds', 600, 600, 600, 100)$$,
    'upper bounds (600 / 600 / 600 / 100) are accepted'
);
select throws_ok(
    $$update public.drill_configurations set repetitions = 101 where name = 'upper bounds'$$,
    '23514', null, 'an update outside the range is rejected'
);

reset role;

-- ---------------------------------------------------------------------------
-- updated_at (now() is constant inside one transaction, so seed an old value as postgres)
-- ---------------------------------------------------------------------------

insert into public.drill_configurations (user_id, name, preparation_seconds, exercise_seconds, rest_seconds, repetitions, updated_at)
values ('00000000-0000-4000-8000-00000000000c', 'stamped', 0, 10, 0, 1, '2000-01-01 00:00:00+00');

update public.drill_configurations set repetitions = 2 where name = 'stamped';

select ok(
    (select updated_at > '2000-01-01 00:00:00+00' from public.drill_configurations where name = 'stamped'),
    'updated_at moves forward on update'
);

-- ---------------------------------------------------------------------------
-- Limit of 50 per user
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000d","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
    $$insert into public.drill_configurations (name, preparation_seconds, exercise_seconds, rest_seconds, repetitions)
      select 'limit ' || g, 0, 10, 0, 1 from generate_series(1, 50) g$$,
    'a user can reach exactly 50 rows'
);
select throws_ok(
    $$insert into public.drill_configurations (name, preparation_seconds, exercise_seconds, rest_seconds, repetitions) values ('limit 51', 0, 10, 0, 1)$$,
    '54000',
    'drill_configuration_limit_reached',
    'the 51st row is rejected'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);

select lives_ok(
    $$insert into public.drill_configurations (name, preparation_seconds, exercise_seconds, rest_seconds, repetitions) values ('other user still fine', 0, 10, 0, 1)$$,
    'another user is not affected by the limit'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000d","role":"authenticated"}', true);

select lives_ok(
    $$delete from public.drill_configurations where name = 'limit 50'$$,
    'deleting one row works'
);
select lives_ok(
    $$insert into public.drill_configurations (name, preparation_seconds, exercise_seconds, rest_seconds, repetitions) values ('limit 50 again', 0, 10, 0, 1)$$,
    'deleting a row frees a slot'
);

-- Multi-row boundary: 49 existing rows plus one statement inserting two rows must fail, which
-- proves the row trigger sees earlier rows of the same statement (the function stays VOLATILE).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000e","role":"authenticated"}', true);

select lives_ok(
    $$insert into public.drill_configurations (name, preparation_seconds, exercise_seconds, rest_seconds, repetitions)
      select 'boundary ' || g, 0, 10, 0, 1 from generate_series(1, 49) g$$,
    'setup: user M has 49 rows'
);
select throws_ok(
    $$insert into public.drill_configurations (name, preparation_seconds, exercise_seconds, rest_seconds, repetitions)
      values ('boundary a', 0, 10, 0, 1), ('boundary b', 0, 10, 0, 1)$$,
    '54000',
    'drill_configuration_limit_reached',
    'a multi-row insert crossing the limit is rejected'
);
select is(
    (select count(*) from public.drill_configurations),
    49::bigint,
    'the rejected multi-row insert left 49 rows (statement is atomic)'
);
select lives_ok(
    $$insert into public.drill_configurations (name, preparation_seconds, exercise_seconds, rest_seconds, repetitions) values ('boundary 50', 0, 10, 0, 1)$$,
    'a single insert up to exactly 50 still works'
);

reset role;

select is(
    (select prosrc ~ 'pg_advisory_xact_lock' from pg_proc where oid = 'public.enforce_drill_configuration_limit()'::regprocedure),
    true,
    'the limit function takes the per-user advisory lock'
);
select is(
    (select provolatile from pg_proc where oid = 'public.enforce_drill_configuration_limit()'::regprocedure),
    'v'::"char",
    'the limit function is VOLATILE'
);
select is(
    (select prosecdef from pg_proc where oid = 'public.enforce_drill_configuration_limit()'::regprocedure),
    false,
    'the limit function is security invoker'
);
select is(
    (select proconfig from pg_proc where oid = 'public.enforce_drill_configuration_limit()'::regprocedure),
    array['search_path=""'],
    'the limit function pins search_path to empty'
);
select is(
    (select prosecdef from pg_proc where oid = 'public.set_updated_at()'::regprocedure),
    false,
    'the updated_at function is security invoker'
);
select is(
    (select proconfig from pg_proc where oid = 'public.set_updated_at()'::regprocedure),
    array['search_path=""'],
    'the updated_at function pins search_path to empty'
);

-- ---------------------------------------------------------------------------
-- S-12 edit: update isolation, name collisions, siblings, the 50-row limit
-- Fixed ids and an old updated_at (now() is constant inside one transaction).
-- ---------------------------------------------------------------------------

insert into public.drill_configurations (id, user_id, name, preparation_seconds, exercise_seconds, rest_seconds, repetitions, updated_at)
values
    ('00000000-0000-4000-8000-0000000012a1', '00000000-0000-4000-8000-00000000000a', 'S12 alpha', 0, 10, 0, 1, '2000-01-01 00:00:00+00'),
    ('00000000-0000-4000-8000-0000000012a2', '00000000-0000-4000-8000-00000000000a', 'S12 beta', 0, 10, 0, 1, '2000-01-01 00:00:00+00'),
    ('00000000-0000-4000-8000-0000000012b1', '00000000-0000-4000-8000-00000000000b', 'S12 gamma', 0, 10, 0, 1, '2000-01-01 00:00:00+00');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
set local role authenticated;

select is_empty(
    $$update public.drill_configurations set name = 'Hijacked', repetitions = 99 where id = '00000000-0000-4000-8000-0000000012a1' returning id$$,
    'user B updating user A row by id matches zero rows'
);

reset role;

select is(
    (select count(*) from public.drill_configurations
        where id = '00000000-0000-4000-8000-0000000012a1' and name = 'S12 alpha' and repetitions = 1 and updated_at = '2000-01-01 00:00:00+00'),
    1::bigint,
    'user A row is unchanged after the attempt by user B'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
    $$update public.drill_configurations set name = 's12 ALPHA' where id = '00000000-0000-4000-8000-0000000012a2'$$,
    '23505',
    'duplicate key value violates unique constraint "drill_configurations_user_name_key"',
    'renaming to another own row name (any case) hits the unique index'
);
select lives_ok(
    $$update public.drill_configurations set name = 'S12 gamma' where id = '00000000-0000-4000-8000-0000000012a2'$$,
    'a name owned by another user is allowed on update'
);
select lives_ok(
    $$update public.drill_configurations set repetitions = 9 where id = '00000000-0000-4000-8000-0000000012a1'$$,
    'the owner updates one row by id'
);

reset role;

select is(
    (select count(*) from public.drill_configurations
        where id = '00000000-0000-4000-8000-0000000012a1' and repetitions = 9 and updated_at > '2000-01-01 00:00:00+00'),
    1::bigint,
    'the updated row has the new value and a fresh updated_at'
);
select is(
    (select count(*) from public.drill_configurations
        where user_id = '00000000-0000-4000-8000-00000000000a' and name like 'S12 %' and updated_at > '2000-01-01 00:00:00+00'),
    2::bigint,
    'only the two rows A updated moved updated_at'
);
select is(
    (select count(*) from public.drill_configurations
        where id = '00000000-0000-4000-8000-0000000012b1' and name = 'S12 gamma' and repetitions = 1 and updated_at = '2000-01-01 00:00:00+00'),
    1::bigint,
    'user B row is untouched by user A updates'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000d","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
    $$update public.drill_configurations set repetitions = 2 where name = 'limit 1'$$,
    'a user at the 50-row limit can still update a row'
);

reset role;

select is(
    (select count(*) from public.drill_configurations where user_id = '00000000-0000-4000-8000-00000000000d'),
    50::bigint,
    'the update neither added nor removed rows for the user at the limit'
);

-- ---------------------------------------------------------------------------
-- S-13 delete: ownership of DELETE ... RETURNING id (the statement the app sends), siblings,
-- name reuse and the freed slot at the 50-row limit.
-- ---------------------------------------------------------------------------

insert into public.drill_configurations (id, user_id, name, preparation_seconds, exercise_seconds, rest_seconds, repetitions)
values
    ('00000000-0000-4000-8000-0000000013a1', '00000000-0000-4000-8000-00000000000a', 'S13 alpha', 0, 10, 0, 1),
    ('00000000-0000-4000-8000-0000000013a2', '00000000-0000-4000-8000-00000000000a', 'S13 beta', 0, 10, 0, 1),
    ('00000000-0000-4000-8000-0000000013b1', '00000000-0000-4000-8000-00000000000b', 'S13 gamma', 0, 10, 0, 1);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
set local role authenticated;

select is_empty(
    $$delete from public.drill_configurations where id = '00000000-0000-4000-8000-0000000013a1' returning id$$,
    'user B deleting user A row by id returns zero rows'
);

reset role;

select is(
    (select count(*) from public.drill_configurations where id = '00000000-0000-4000-8000-0000000013a1' and name = 'S13 alpha'),
    1::bigint,
    'user A row still exists after user B tried to delete it'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

select isnt_empty(
    $$delete from public.drill_configurations where id = '00000000-0000-4000-8000-0000000013a1' returning id$$,
    'user A deleting an own row by id returns the row'
);
select is_empty(
    $$delete from public.drill_configurations where id = '00000000-0000-4000-8000-0000000013a1' returning id$$,
    'a second delete of the same id returns zero rows'
);

reset role;

select is(
    (select count(*) from public.drill_configurations where id = '00000000-0000-4000-8000-0000000013a1'),
    0::bigint,
    'the deleted row is gone'
);
select is(
    (select count(*) from public.drill_configurations where id = '00000000-0000-4000-8000-0000000013a2' and name = 'S13 beta'),
    1::bigint,
    'a sibling of the same user is untouched'
);
select is(
    (select count(*) from public.drill_configurations where id = '00000000-0000-4000-8000-0000000013b1' and name = 'S13 gamma'),
    1::bigint,
    'another user row is untouched'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
    $$insert into public.drill_configurations (name, preparation_seconds, exercise_seconds, rest_seconds, repetitions) values ('S13 alpha', 0, 10, 0, 1)$$,
    'the name of a deleted timer can be used again'
);
select isnt_empty(
    $$delete from public.drill_configurations where name = 'S13 alpha' returning id$$,
    'the re-created timer can be deleted again'
);
select lives_ok(
    $$insert into public.drill_configurations (name, preparation_seconds, exercise_seconds, rest_seconds, repetitions) values ('S13 ALPHA', 0, 10, 0, 1)$$,
    'the same name in another case can be used after a delete'
);

reset role;
set local role anon;

select throws_ok(
    $$delete from public.drill_configurations where id = '00000000-0000-4000-8000-0000000013a2' returning id$$,
    '42501',
    null,
    'anon cannot delete'
);

reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000d","role":"authenticated"}', true);
set local role authenticated;

select isnt_empty(
    $$delete from public.drill_configurations where name = 'limit 2' returning id$$,
    'a user at the 50-row limit can delete one row'
);
select throws_ok(
    $$insert into public.drill_configurations (name, preparation_seconds, exercise_seconds, rest_seconds, repetitions)
      values ('S13 over a', 0, 10, 0, 1), ('S13 over b', 0, 10, 0, 1)$$,
    '54000',
    'drill_configuration_limit_reached',
    'one freed slot is one slot: two inserts are still over the limit'
);
select lives_ok(
    $$insert into public.drill_configurations (name, preparation_seconds, exercise_seconds, rest_seconds, repetitions) values ('S13 refill', 0, 10, 0, 1)$$,
    'the freed slot can be used by one insert'
);

reset role;

select is(
    (select count(*) from public.drill_configurations where user_id = '00000000-0000-4000-8000-00000000000d'),
    50::bigint,
    'the user at the limit is back at exactly 50 rows'
);

-- ---------------------------------------------------------------------------
-- Cascade
-- ---------------------------------------------------------------------------

delete from auth.users where id = '00000000-0000-4000-8000-00000000000c';

select is(
    (select count(*) from public.drill_configurations where user_id = '00000000-0000-4000-8000-00000000000c'),
    0::bigint,
    'deleting the auth user cascades to the drill configurations'
);

select * from finish();

rollback;
