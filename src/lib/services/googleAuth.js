import { supabase } from './supabaseService';

export const googleSignIn = async () => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}` : undefined,
      },
    });
    if (error) throw error;
    return { data };
  } catch (error) {
    console.error('Google Sign In Error:', error);
    throw error;
  }
};

export const googleSignOut = async () => {
  await supabase.auth.signOut();
};

export const initAuth = (onAuthSuccess, onAuthFailure) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      if (onAuthSuccess) onAuthSuccess(session.user, session.access_token);
    } else {
      if (onAuthFailure) onAuthFailure();
    }
  });

  return () => {
    subscription.unsubscribe();
  };
};

export const getAccessToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
};
