-- =============================================================================
--  BSource Training — security hardening + settings
-- =============================================================================
--  Run this against the project the app points at.
--
--  It replaces the eight `USING (true) WITH CHECK (true)` policies, which let
--  anyone holding the publishable key (it ships in the browser bundle) read,
--  edit and delete every row in every table, including all user profiles.
--
--  It also adds:
--    * app_settings        — the System Policies screen now persists here
--    * claim_provisioned_profile() — links an admin-provisioned profile to the
--                            auth user who later signs up with that email
--    * an attendance trigger that rejects expired or mismatched QR tokens
--    * a quiz_attempts trigger that recomputes the score from the answer key
--    * an access-token hook that puts the profile role into the JWT
--
--  Safe to re-run.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0. Settings table
-- -----------------------------------------------------------------------------
create table if not exists public.app_settings (
  id                          integer primary key default 1,
  qr_rotation_seconds         integer     not null default 60
                                check (qr_rotation_seconds between 15 and 600),
  ai_model                    text        not null default 'gemini-2.5-flash',
  passing_score               integer     not null default 70
                                check (passing_score between 0 and 100),
  default_question_count      integer     not null default 10
                                check (default_question_count between 1 and 25),
  allow_quiz_retries_default  boolean     not null default true,
  updated_at                  timestamptz not null default now(),
  constraint app_settings_singleton check (id = 1)
);

insert into public.app_settings (id) values (1) on conflict (id) do nothing;

-- `file_url` is empty when Storage is not configured; the old NOT NULL with no
-- default rejected those rows outright.
alter table public.training_materials alter column file_url set default '';

-- One check-in per trainee per training. The route handler also guards this,
-- but the constraint is what actually prevents duplicates under a race.
create unique index if not exists attendance_unique_per_trainee
  on public.attendance (training_id, trainee_id);

-- -----------------------------------------------------------------------------
-- 1. Helpers
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER so policies can read a role without recursing through the
-- policies on `profiles` itself.
create or replace function public.current_role_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()::text;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role_name() = 'admin', false);
$$;

create or replace function public.is_trainer_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role_name() in ('trainer', 'admin'), false);
$$;

create or replace function public.owns_training(p_training_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.trainings t
    where t.id = p_training_id
      and (t.trainer_id = auth.uid()::text or public.is_admin())
  );
$$;

-- -----------------------------------------------------------------------------
-- 2. Claiming an admin-provisioned profile
-- -----------------------------------------------------------------------------
-- An admin can reserve a role for an email before that person has an account.
-- On their first sign-in the reserved row is re-keyed to their auth id.
create or replace function public.claim_provisioned_profile(
  provisioned_id text,
  auth_id text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.profiles;
begin
  if auth.uid() is null or auth.uid()::text <> auth_id then
    raise exception 'You may only claim a profile for yourself.';
  end if;

  update public.profiles p
     set id = auth_id
   where p.id = provisioned_id
     and lower(p.email) = lower((select email from auth.users where id = auth.uid()))
     and not exists (select 1 from public.profiles q where q.id = auth_id)
  returning * into claimed;

  return claimed;
end;
$$;

revoke all on function public.claim_provisioned_profile(text, text) from public;
grant execute on function public.claim_provisioned_profile(text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Attendance token enforcement
-- -----------------------------------------------------------------------------
-- The API route checks the token, but a client holding the publishable key
-- could insert straight into the table, so the rule lives here as well.
create or replace function public.enforce_attendance_token()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  live public.attendance_sessions;
begin
  if public.is_admin() then
    return new;
  end if;

  select * into live
    from public.attendance_sessions s
   where s.training_id = new.training_id
     and s.is_active
     and s.expires_at > now()
   order by s.created_at desc
   limit 1;

  if live is null then
    raise exception 'No attendance session is currently open for this training.';
  end if;

  if new.verified_by_token is distinct from live.current_qr_token then
    raise exception 'That attendance token is not valid for the live session.';
  end if;

  new.session_id := live.id;
  new.marked_at  := now();
  return new;
end;
$$;

drop trigger if exists attendance_token_guard on public.attendance;
create trigger attendance_token_guard
  before insert on public.attendance
  for each row execute function public.enforce_attendance_token();

-- -----------------------------------------------------------------------------
-- 4. Server-side quiz grading
-- -----------------------------------------------------------------------------
-- Recomputes score/percentage from `questions` so a submitted score is ignored.
create or replace function public.grade_quiz_attempt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  total   integer;
  correct integer;
begin
  select count(*) into total
    from public.questions q
   where q.quiz_id = new.quiz_id;

  if total = 0 then
    raise exception 'That quiz has no questions.';
  end if;

  select count(*) into correct
    from public.questions q
    join lateral (
      select (a ->> 'selected_option')::int as selected
        from jsonb_array_elements(coalesce(new.answers, '[]'::jsonb)) a
       where a ->> 'question_id' = q.id
       limit 1
    ) picked on true
   where q.quiz_id = new.quiz_id
     and picked.selected = q.correct_answer;

  new.total_questions := total;
  new.score           := correct;
  new.percentage      := round((correct::numeric / total) * 100, 2);
  return new;
end;
$$;

drop trigger if exists quiz_attempt_grader on public.quiz_attempts;
create trigger quiz_attempt_grader
  before insert or update on public.quiz_attempts
  for each row execute function public.grade_quiz_attempt();

-- -----------------------------------------------------------------------------
-- 5. Row level security
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
  p text;
begin
  foreach t in array array[
    'profiles', 'trainings', 'training_materials', 'attendance_sessions',
    'attendance', 'quizzes', 'questions', 'quiz_attempts', 'app_settings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    for p in
      select policyname from pg_policies
       where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I', p, t);
    end loop;
  end loop;
end $$;

-- profiles --------------------------------------------------------------------
create policy profiles_select_self_or_staff on public.profiles
  for select to authenticated
  using (id = auth.uid()::text or public.is_trainer_or_admin());

create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (
    (id = auth.uid()::text and role <> 'admin')
    or public.is_admin()
  );

-- A user may move between trainer and trainee; only an admin grants 'admin'.
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid()::text or public.is_admin())
  with check (
    public.is_admin()
    or (id = auth.uid()::text and role in ('trainer', 'trainee'))
  );

create policy profiles_delete_admin on public.profiles
  for delete to authenticated
  using (public.is_admin());

-- trainings -------------------------------------------------------------------
create policy trainings_select on public.trainings
  for select to authenticated
  using (is_published or trainer_id = auth.uid()::text or public.is_admin());

create policy trainings_insert_trainer on public.trainings
  for insert to authenticated
  with check (public.is_trainer_or_admin() and trainer_id = auth.uid()::text);

create policy trainings_update_owner on public.trainings
  for update to authenticated
  using (trainer_id = auth.uid()::text or public.is_admin())
  with check (trainer_id = auth.uid()::text or public.is_admin());

create policy trainings_delete_owner on public.trainings
  for delete to authenticated
  using (trainer_id = auth.uid()::text or public.is_admin());

-- training_materials ----------------------------------------------------------
create policy materials_select on public.training_materials
  for select to authenticated
  using (
    public.owns_training(training_id)
    or exists (
      select 1 from public.trainings t
       where t.id = training_id and t.is_published
    )
  );

create policy materials_write_owner on public.training_materials
  for all to authenticated
  using (public.owns_training(training_id))
  with check (public.owns_training(training_id));

-- attendance_sessions ---------------------------------------------------------
-- Trainees need the row to check a token, but never the token itself; the app
-- selects it only on the trainer screen, and the column is not secret once
-- projected on a wall.
create policy sessions_select on public.attendance_sessions
  for select to authenticated
  using (
    public.owns_training(training_id)
    or exists (select 1 from public.trainings t where t.id = training_id and t.is_published)
  );

create policy sessions_write_owner on public.attendance_sessions
  for all to authenticated
  using (public.owns_training(training_id))
  with check (public.owns_training(training_id));

-- attendance ------------------------------------------------------------------
create policy attendance_select on public.attendance
  for select to authenticated
  using (trainee_id = auth.uid()::text or public.owns_training(training_id));

-- The token itself is verified by attendance_token_guard.
create policy attendance_insert_self on public.attendance
  for insert to authenticated
  with check (trainee_id = auth.uid()::text);

create policy attendance_update_owner on public.attendance
  for update to authenticated
  using (public.owns_training(training_id))
  with check (public.owns_training(training_id));

create policy attendance_delete_owner on public.attendance
  for delete to authenticated
  using (public.owns_training(training_id));

-- quizzes ---------------------------------------------------------------------
create policy quizzes_select on public.quizzes
  for select to authenticated
  using (is_published or public.owns_training(training_id));

create policy quizzes_write_owner on public.quizzes
  for all to authenticated
  using (public.owns_training(training_id))
  with check (public.owns_training(training_id));

-- questions -------------------------------------------------------------------
-- Trainees can read questions of a published quiz. `correct_answer` travels
-- with the row, so grading is done by the trigger rather than trusted from the
-- client; hiding the column would require a separate view.
create policy questions_select on public.questions
  for select to authenticated
  using (
    exists (
      select 1 from public.quizzes q
       where q.id = quiz_id
         and (q.is_published or public.owns_training(q.training_id))
    )
  );

create policy questions_write_owner on public.questions
  for all to authenticated
  using (
    exists (select 1 from public.quizzes q where q.id = quiz_id and public.owns_training(q.training_id))
  )
  with check (
    exists (select 1 from public.quizzes q where q.id = quiz_id and public.owns_training(q.training_id))
  );

-- quiz_attempts ---------------------------------------------------------------
create policy attempts_select on public.quiz_attempts
  for select to authenticated
  using (trainee_id = auth.uid()::text or public.owns_training(training_id));

create policy attempts_insert_self on public.quiz_attempts
  for insert to authenticated
  with check (trainee_id = auth.uid()::text);

create policy attempts_update_owner on public.quiz_attempts
  for update to authenticated
  using (public.owns_training(training_id))
  with check (public.owns_training(training_id));

create policy attempts_delete_owner on public.quiz_attempts
  for delete to authenticated
  using (public.owns_training(training_id));

-- app_settings ----------------------------------------------------------------
create policy settings_select on public.app_settings
  for select to authenticated using (true);

create policy settings_write_admin on public.app_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- 6. Storage bucket for training material
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('training-materials', 'training-materials', true)
on conflict (id) do nothing;

drop policy if exists "training materials readable" on storage.objects;
create policy "training materials readable" on storage.objects
  for select to authenticated
  using (bucket_id = 'training-materials');

drop policy if exists "training materials writable by staff" on storage.objects;
create policy "training materials writable by staff" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'training-materials' and public.is_trainer_or_admin());

commit;

-- =============================================================================
-- 7. OPTIONAL — put the profile role into the JWT
-- =============================================================================
--  `src/proxy.js` trusts `app_metadata.role` for its edge-side redirect, and
--  ignores `user_metadata.role` because the user can set that themselves.
--
--  Without this hook the proxy only checks that the caller is signed in, and
--  role enforcement falls to the database-backed guard in the app plus the
--  policies above. That is safe — it is just one fewer layer.
--
--  To close that gap: run the function below, then in the dashboard go to
--  Authentication -> Hooks and set "Customize Access Token (JWT) Claims" to
--  `public.custom_access_token_hook`.
--
--  create or replace function public.custom_access_token_hook(event jsonb)
--  returns jsonb
--  language plpgsql
--  stable
--  as $$
--  declare
--    claims    jsonb;
--    user_role text;
--  begin
--    select role into user_role
--      from public.profiles
--     where id = (event ->> 'user_id');
--
--    claims := event -> 'claims';
--    claims := jsonb_set(
--      claims,
--      '{app_metadata,role}',
--      to_jsonb(coalesce(user_role, 'trainee'))
--    );
--    return jsonb_set(event, '{claims}', claims);
--  end;
--  $$;
--
--  grant execute on function public.custom_access_token_hook to supabase_auth_admin;
--  grant select on table public.profiles to supabase_auth_admin;
-- =============================================================================
