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
--    3. Change the email on the ONE marked line below
--    4. Run
--    5. Sign out of the app and sign back in
--
--  Not sure which email? Dashboard -> Authentication -> Users lists them.
-- =============================================================================


-- ▼▼▼ THE ONLY LINE YOU NEED TO EDIT ▼▼▼
create temp table _bootstrap_admin as select 'you@example.com'::text as email;
-- ▲▲▲ THE ONLY LINE YOU NEED TO EDIT ▲▲▲


-- 1. Fail early and loudly if that address has no account or has never signed in.
do $$
declare
  target text := (select lower(email) from _bootstrap_admin);
  has_auth boolean;
  has_profile boolean;
begin
  select exists (select 1 from auth.users where lower(email) = target) into has_auth;
  select exists (select 1 from public.profiles where lower(email) = target) into has_profile;

  if not has_auth then
    raise exception
      'No account exists for %. Sign up in the app first, then run this file.', target;
  end if;

  if not has_profile then
    raise exception
      'Account % exists but has no profile row yet. Sign in to the app once, then run this file.', target;
  end if;
end $$;


-- 2. The role that row level security actually reads.
update public.profiles
   set role = 'admin'
 where lower(email) = (select lower(email) from _bootstrap_admin);


-- 3. Mirror it into the JWT's app_metadata.
--
-- `src/proxy.js` trusts `app_metadata.role` because only the service role and
-- the access-token hook can write it; it ignores `user_metadata.role`, which
-- the user can set themselves. Without this line the proxy simply checks that
-- you are signed in and leaves the role check to the app and to the policies.
update auth.users
   set raw_app_meta_data = jsonb_set(
         coalesce(raw_app_meta_data, '{}'::jsonb), '{role}', '"admin"'
       )
 where lower(email) = (select lower(email) from _bootstrap_admin);


-- 4. Confirm. Expect one row, with role = admin AND app_role = admin.
select p.id,
       p.email,
       p.full_name,
       p.role,
       p.department,
       u.raw_app_meta_data ->> 'role' as app_role
  from public.profiles p
  join auth.users u on u.id::text = p.id
 where lower(p.email) = (select lower(email) from _bootstrap_admin);


-- Sign out and back in now. The new claim only reaches the browser when a
-- fresh access token is issued.


-- =============================================================================
--  Optional: adopt the seeded demo trainings
-- =============================================================================
--  The seed data in supabase_schema.sql assigns every training to
--  `usr_trainer_01`, which is not a real account. Under the 0001 policies
--  `owns_training()` is false for everyone except an admin, so no trainer can
--  run attendance or edit a quiz on those rows.
--
--  Uncomment to hand them to yourself.
-- =============================================================================

-- update public.trainings
--    set trainer_id   = (select id from public.profiles
--                         where lower(email) = (select lower(email) from _bootstrap_admin)),
--        trainer_name = (select full_name from public.profiles
--                         where lower(email) = (select lower(email) from _bootstrap_admin))
--  where trainer_id = 'usr_trainer_01';


-- =============================================================================
--  Optional: remove the seeded demo profiles
-- =============================================================================
--  These four rows have no matching auth user, so they can never sign in. They
--  show up in the admin User Directory as noise.
--
--  Run the adoption step above FIRST — deleting these cascades to any training
--  still pointing at them.
-- =============================================================================

-- delete from public.profiles
--  where id in ('usr_trainer_01', 'usr_trainee_01', 'usr_trainee_02', 'usr_trainee_03');


drop table if exists _bootstrap_admin;
