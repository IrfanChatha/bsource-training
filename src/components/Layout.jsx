"use client";
import React, { useState } from 'react';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { useApp } from '../context/AppContext';
import { canAccess, isPublicRoute } from '../lib/auth/access';

export function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { currentUser, currentPath: rawPath, pathname, authReady } = useApp();
  const currentPath = rawPath || pathname || '';

  const isTrainee = currentUser?.role === 'trainee';
  const isMobileAppPage = currentPath === '/trainee/mobile' || currentPath === '/traineemobileapp';
  const isPublicPage = isPublicRoute(currentPath);

  // The marketing homepage ships its own header, footer and design system,
  // so it renders outside the product chrome entirely.
  if (currentPath === '/') {
    return children;
  }

  // Until the session has been read there is no way to know whose workspace
  // this is, so the chrome waits rather than guessing.
  //
  // Once it has been read, a route this role cannot open must not render even
  // for a frame: AppContext is already redirecting, and the proxy only enforces
  // roles when the access-token hook is configured, so this is the check that
  // always runs.
  const blocked =
    !isPublicPage && authReady && !canAccess(currentPath, currentUser?.role);

  if (!isPublicPage && (!authReady || blocked)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <span className="w-8 h-8 rounded-full border-2 border-slate-300 dark:border-slate-700 border-t-indigo-600 animate-spin" />
          <p className="text-xs font-semibold">
            {blocked ? 'Taking you to your workspace...' : 'Restoring your session...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors flex flex-col font-sans">
      {/* Show outer Navbar on desktop, or for non-trainee / public pages */}
      <div className={isTrainee && !isPublicPage ? 'hidden md:block' : 'block'}>
        <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} isPublicPage={isPublicPage} />
      </div>

      <div className="flex-1 flex w-full">
        {!isPublicPage && (
          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        )}
        <main
          className={`flex-1 min-w-0 ${
            isPublicPage
              ? 'p-0'
              : (isTrainee ? 'p-0 md:p-6 lg:p-8' : 'p-3 sm:p-6 lg:p-8') + ' overflow-y-auto'
          }`}
        >
          <div className={`${isPublicPage || (isTrainee && !isMobileAppPage) ? 'w-full' : 'max-w-7xl mx-auto space-y-6'}`}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
export default Layout;
