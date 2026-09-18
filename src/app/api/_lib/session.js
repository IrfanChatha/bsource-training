import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';

/**
 * Resolves the caller from the Supabase session cookie.
 *
 * Route handlers must never trust an id sent in the request body — this is the
 * only place a user identity enters the server.
 */
export async function getSessionContext() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { supabase, user: null, profile: null };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  return { supabase, user, profile };
}
