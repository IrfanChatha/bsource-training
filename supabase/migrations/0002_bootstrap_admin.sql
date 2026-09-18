-- =============================================================================
--  Bootstrap: grant yourself the admin role
-- =============================================================================
--  Run this ONCE, and only after you have signed in to the app at least once —
--  signing in is what creates your `public.profiles` row (as a `trainee`).
--
--  Why it is needed: the policies in 0001 let an admin manage everyone, but
--  nobody can grant themselves `admin` through the app. That is deliberate —
--  `profiles_update_self` only permits trainer/trainee. The first admin has to
--  be made here, with the SQL editor's elevated rights.
--
--  HOW TO RUN
--    1. Supabase dashboard -> SQL Editor -> New query
--    2. Paste this whole file
--    3. Edit the settings at the top of the block below
--    4. Run
--    5. Sign out of the app and sign back in
--
--  Not sure which email? Dashboard -> Authentication -> Users lists them.
--
--  Everything is one statement on purpose: the SQL editor pools connections, so
--  a temp table or a session variable would not survive to the next statement.
-- =============================================================================

do $$
declare
  ---------------------------------------------------------------------------
  -- ▼▼▼  EDIT THESE  ▼▼▼
  ---------------------------------------------------------------------------

  -- The address you sign in to the app with.
  target_email text := 'you@example.com';

  -- The three seeded trainings are owned by 'usr_trainer_01', which is not a
  -- real account. Under the 0001 policies that means nobody can start their
  -- attendance session or edit their quiz. Set to true to hand them to you.
  adopt_seeded_trainings boolean := false;

  -- The four seeded demo profiles have no auth user, so they can never sign
  -- in; they just clutter the admin User Directory. Set to true to delete
  -- them. Deleting cascades to any training still owned by them, so leave
  -- adopt_seeded_trainings on as well if you want to keep those.
  remove_demo_profiles boolean := false;

  ---------------------------------------------------------------------------
  -- ▲▲▲  EDIT THESE  ▲▲▲
  ---------------------------------------------------------------------------

  target      text := lower(target_email);
  my_id       text;
  my_name     text;
  moved       integer := 0;
  removed     integer := 0;
begin
  if not exists (select 1 from auth.users where lower(email) = target) then
    raise exception
      'No account exists for %. Sign up in the app first, then run this file.', target;
  end if;

  select id, full_name
    into my_id, my_name
    from public.profiles
   where lower(email) = target;

  if my_id is null then
    raise exception
      'Account % exists but has no profile row yet. Sign in to the app once, then run this file.', target;
  end if;

  -- 1. The role that row level security actually reads.
  update public.profiles set role = 'admin' where id = my_id;

  -- 2. Mirror it into the JWT's app_metadata.
  --
  -- `src/proxy.js` trusts `app_metadata.role` because only the service role and
  -- the access-token hook can write it; it ignores `user_metadata.role`, which
  -- the user can set themselves. Without this the proxy simply checks that you
  -- are signed in and leaves the role check to the app and to the policies.
  update auth.users
     set raw_app_meta_data = jsonb_set(
           coalesce(raw_app_meta_data, '{}'::jsonb), '{role}', '"admin"'
         )
   where lower(email) = target;

  raise notice 'Granted admin to % (profile id %).', target, my_id;

  -- 3. Optional: take ownership of the seeded trainings.
  if adopt_seeded_trainings then
    update public.trainings
       set trainer_id = my_id, trainer_name = coalesce(my_name, 'Trainer')
     where trainer_id = 'usr_trainer_01';
    get diagnostics moved = row_count;
    raise notice 'Reassigned % seeded training(s) to you.', moved;
  end if;

  -- 4. Optional: clear the demo profiles.
  if remove_demo_profiles then
    delete from public.profiles
     where id in ('usr_trainer_01', 'usr_trainee_01', 'usr_trainee_02', 'usr_trainee_03');
    get diagnostics removed = row_count;
    raise notice 'Removed % demo profile(s).', removed;
  end if;

  raise notice 'Done. Sign out of the app and sign back in so a fresh token carries the claim.';
end $$;


-- Confirm. Expect your account, with role = admin AND app_role = admin.
-- No email needed here: this simply lists every admin.
select p.id,
       p.email,
       p.full_name,
       p.role,
       p.department,
       u.raw_app_meta_data ->> 'role' as app_role
  from public.profiles p
  join auth.users u on u.id::text = p.id
 where p.role = 'admin'
 order by p.email;
