# BSource Training

Corporate training platform: rotating-QR attendance, AI-generated assessments,
and an admin governance console. Next.js App Router + Supabase.

## Setup

1. **Configure the environment.** Copy `.env.example` to `.env.local` and fill in
   your Supabase URL and publishable key. There are no inline fallbacks: the app
   fails to start rather than connecting to an unexpected project.

2. **Set the public site URL.** Add `NEXT_PUBLIC_SITE_URL` (your deployed
   origin, no trailing slash), then in the Supabase dashboard go to
   **Authentication -> URL Configuration** and add
   `<that value>/auth/callback` to **Redirect URLs**.

   Confirmation emails are built by Supabase as
   `…/auth/v1/verify?…&redirect_to=<app>/auth/callback`. If the app sends no
   redirect, Supabase falls back to the project's Site URL — normally
   `http://localhost:3000` — so emails from a deployment send people to their
   own machine. `/auth/callback` is what exchanges the code for a session.

3. **Create the schema.** Run `supabase_schema.sql` in the Supabase SQL editor.

   The `DROP TABLE` block near the top is commented out, because running it
   unconditionally wipes every profile, training, attendance record and quiz
   attempt. Uncomment it only when you mean to rebuild from scratch.

4. **Apply the security migration — required.** Run
   `supabase/migrations/0001_security_and_settings.sql`.

   `supabase_schema.sql` enables row level security but defines no policies, so
   until this migration runs every query is denied. The migration creates the
   role-aware policies plus:

   - `app_settings` — what the admin System Policies screen writes to
   - `claim_provisioned_profile()` — links an admin-provisioned profile to the
     auth user who later signs up with that email
   - a trigger that rejects attendance rows carrying an expired or mismatched
     QR token
   - a trigger that recomputes every quiz score from the answer key, so a
     submitted score is ignored
   - the `training-materials` storage bucket

5. **Optional — put the role in the JWT.** `src/proxy.js` trusts
   `app_metadata.role` for its edge-side redirect, and ignores
   `user_metadata.role` because a user can set that themselves with
   `auth.updateUser`. The last section of the migration has a commented-out
   access-token hook that populates the trusted claim from `profiles.role`.

   Without the hook the proxy only checks that the caller is signed in; role
   enforcement then rests on the database-backed guard in `AppContext` and on
   row level security. That is one fewer layer, not a hole.

6. **Create the first admin.** Sign in to the app once — that is when your
   `profiles` row is created, as a `trainee`. Then open
   `supabase/migrations/0002_bootstrap_admin.sql`, set `target_email` at the top
   of the block, paste the whole file into the Supabase SQL editor and run it.
   Sign out and back in afterwards so a fresh token carries the new claim.

   It is deliberately a single `do $$ ... $$` statement: the SQL editor pools
   connections, so a temp table or session variable would not survive to the
   next statement. Two optional flags in the same block reassign the seeded
   demo trainings to you and delete the seeded demo profiles. The block refuses
   to run if the account does not exist or has never signed in.

7. **Optional — AI quiz generation.** Set `ANTHROPIC_API_KEY` (or
   `GEMINI_API_KEY`). The provider is chosen from the model selected in
   **Admin → System Policies**: a `claude-*` model calls Anthropic, a `gemini-*`
   model calls Google. The default is `claude-opus-5`.

   Both keys are read server-side in the route handler only and never reach the
   browser. Without the relevant key, `/api/quiz/generate` returns template
   questions and says so in its `warning`, rather than presenting them as AI
   output.

## Development

```bash
npm run dev     # http://localhost:3000
npm run build   # production build
npm run lint
```

## Where things live

| Path | Purpose |
| --- | --- |
| `src/proxy.js` | Session refresh + optimistic route gating |
| `src/lib/auth/access.js` | Which roles may open which routes |
| `src/lib/services/supabaseService.js` | All database access; throws on failure |
| `src/lib/services/fileExtractor.js` | PDF / DOCX / PPTX / TXT text extraction |
| `src/app/api/attendance/mark` | Validates a QR token against the live session |
| `src/app/api/quiz/submit` | Grades an attempt against the answer key |
| `src/app/api/quiz/generate` | Writes questions with Claude (or Gemini) |
| `src/app/auth/callback` | Exchanges an email-confirmation code for a session |
| `src/lib/auth/site-url.js` | Resolves the public origin for redirect links |

## Security model

Authorization is enforced in Postgres, not in the browser. The publishable key
ships in the client bundle, so anything the policies allow is reachable by
anyone holding it; the policies are the boundary. `src/proxy.js` and the
client-side role check are conveniences that keep people out of screens they
cannot use, not security controls.

Two role claims exist on the JWT and they are not interchangeable:

| Claim | Who can write it | Trusted for privilege |
| --- | --- | --- |
| `app_metadata.role` | service role, access-token hook | yes |
| `user_metadata.role` | the user, via `auth.updateUser` | no |

The proxy only acts on the first. Switching workspace writes `profiles.role`
(what RLS reads), mirrors it into `user_metadata` and refreshes the session so
the hook can re-issue the trusted claim.

