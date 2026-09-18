"use client";
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { supabaseService, DEFAULT_SETTINGS, canManageTraining } from '../lib/services/supabaseService';
import { QRCodeSVG } from 'qrcode.react';
import {
  RotateCw,
  Clock,
  Users,
  CheckCircle2,
  XCircle,
  BarChart3,
  Award,
  ArrowLeft,
  Copy,
} from 'lucide-react';

/**
 * Live QR attendance for one training.
 *
 * The token is minted in the database with a real expiry, and the trainee's
 * scan is checked against it by `/api/attendance/mark`. If a session cannot be
 * created the screen says so rather than displaying a QR code that resolves to
 * nothing.
 */
export function AttendanceConsole({ trainingId }) {
  const { showToast, navigate, currentUser } = useApp();
  const [training, setTraining] = useState(null);
  const [session, setSession] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [rotationSeconds, setRotationSeconds] = useState(DEFAULT_SETTINGS.qr_rotation_seconds);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_SETTINGS.qr_rotation_seconds);
  const [isRotating, setIsRotating] = useState(false);

  // Guards the interval against overlapping rotations.
  const rotatingRef = useRef(false);

  // Running a session writes to attendance_sessions, which only the training's
  // own trainer or an admin may do. Without this the screen offered a button
  // whose only possible outcome was a policy rejection.
  const canManage = canManageTraining(training, currentUser);

  const fetchLiveState = useCallback(async () => {
    if (!trainingId) return;
    try {
      const [sess, rows] = await Promise.all([
        supabaseService.getActiveAttendanceSession(trainingId),
        supabaseService.getLiveAttendeeRows(trainingId),
      ]);
      setSession(sess);
      setAttendees(rows || []);
      if (sess) {
        const remaining = Math.floor((new Date(sess.expires_at).getTime() - Date.now()) / 1000);
        setTimeLeft(Math.max(0, remaining));
      }
    } catch (e) {
      setLoadError(e?.message || 'Could not load the live attendance state.');
    }
  }, [trainingId]);

  const rotateToken = useCallback(
    async (silent = false) => {
      if (!trainingId || rotatingRef.current) return;
      rotatingRef.current = true;
      setIsRotating(true);
      try {
        const newSess = await supabaseService.rotateQRToken(trainingId, rotationSeconds);
        setSession(newSess);
        setTimeLeft(rotationSeconds);
        setLoadError(null);
        if (!silent) showToast(`Generated a fresh ${rotationSeconds}s attendance token`, 'info');
      } catch (e) {
        setLoadError(e?.message || 'Could not issue a QR token.');
        if (!silent) showToast(e?.message || 'Failed to rotate the QR token', 'error');
      } finally {
        rotatingRef.current = false;
        setIsRotating(false);
      }
    },
    [trainingId, rotationSeconds, showToast]
  );

  useEffect(() => {
    let active = true;

    const init = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [t, settings] = await Promise.all([
          supabaseService.getTrainingById(trainingId),
          supabaseService.getSettings().catch(() => DEFAULT_SETTINGS),
        ]);
        if (!active) return;

        if (!t) {
          setLoadError('That training session no longer exists.');
          setLoading(false);
          return;
        }
        setTraining(t);
        const ttl = Number(settings?.qr_rotation_seconds) || DEFAULT_SETTINGS.qr_rotation_seconds;
        setRotationSeconds(ttl);
        setTimeLeft(ttl);

        await fetchLiveState();
      } catch (e) {
        if (active) setLoadError(e?.message || 'Could not open the attendance console.');
      } finally {
        if (active) setLoading(false);
      }
    };

    init();
    const unsubscribe = supabaseService.onRealtimeUpdate(() => fetchLiveState());

    return () => {
      active = false;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [trainingId, fetchLiveState]);

  // Mint the first token once the training has loaded and none is live.
  useEffect(() => {
    if (loading || loadError || !training || session || !canManage) return undefined;
    const id = setTimeout(() => rotateToken(true), 0);
    return () => clearTimeout(id);
  }, [loading, loadError, training, session, rotateToken, canManage]);

  // Countdown; rotation is triggered from the effect, never from inside a
  // state updater, so it cannot fire twice per tick.
  useEffect(() => {
    if (!session) return undefined;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev <= 0 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [session]);

  useEffect(() => {
    if (!session || timeLeft !== 0 || rotatingRef.current || !canManage) return undefined;
    const id = setTimeout(() => rotateToken(true), 0);
    return () => clearTimeout(id);
  }, [timeLeft, session, rotateToken, canManage]);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const qrPayload = session
    ? `${origin}/scan?trainingId=${encodeURIComponent(trainingId)}&token=${encodeURIComponent(session.current_qr_token)}`
    : '';

  const copyTokenToClipboard = async () => {
    if (!session?.current_qr_token) return;
    try {
      await navigator.clipboard.writeText(session.current_qr_token);
      showToast('QR token copied to clipboard', 'success');
    } catch {
      showToast('Clipboard access was blocked by the browser', 'warning');
    }
  };

  const totalRegistered = attendees.length;
  const presentCount = attendees.filter((a) => a.attended).length;
  const attendancePercentage = totalRegistered > 0 ? Math.round((presentCount / totalRegistered) * 100) : 0;

  const completed = attendees.filter((a) => a.quiz_status === 'completed');
  const quizInProgressCount = attendees.filter((a) => a.quiz_status === 'in_progress').length;
  const percentages = completed.map((a) => Number(a.percentage) || 0);
  const avgPercentage = percentages.length
    ? Math.round(percentages.reduce((sum, s) => sum + s, 0) / percentages.length)
    : null;
  const topPercentage = percentages.length ? Math.max(...percentages) : null;

  if (loading) {
    return <div className="p-12 text-center text-slate-400">Opening live attendance session...</div>;
  }

  if (loadError && !training) {
    return (
      <div className="p-12 text-center space-y-3">
        <p className="text-sm font-semibold text-rose-500">{loadError}</p>
        <button
          onClick={() => navigate('/trainer/trainings')}
          className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white cursor-pointer"
        >
          Back to Trainings
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/trainer/trainings')}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
            aria-label="Back to trainings"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${session ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                {session ? 'Live Attendance Session Active' : 'No Active Session'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {training?.title}
            </h1>
            {training?.trainer_name && (
              <p className="text-[11px] text-slate-400">Trainer: {training.trainer_name}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => navigate(`/trainer/quiz/${trainingId}`)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 cursor-pointer"
          >
            Review AI Quiz
          </button>
        </div>
      </div>

      {!canManage && training && (
        <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
          <span className="font-bold">View only.</span>{' '}
          {training.trainer_name || 'Another trainer'} runs this session, so only
          they or an administrator can project its check-in code. You can still
          watch the roster below.
        </div>
      )}

      {loadError && canManage && (
        <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-700 dark:text-rose-300">
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Projected QR */}
        <div className="lg:col-span-5 p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col items-center justify-between text-center relative overflow-hidden">
          <div className="w-full flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="text-left">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Projected Live QR Code</h2>
              <p className="text-[11px] text-slate-400">Scan with a phone camera or the BSource scanner</p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-indigo-600 dark:text-indigo-400">
              <Clock className="w-3.5 h-3.5" />
              <span>{timeLeft}s</span>
            </div>
          </div>

          <div className="my-6 p-5 rounded-3xl bg-white shadow-2xl border border-slate-200 flex flex-col items-center justify-center relative">
            {session ? (
              <QRCodeSVG value={qrPayload} size={230} level="H" marginSize={2} className="rounded-xl" />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-slate-400 text-xs px-6 text-center">
                {canManage
                  ? 'No attendance token is live. Use “Issue New Token” below.'
                  : 'No check-in code is being projected for this session yet.'}
              </div>
            )}
            <div
              className="absolute -inset-1 rounded-3xl border-2 border-indigo-500/40 pointer-events-none"
              style={{ opacity: rotationSeconds ? timeLeft / rotationSeconds : 0 }}
            />
          </div>

          <div className="w-full space-y-3">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs">
              <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300 truncate max-w-[200px]">
                {session?.current_qr_token || 'No live token'}
              </span>
              <button
                onClick={copyTokenToClipboard}
                disabled={!session}
                title="Copy the live token"
                className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-40 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>

            {canManage && (
              <button
                onClick={() => rotateToken(false)}
                disabled={isRotating}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isRotating ? 'animate-spin' : ''}`} />
                <span>{session ? 'Force Rotate Token Now' : 'Issue New Token'}</span>
              </button>
            )}

            <p className="text-[10px] text-slate-400">
              {canManage
                ? `The token regenerates every ${rotationSeconds} seconds. Expired and mismatched tokens are rejected when a trainee scans.`
                : 'Only the trainer running this session can project or rotate its code.'}
            </p>
          </div>
        </div>

        {/* Live metrics */}
        <div className="lg:col-span-7 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>Present</span>
                <Users className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                {presentCount} <span className="text-xs font-normal text-slate-400">/ {totalRegistered}</span>
              </p>
              <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${attendancePercentage}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1 font-semibold">{attendancePercentage}% attendance rate</p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>Quiz Completed</span>
                <BarChart3 className="w-4 h-4 text-indigo-500" />
              </div>
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                {completed.length}
                <span className="text-xs font-normal text-slate-400 ml-1.5">({quizInProgressCount} active)</span>
              </p>
              <p className="text-[10px] text-slate-400 mt-2 font-medium">
                {completed.length > 0
                  ? `${Math.round((completed.length / (totalRegistered || 1)) * 100)}% completed`
                  : 'Awaiting submissions'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1 col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>Avg / Top Score</span>
                <Award className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                {avgPercentage === null ? '—' : `${avgPercentage}%`}
              </p>
              <p className="text-[10px] text-slate-400 mt-2 font-semibold">
                Highest: <span className="text-amber-500">{topPercentage === null ? '—' : `${topPercentage}%`}</span>
              </p>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Live Attendee &amp; Quiz Progress Roster
                </h3>
                <p className="text-[11px] text-slate-400">Updates in real time.</p>
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
                  {attendees.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">
                        No participants yet.
                      </td>
                    </tr>
                  )}
                  {attendees.map((attendee) => (
                    <tr key={attendee.trainee_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 pl-1 font-medium text-slate-800 dark:text-slate-200">
                        <p className="font-semibold">{attendee.name}</p>
                        <p className="text-[10px] text-slate-400">{attendee.email}</p>
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
                        {attendee.score !== undefined && attendee.score !== null ? (
                          <span className={Number(attendee.percentage) >= 80 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}>
                            {attendee.score} / {attendee.total_questions} ({Math.round(Number(attendee.percentage) || 0)}%)
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-1 text-slate-500 dark:text-slate-400">
                        {attendee.completion_time
                          ? new Date(attendee.completion_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '—'}
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

export default AttendanceConsole;
