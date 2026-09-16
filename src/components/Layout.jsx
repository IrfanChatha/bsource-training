"use client";
import React, { useState } from 'react';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { useApp } from '../context/AppContext';
import {
  LayoutDashboard,
  QrCode,
  FileQuestion,
  Smartphone,
  BookOpen
} from 'lucide-react';

export function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { currentUser, currentPath: rawPath, pathname, navigate } = useApp();
  const currentPath = rawPath || pathname || '';

  const isTrainee = currentUser?.role === 'trainee';
  const isMobileAppPage = currentPath === '/trainee/mobile' || currentPath === '/traineemobileapp';
  
  // Public pages without dashboard sidebar
  const isPublicPage = currentPath === '/' || currentPath === '/login' || currentPath === '/signup' || currentPath === '/register';

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
