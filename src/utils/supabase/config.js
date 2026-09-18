/**
 * Shared Supabase connection config.
 *
 * These are read from the environment only. There are deliberately no inline
 * fallbacks: a build that is missing its configuration must fail loudly rather
 * than silently connect a developer's machine to the production project.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function requireSupabaseConfig() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) ' +
        'in your environment. See .env.example.'
    );
  }
  return { url: SUPABASE_URL, key: SUPABASE_KEY };
}

export const isSupabaseConfigured = () => !!(SUPABASE_URL && SUPABASE_KEY);
