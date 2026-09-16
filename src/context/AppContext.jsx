"use client";
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabaseService } from '../lib/services/supabaseService';

const AppContext = createContext(null);

const DEFAULT_USER = {
  id: 'usr_trainer_01',
  name: 'Sarah Jenkins',
  full_name: 'Sarah Jenkins',
  email: 'sarah.j@enterprise.internal',
  role: 'trainer',
  department: 'Global Security & Operations',
  avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'
};

export function AppProvider({ children }) {
  const router = useRouter();
  const pathname = usePathname() || '/';

  // Consistent initial state for SSR
  const [currentUser, setCurrentUser] = useState(DEFAULT_USER);
  const [toasts, setToasts] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      // Sync Theme
      const savedTheme = localStorage.getItem('traintrack_theme');
      const isDark = savedTheme === 'dark';
      setDarkMode(isDark);
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }

      // Sync User Profile
      const savedUser = localStorage.getItem('traintrack_user');
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          if (parsed && parsed.role) {
            setCurrentUser(parsed);
          }
        } catch (e) {}
      }
    }
  }, []);

  const toggleDarkMode = (val) => {
    const nextVal = typeof val === 'boolean' ? val : !darkMode;
    setDarkMode(nextVal);
    if (typeof window !== 'undefined') {
      localStorage.setItem('traintrack_theme', nextVal ? 'dark' : 'light');
      if (nextVal) {
        document.documentElement.classList.add('dark');
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.setAttribute('data-theme', 'light');
      }
    }
  };

  const showToast = (message, type = 'info') => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const switchRole = async (newRole, shouldNavigate = true) => {
    if (!currentUser) return;
    const updatedUser = {
      ...currentUser,
      role: newRole
    };

    setCurrentUser(updatedUser);
    supabaseService.setCurrentUser(updatedUser);

    // Persist to Supabase Database (profiles table)
    if (updatedUser.id) {
      try {
        await supabaseService.updateUserProfile(updatedUser.id, { role: newRole });
      } catch (e) {
        console.warn('Could not sync role change to database:', e);
      }
    }

    const roleTitle = newRole === 'trainer' ? 'Trainer Hub' : newRole === 'trainee' ? 'Trainee Portal' : 'Admin';
    showToast(`Switched active workspace to ${roleTitle}`, 'info');

    if (shouldNavigate) {
      if (newRole === 'trainer') {
        navigate('/trainer/trainings');
      } else if (newRole === 'trainee') {
        navigate('/trainee/dashboard');
      } else if (newRole === 'admin') {
        navigate('/admin/dashboard');
      }
    }
  };

  const navigate = (path) => {
    if (router && typeof router.push === 'function') {
      router.push(path);
    } else if (typeof window !== 'undefined') {
      window.location.href = path;
    }
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        switchRole,
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
