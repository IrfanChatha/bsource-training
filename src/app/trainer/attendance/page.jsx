"use client";
import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { supabaseService } from '@/lib/services/supabaseService';
import { QRCodeSVG } from 'qrcode.react';
import {
  QrCode,
  RotateCw,
  Clock,
  Users,
  CheckCircle2,
  XCircle,
  BarChart3,
  Award,
  ArrowLeft,
  Copy,
  ExternalLink,
  UserCheck,
  FileSpreadsheet
} from 'lucide-react';

export default function TrainerAttendancePage({ params }) {
  const { showToast, navigate } = useApp();
  const trainingId = params?.id || 'training-sec-101';
  const [training, setTraining] = useState(null);
  const [session, setSession] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);

  // 60-second expiration countdown
  const [timeLeft, setTimeLeft] = useState(60);
  const [isRotating, setIsRotating] = useState(false);

  // Load session & live attendees
  const fetchLiveState = async () => {
    try {
      const sess = await supabaseService.getActiveAttendanceSession(trainingId);
      if (sess) {
        setSession(sess);
        const expiry = new Date(sess.expires_at).getTime();
        const remaining = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
        setTimeLeft(remaining > 0 ? remaining : 60);
      }
      const rows = await supabaseService.getLiveAttendeeRows(trainingId);
      setAttendees(rows || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      setLoading(true);
      const t = await supabaseService.getTrainingById(trainingId);
      if (isMounted) setTraining(t);
      await fetchLiveState();
      if (isMounted) setLoading(false);
    };
    init();

    const unsubscribe = supabaseService.onRealtimeUpdate(() => {
      fetchLiveState();
    });

    return () => {
      isMounted = false;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [trainingId]);

  // Expiration countdown timer
  useEffect(() => {
    const timer = setInterval(async () => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleRotateToken(true);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [trainingId]);

  const handleRotateToken = async (silent = false) => {
    setIsRotating(true);
    try {
      const newSess = await supabaseService.rotateQRToken(trainingId);
      setSession(newSess);
      setTimeLeft(60);
      if (!silent) {
        showToast('Generated fresh 60s attendance QR token', 'info');
      }
    } catch {
      if (!silent) showToast('Failed to rotate QR token', 'error');
    } finally {
      setIsRotating(false);
    }
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const qrPayload = session
    ? `${origin}/scan?trainingId=${trainingId}&token=${encodeURIComponent(session.current_qr_token)}`
    : '';

  const copyTokenToClipboard = () => {
    if (session?.current_qr_token) {
      navigator.clipboard.writeText(session.current_qr_token);
      showToast('QR Token copied to clipboard', 'success');
    }
  };

  const totalRegistered = attendees.length;
  const presentCount = attendees.filter((a) => a.attended).length;
  const attendancePercentage = totalRegistered > 0 ? Math.round((presentCount / totalRegistered) * 100) : 0;

  const quizCompletedCount = attendees.filter((a) => a.quiz_status === 'completed').length;
  const quizInProgressCount = attendees.filter((a) => a.quiz_status === 'in_progress').length;
  const quizScores = attendees
    .filter((a) => a.score !== undefined && a.quiz_status === 'completed')
    .map((a) => a.score);
  const avgScore =
    quizScores.length > 0
      ? (quizScores.reduce((sum, s) => sum + s, 0) / quizScores.length).toFixed(1)
      : '0.0';
  const highestScore = quizScores.length > 0 ? Math.max(...quizScores) : 0;

  const simulateTraineeCheckin = async () => {
    if (!session) return;
    const absentTrainees = attendees.filter((a) => !a.attended);
    if (absentTrainees.length === 0) {
      showToast('All registered trainees are already checked in!', 'info');
      return;
    }
    const target = absentTrainees[0];
    const res = await supabaseService.markAttendance(
      trainingId,
      session.current_qr_token,
      {
        id: target.trainee_id,
        email: target.email,
        full_name: target.name,
        role: 'trainee',
        department: target.department,
        created_at: new Date().toISOString(),
      }
    );
    if (res.success) {
      showToast(`Instant check-in simulated for ${target.name}!`, 'success');
      await fetchLiveState();
    } else {
      showToast(res.message, 'error');
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-400">Initializing live attendance session...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/trainer/trainings')}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Live Attendance Session Active
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {training?.title || 'Security Fundamentals 2026'}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {supabaseService.getSpreadsheetUrl && supabaseService.getSpreadsheetUrl() && (
            <a
              href={supabaseService.getSpreadsheetUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-xs font-semibold shadow-sm transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Open in Google Sheets</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
          )}
          <button
            onClick={simulateTraineeCheckin}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
          >
            <UserCheck className="w-3.5 h-3.5" />
            Simulate Trainee Scan
          </button>
          <button
            onClick={() => navigate('/trainer/quiz')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 cursor-pointer"
          >
            Review AI Quiz
          </button>
        </div>
      </div>

      {/* Main Attendance Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 cols): Dynamic 60s Expiring QR Projector */}
        <div className="lg:col-span-5 p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col items-center justify-between text-center relative overflow-hidden">
          <div className="w-full flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="text-left">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Projected Live QR Code
              </h2>
              <p className="text-[11px] text-slate-400">
                Scan with phone camera or BSource Training scanner
              </p>
            </div>

            {/* Circular Countdown Pill */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-indigo-600 dark:text-indigo-400">
              <Clock className="w-3.5 h-3.5" />
              <span>{timeLeft}s</span>
            </div>
          </div>

          {/* QR Code Presentation Stage */}
          <div className="my-6 p-5 rounded-3xl bg-white shadow-2xl border border-slate-200 flex flex-col items-center justify-center group relative">
            {session ? (
              <QRCodeSVG
                value={qrPayload || 'https://bsourcetraining.com'}
                size={230}
                level="H"
                includeMargin={true}
                className="rounded-xl"
              />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-slate-400">
                Loading QR...
              </div>
            )}

            <div
              className="absolute -inset-1 rounded-3xl border-2 border-indigo-500/40 pointer-events-none animate-pulse"
              style={{ opacity: timeLeft / 60 }}
            />
          </div>

          {/* Token information & Manual rotation */}
          <div className="w-full space-y-3">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs">
              <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300 truncate max-w-[200px]">
                {session?.current_qr_token || 'TOKEN-ACTIVE'}
              </span>
              <button
                onClick={copyTokenToClipboard}
                title="Copy secure token"
                className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleRotateToken(false)}
                disabled={isRotating}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isRotating ? 'animate-spin' : ''}`} />
                <span>Force Rotate Token Now</span>
              </button>
            </div>

            <p className="text-[10px] text-slate-400">
              * The QR token automatically regenerates every 60 seconds to prevent unauthorized attendance forwarding.
            </p>
          </div>
        </div>

        {/* Right Column (7 cols): Live Real-Time Dashboard Metrics */}
        <div className="lg:col-span-7 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* Present Attendees Card */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>Present</span>
                <Users className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                {presentCount} <span className="text-xs font-normal text-slate-400">/ {totalRegistered || 6}</span>
              </p>
              <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${attendancePercentage}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1 font-semibold">
                {attendancePercentage}% Attendance Rate
              </p>
            </div>

            {/* Quiz Completions */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>Quiz Completed</span>
                <BarChart3 className="w-4 h-4 text-indigo-500" />
              </div>
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                {quizCompletedCount}
                <span className="text-xs font-normal text-slate-400 ml-1.5">
                  ({quizInProgressCount} active)
                </span>
              </p>
              <p className="text-[10px] text-slate-400 mt-2 font-medium">
                {quizCompletedCount > 0
                  ? `${Math.round((quizCompletedCount / (totalRegistered || 1)) * 100)}% completed`
                  : 'Awaiting submissions'}
              </p>
            </div>

            {/* Average Score */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1 col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>Avg / Top Score</span>
                <Award className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                {avgScore} <span className="text-xs font-normal text-slate-400">/ 10</span>
              </p>
              <p className="text-[10px] text-slate-400 mt-2 font-semibold">
                Highest: <span className="text-amber-500">{highestScore}/10</span>
              </p>
            </div>
          </div>

          {/* Live Attendee Results Table */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Live Attendee & Quiz Progress Roster
                </h3>
                <p className="text-[11px] text-slate-400">
                  Updates in real time with dynamic sync.
                </p>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Live Sync
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                    <th className="pb-3 pl-1">Name</th>
                    <th className="pb-3">Attendance</th>
                    <th className="pb-3">Quiz Status</th>
                    <th className="pb-3">Score</th>
                    <th className="pb-3 pr-1">Completion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {attendees.map((attendee) => (
                    <tr key={attendee.trainee_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 pl-1 font-medium text-slate-800 dark:text-slate-200">
                        <div>
                          <p className="font-semibold">{attendee.name}</p>
                          <p className="text-[10px] text-slate-400">{attendee.email}</p>
                        </div>
                      </td>

                      <td className="py-3">
                        {attendee.attended ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] border border-emerald-200/50 dark:border-emerald-800/50">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            Present
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-[11px]">
                            <XCircle className="w-3 h-3 text-slate-400" />
                            Absent
                          </span>
                        )}
                      </td>

                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full font-semibold text-[11px] ${
                            attendee.quiz_status === 'completed'
                              ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/50'
                              : attendee.quiz_status === 'in_progress'
                              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                          }`}
                        >
                          {attendee.quiz_status === 'completed'
                            ? 'Completed'
                            : attendee.quiz_status === 'in_progress'
                            ? 'In Progress'
                            : 'Not Started'}
                        </span>
                      </td>

                      <td className="py-3 font-semibold text-slate-800 dark:text-slate-200">
                        {attendee.score !== undefined ? (
                          <span className={`${attendee.score >= 8 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}`}>
                            {attendee.score} / 10 ({attendee.percentage}%)
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-3 pr-1 text-slate-500 dark:text-slate-400">
                        {attendee.completion_time ? new Date(attendee.completion_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
