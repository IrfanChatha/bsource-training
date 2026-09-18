"use client";
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabaseService } from '../lib/services/supabaseService';
import { STORAGE_KEYS, readStored, writeStored } from '../lib/storage';
import { SELF_ASSIGNABLE_ROLES, canAccess, homeRouteFor, isPublicRoute } from '../lib/auth/access';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const router = useRouter();
  const pathname = usePathname() || '/';

  // There is deliberately no placeholder user. Until the Supabase session has
  // been read, `currentUser` is null and `authReady` is false, so screens show
  // a loading state instead of somebody else's identity.
  const [currentUser, setCurrentUserState] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  const navigate = useCallback(
    (path) => {
      if (router && typeof router.push === 'function') {
        router.push(path);
      } else if (typeof window !== 'undefined') {
        window.location.href = path;
      }
    },
    [router]
  );

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Theme is a purely local preference and can be applied immediately.
  useEffect(() => {
    const isDark = readStored(STORAGE_KEYS.theme) === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    const raf = requestAnimationFrame(() => setDarkMode(isDark));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Identity comes from the Supabase session, never from localStorage alone.
  useEffect(() => {
    let active = true;

    supabaseService
      .loadSessionProfile()
      .then((profile) => {
        if (!active) return;
        setCurrentUserState(profile);
      })
      .catch(() => {
        if (active) setCurrentUserState(null);
      })
      .finally(() => {
        if (active) setAuthReady(true);
      });

    const unsubscribe = supabaseService.onAuthChange((profile) => {
      if (!active) return;
      setCurrentUserState(profile);
      setAuthReady(true);
    });

    return () => {
      active = false;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Secure-side companion to the proxy check: if the profile role loaded from
  // the database does not permit this route, leave it.
  useEffect(() => {
    if (!authReady) return;
    if (isPublicRoute(pathname)) return;
    if (!currentUser) {
      navigate(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!canAccess(pathname, currentUser.role)) {
      navigate(homeRouteFor(currentUser.role));
    }
  }, [authReady, currentUser, pathname, navigate]);

  const setCurrentUser = useCallback((user) => {
    setCurrentUserState(user);
    supabaseService.setCurrentUser(user);
  }, []);

  const toggleDarkMode = (val) => {
    const nextVal = typeof val === 'boolean' ? val : !darkMode;
    setDarkMode(nextVal);
    writeStored(STORAGE_KEYS.theme, nextVal ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', nextVal);
    document.documentElement.setAttribute('data-theme', nextVal ? 'dark' : 'light');
  };

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  /**
   * Moves the signed-in user between the Trainer and Trainee workspaces.
   *
   * `admin` is not self-assignable: the `profiles_update_self` policy only
   * permits trainer/trainee, so an attempt would be rejected by the database
   * anyway. The service writes the profile and the JWT metadata together and
   * reads the row back, so this either fully succeeds or reports why not.
   */
  const [switchingRole, setSwitchingRole] = useState(false);

  const switchRole = async (newRole, shouldNavigate = true) => {
    if (!currentUser || switchingRole) return;
    if (!SELF_ASSIGNABLE_ROLES.includes(newRole)) {
      showToast('Only an administrator can grant that role.', 'error');
      return;
    }
    if (currentUser.role === newRole) return;

    setSwitchingRole(true);
    try {
      const profile = await supabaseService.setOwnRole(newRole);
      setCurrentUserState(profile);

      const roleTitle = newRole === 'trainer' ? 'Trainer Hub' : 'Trainee Portal';
      showToast(`Switched active workspace to ${roleTitle}`, 'info');

      if (shouldNavigate) navigate(homeRouteFor(newRole));
    } catch (e) {
      showToast(e?.message || 'Could not switch workspace. Please try again.', 'error');
    } finally {
      setSwitchingRole(false);
    }
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        authReady,
        switchRole,
        switchingRole,
        toasts,
        showToast,
        darkMode,
        setDarkMode: toggleDarkMode,
        navigate,
        pathname,
        currentPath: pathname,
        mounted
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
export default AppContext;
