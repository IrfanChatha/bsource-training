"use client";
import React from 'react';
import { useApp } from '@/context/AppContext';
import {
  Sparkles,
  QrCode,
  FileText,
  CheckCircle2,
  BarChart3,
  ArrowRight,
  Shield,
  GraduationCap,
  Clock,
  Cpu,
  UserCheck,
  Smartphone,
  UserPlus,
  LogIn,
  Zap,
  Lock,
  Layers
} from 'lucide-react';

export default function LandingPage() {
  const { navigate, switchRole } = useApp();

  return (
    <div className="space-y-12 pb-20 pt-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

      {/* Top Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/80 text-indigo-700 dark:text-indigo-300 text-xs font-bold tracking-wide">
          <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
          Enterprise Training & Attendance Platform
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
          Choose Your Portal
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          Sign up or sign in as a Trainer or Trainee. Once authenticated, you are automatically routed to your dedicated workspace.
        </p>
      </div>

      {/* Role Gateways: Dedicated Cards for Trainer and Trainee */}
      <section className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {/* Trainer Gateway Card */}
          <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border-2 border-indigo-100 dark:border-indigo-900/60 shadow-lg hover:shadow-2xl transition-all space-y-6 flex flex-col justify-between group">
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold shadow-inner">
                  <GraduationCap className="w-7 h-7" />
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-indigo-100 dark:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300">
                  Trainer Hub
                </span>
              </div>

              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  Corporate Trainer / Instructor
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  Full control over training scheduling, slide deck processing, rotating QR token projection, and attendance verification.
                </p>
              </div>

              <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <span>Upload PDF, DOCX, PPTX & TXT slides for automated chunking</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <span>Generate exactly 10 AI quiz questions using Google Gemini</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <span>Project live auto-rotating 60s dynamic attendance QR codes</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <span>Live attendee logs & participant comprehension score analytics</span>
                </div>
              </div>
            </div>

            {/* Action Buttons for Trainer */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => navigate('/signup?role=trainer')}
                  className="py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 text-center transition-all cursor-pointer"
                >
                  Sign Up as Trainer
                </button>
                <button
                  onClick={() => navigate('/login?role=trainer')}
                  className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs text-center transition-all cursor-pointer"
                >
                  Trainer Sign In
                </button>
              </div>
            </div>
          </div>

          {/* Trainee Gateway Card */}
          <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border-2 border-emerald-100 dark:border-emerald-900/60 shadow-lg hover:shadow-2xl transition-all space-y-6 flex flex-col justify-between group">
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/70 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold shadow-inner">
                  <UserCheck className="w-7 h-7" />
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-900/80 text-emerald-700 dark:text-emerald-300">
                  Trainee Portal
                </span>
              </div>

              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  Trainee / Participant
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  Fast camera check-in to verify presence in seconds, take stepped 10-question evaluation quizzes, and track completion progress.
                </p>
              </div>

              <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Instant mobile camera scanner for live rotating 60s QR codes</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Prevents duplicate check-in & ensures token freshness</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Stepped question-by-question quiz with score breakdown</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Dedicated standalone Trainee Mobile App view</span>
                </div>
              </div>
            </div>

            {/* Action Buttons for Trainee */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => navigate('/signup?role=trainee')}
                  className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 text-center transition-all cursor-pointer"
                >
                  Sign Up as Trainee
                </button>
                <button
                  onClick={() => navigate('/login?role=trainee')}
                  className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs text-center transition-all cursor-pointer"
                >
                  Trainee Sign In
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3-Step Simple Workflow */}
      <section className="p-8 sm:p-12 rounded-3xl bg-slate-100/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 space-y-8">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            How TrainTrack AI Works
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            A frictionless 3-step loop from presentation to verification.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-md shadow-indigo-600/30">
              1
            </div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              Host & Project Live QR
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Trainer starts session. The system projects a dynamic QR code refreshed every 60 seconds with cryptographic timestamps.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-black text-sm flex items-center justify-center shadow-md shadow-emerald-600/30">
              2
            </div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              Trainee Scans QR Code
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Trainee opens the scanner on their mobile phone or browser, capturing the token instantly to mark verified attendance.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white font-black text-sm flex items-center justify-center shadow-md shadow-purple-600/30">
              3
            </div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              AI Assessment & Scores
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Trainee completes the 10-question AI quiz generated from uploaded documents, unlocking immediate scores and certificates.
            </p>
          </div>
        </div>
      </section>

      {/* Core Technical Capabilities Bento Grid */}
      <section className="space-y-4">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Enterprise Grade Architecture
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Built with Next.js 16 App Router, Tailwind CSS v4, and Supabase PostgreSQL.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600">
              <Clock className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">60s Dynamic Tokens</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Tokens expire strictly every 60s with automatic rotation to prevent proxy attendance or photo sharing.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600">
              <Cpu className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Gemini 1.5 & Flash AI</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Server-side prompt engineering synthesizes exactly 10 multi-choice questions with answer explanations.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600">
              <FileText className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Document Processing</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Extracts text from PDF, PowerPoint PPTX, Word DOCX, and TXT with chunking and token optimization.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600">
              <Shield className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Supabase PostgreSQL</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Realtime Postgres tables for trainings, attendance sessions, quiz attempts, and user profiles.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
