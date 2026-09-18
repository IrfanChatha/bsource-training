"use client";
import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { homeRouteFor } from '../lib/auth/access';
import { supabaseService } from '../lib/services/supabaseService';
import {
  Sparkles,
  Moon,
  Sun,
  GraduationCap,
  UserCheck,
  LogOut,
  ChevronDown
} from 'lucide-react';

export function Navbar({ onToggleSidebar, isPublicPage = false }) {
  const { currentUser, darkMode, setDarkMode, navigate, showToast, switchRole, switchingRole } = useApp();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setShowUserMenu(false);
    try {
      await supabaseService.logout();
      showToast('Successfully signed out.', 'info');
    } catch (e) {
      showToast(e?.message || 'Signed out locally, but the server call failed.', 'warning');
    } finally {
      navigate('/login');
    }
  };

  const userInitial = (currentUser?.full_name || currentUser?.name || 'U').charAt(0).toUpperCase();
  // Admin is not self-assignable, so an admin who switched could not switch
  // back. The workspace toggle is therefore only shown to trainers/trainees.
  const canSwitchWorkspace = currentUser?.role === 'trainer' || currentUser?.role === 'trainee';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 sm:px-6 h-16 flex items-center justify-between transition-colors shadow-xs">
      {/* Brand & Mobile Hamburger */}
      <div className="flex items-center gap-3">
        {!isPublicPage && (
          <button
            onClick={onToggleSidebar}
            className="md:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            aria-label="Toggle Navigation"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}

        <div
          onClick={() => navigate(isPublicPage ? '/' : homeRouteFor(currentUser?.role))}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-lg tracking-tight text-slate-900 dark:text-white">
                BSource<span className="text-indigo-600 dark:text-indigo-400"> Training</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Dynamic Workspace Mode Switcher (Visible on medium+ screens and in dropdown) */}
        {!isPublicPage && canSwitchWorkspace && (
          <div className="hidden sm:flex items-center">
            {currentUser.role === 'trainer' ? (
              <button
                disabled={switchingRole}
                onClick={() => switchRole('trainee')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 text-xs font-bold transition-all shadow-xs cursor-pointer"
                title="Switch perspective to Trainee Portal (Attend sessions, take quizzes)"
              >
                <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Switch to Trainee</span>
              </button>
            ) : (
              <button
                disabled={switchingRole}
                onClick={() => switchRole('trainer')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800 text-xs font-bold transition-all shadow-xs cursor-pointer"
                title="Switch perspective to Trainer Hub (Create courses, project QR, build AI quizzes)"
              >
                <GraduationCap className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Switch to Trainer</span>
              </button>
            )}
          </div>
        )}

        {/* Dark / Light Mode Toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer shadow-xs"
          aria-label="Toggle Theme"
          title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {darkMode ? (
            <Sun className="w-4 h-4 text-amber-400 animate-spin-slow" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-600" />
          )}
        </button>

        {isPublicPage ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/login')}
              className="px-3.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/signup')}
              className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md shadow-indigo-600/20 transition-all hover:scale-105 cursor-pointer"
            >
              Sign Up
            </button>
          </div>
        ) : (
          /* User Profile Dropdown Menu */
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2.5 p-1.5 sm:px-3 sm:py-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 shadow-xs transition-all cursor-pointer"
            >
              <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center font-bold text-xs uppercase shadow-xs">
                {userInitial}
              </div>
              <div className="hidden sm:flex flex-col text-left leading-tight">
                <span className="truncate max-w-[120px] text-xs font-bold text-slate-900 dark:text-white" suppressHydrationWarning>
                  {currentUser?.full_name || currentUser?.name || 'User'}
                </span>
                <span className="text-[10px] text-slate-400 font-medium capitalize" suppressHydrationWarning>
                  {currentUser?.role || 'User'}
                </span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-2.5">
                {/* Profile Overview Header */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-[10px] font-black uppercase rounded-md border ${
                      currentUser?.role === 'trainer'
                        ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-200/50'
                        : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200/50'
                    }`}>
                      {currentUser?.role === 'trainer' ? 'Trainer Mode' : currentUser?.role === 'trainee' ? 'Trainee Mode' : currentUser?.role || 'User'}
                    </span>
                    <span className="text-[11px] text-slate-400 truncate">
                      {currentUser?.department || 'Enterprise'}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate" suppressHydrationWarning>
                    {currentUser?.full_name || currentUser?.name || 'User'}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate" suppressHydrationWarning>
                    {currentUser?.email || ''}
                  </p>
                </div>

                {/* Mode Switcher Inside Dropdown */}
                {canSwitchWorkspace && (
                <div className="space-y-1.5 p-2 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block px-1">
                    Switch Workspace Mode
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      disabled={switchingRole}
                      onClick={() => {
                        switchRole('trainer');
                        setShowUserMenu(false);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        currentUser?.role === 'trainer'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <GraduationCap className="w-3.5 h-3.5" />
                      <span>Trainer</span>
                    </button>
                    <button
                      type="button"
                      disabled={switchingRole}
                      onClick={() => {
                        switchRole('trainee');
                        setShowUserMenu(false);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        currentUser?.role === 'trainee'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Trainee</span>
                    </button>
                  </div>
                </div>
                )}

                {/* Account Actions */}
                <div className="pt-1">
                  <button
                    onClick={handleLogout}
                    className="w-full py-2 px-3 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <LogOut className="w-3.5 h-3.5" />
                      Sign Out
                    </span>
                    <span className="text-[10px] opacity-70">End session</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

export default Navbar;
