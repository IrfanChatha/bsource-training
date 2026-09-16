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
      <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} isPublicPage={isPublicPage} />
      <div className="flex-1 flex w-full">
        {!isPublicPage && (
          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        )}
        <main
          className={`flex-1 min-w-0 ${
            isPublicPage
              ? 'p-0'
              : 'p-3 sm:p-6 lg:p-8 overflow-y-auto ' + (isTrainee && !isMobileAppPage ? 'pb-20 md:pb-8' : '')
          }`}
        >
          <div className={`${isPublicPage ? 'w-full' : 'max-w-7xl mx-auto space-y-6'}`}>
            {children}
          </div>
        </main>
      </div>

      {/* Trainee Mobile Quick Bar */}
      {isTrainee && !isMobileAppPage && !isPublicPage && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-3 py-2 flex items-center justify-around shadow-lg">
          <button
            onClick={() => navigate('/trainee/dashboard')}
            className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${
              currentPath.includes('dashboard')
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-slate-400'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => navigate('/trainee/mobile')}
            className="flex flex-col items-center gap-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400"
          >
            <Smartphone className="w-4 h-4" />
            <span>Mobile App</span>
          </button>

          <button
            onClick={() => navigate('/scan')}
            className="flex flex-col items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center -mt-3 shadow-md shadow-emerald-600/30">
              <QrCode className="w-4 h-4" />
            </div>
            <span className="-mt-0.5">Scan QR</span>
          </button>

          <button
            onClick={() => navigate('/quiz/quiz-sec-101')}
            className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${
              currentPath.includes('quiz')
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-slate-400'
            }`}
          >
            <FileQuestion className="w-4 h-4" />
            <span>Quiz</span>
          </button>
        </div>
      )}
    </div>
  );
}
export default Layout;
