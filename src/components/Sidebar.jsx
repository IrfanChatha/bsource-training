"use client";
import React from 'react';
import { useApp } from '../context/AppContext';
import { supabaseService } from '../lib/services/supabaseService';
import {
  GraduationCap,
  QrCode,
  FileQuestion,
  Shield,
  BookOpen,
  Smartphone,
  LogOut
} from 'lucide-react';

export function Sidebar({ isOpen, onClose }) {
  const { pathname, navigate, currentUser, showToast } = useApp();
  const current = pathname || '/';

  const isCurrent = (path) => {
    if (path === '/' && current === '/') return true;
    if (path !== '/' && current.startsWith(path)) return true;
    return false;
  };

  const navItem = (label, path, icon, badge) => {
    const active = isCurrent(path);
    return (
      <button
        key={path}
        onClick={() => {
          navigate(path);
          if (onClose) onClose();
        }}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all group cursor-pointer ${
          active
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-semibold'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-100'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className={`${active ? 'text-white' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'}`}>
            {icon}
          </span>
          <span className="truncate">{label}</span>
        </div>
        {badge && (
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              active
                ? 'bg-white/20 text-white'
                : 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300'
            }`}
          >
            {badge}
          </span>
        )}
      </button>
    );
  };

  const handleLogout = async () => {
    try {
      await supabaseService.logout();
      showToast('Successfully signed out.', 'info');
      navigate('/login');
    } catch (e) {
      navigate('/login');
    }
  };

  const userInitial = (currentUser?.name || currentUser?.full_name || 'U').charAt(0).toUpperCase();

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm md:hidden animate-in fade-in duration-200"
        />
      )}

      <aside
        className={`fixed md:sticky top-16 z-40 h-[calc(100vh-4rem)] w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-transform duration-300 ease-in-out md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } flex flex-col justify-between p-4 overflow-y-auto`}
      >
        <div className="space-y-6">
          {/* Active User Mini Card */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-xs uppercase shadow-xs">
                {userInitial}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate" suppressHydrationWarning>
                  {currentUser?.name || currentUser?.full_name || 'User'}
                </p>
                <p className="text-[11px] text-slate-400 capitalize flex items-center gap-1.5" suppressHydrationWarning>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  {currentUser?.role || 'user'} • {currentUser?.department || 'Enterprise'}
                </p>
              </div>
            </div>
          </div>

          {/* Role specific navigation */}
          {currentUser?.role === 'trainer' && (
            <div className="space-y-1">
              <div className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Trainer Hub
              </div>
              {navItem('Training Sessions', '/trainer/trainings', <GraduationCap className="w-4 h-4" />)}
              {navItem(
                'Live QR Attendance',
                '/trainer/attendance',
                <QrCode className="w-4 h-4" />,
                'Live 60s'
              )}
              {navItem(
                'AI Quiz Builder',
                '/trainer/quiz',
                <FileQuestion className="w-4 h-4" />,
                '10 Qs'
              )}
            </div>
          )}

          {/* Trainee Navigation */}
          {currentUser?.role === 'trainee' && (
            <div className="space-y-1">
              <div className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Trainee Portal
              </div>
              {navItem('My Dashboard', '/trainee/dashboard', <BookOpen className="w-4 h-4" />)}
              {navItem('Scan QR Attendance', '/scan', <QrCode className="w-4 h-4" />, 'Camera')}
              {navItem('Mobile App Portal', '/trainee/mobile', <Smartphone className="w-4 h-4" />, 'Mobile')}
            </div>
          )}

          {/* Admin Navigation */}
          {currentUser?.role === 'admin' && (
            <div className="space-y-1">
              <div className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Administration
              </div>
              {navItem('Admin Dashboard', '/admin/dashboard', <Shield className="w-4 h-4 text-purple-500" />)}
            </div>
          )}
        </div>

        {/* Bottom Sign Out Action */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={handleLogout}
            className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
export default Sidebar;
