"use client";
import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { supabaseService } from '@/lib/services/supabaseService';
import TraineeMobileApp from '../mobile/page';
import {
  QrCode,
  CheckCircle2,
  FileQuestion,
  Calendar,
  Clock,
  ArrowRight,
  Award
} from 'lucide-react';

export default function TraineeDashboardPage() {
  const { currentUser, navigate, showToast } = useApp();
  const [trainings, setTrainings] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [availableQuizzes, setAvailableQuizzes] = useState({});
  const [loading, setLoading] = useState(true);
  const [isMobileScreen, setIsMobileScreen] = useState(false);

  // Auto-detect mobile screen size (< 768px)
  useEffect(() => {
    const checkScreen = () => {
      if (typeof window !== 'undefined') {
        setIsMobileScreen(window.innerWidth < 768);
      }
    };
    checkScreen();
    window.addEventListener('resize', checkScreen);
    return () => window.removeEventListener('resize', checkScreen);
  }, []);

  const loadTraineeData = async () => {
    setLoading(true);
    try {
      const allTrainings = await supabaseService.getTrainings();
      const published = (allTrainings || []).filter((t) => t.is_published && t.status !== 'archived');
      setTrainings(published);

      const quizMap = {};
      for (const t of published) {
        const q = await supabaseService.getQuiz(t.id);
        if (q && q.is_published) {
          quizMap[t.id] = q;
        }
      }
      setAvailableQuizzes(quizMap);

      const allAtts = [];
      for (const t of published) {
        const att = await supabaseService.getAttendance(t.id);
        const myAtt = (att || []).filter((a) => a.trainee_id === currentUser?.id);
        allAtts.push(...myAtt);
      }
      setAttendance(allAtts);

      const allAttempts = [];
      for (const t of published) {
        const atts = await supabaseService.getAttemptsForTraining(t.id);
        const myAttempts = (atts || []).filter((a) => a.trainee_id === currentUser?.id);
        allAttempts.push(...myAttempts);
      }
      setAttempts(allAttempts);
    } catch {
      showToast('Error loading trainee dashboard', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTraineeData();
    const unsub = supabaseService.onRealtimeUpdate(() => loadTraineeData());
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [currentUser?.id]);

  // If on mobile screen size, auto-render native mobile view
  if (isMobileScreen) {
    return <TraineeMobileApp embedded={true} />;
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-700 to-slate-900 text-white p-6 sm:p-8 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-bold uppercase tracking-wider">
              <QrCode className="w-3.5 h-3.5" />
              Trainee Attendance Check-In
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Ready to verify session attendance?
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
              Open the scanner to capture your trainer's live 60-second expiring QR token and unlock your training comprehension test.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              onClick={() => navigate('/scan')}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-white text-emerald-950 hover:bg-emerald-50 text-xs font-extrabold shadow-lg shadow-black/20 hover:scale-105 transition-all cursor-pointer"
            >
              <QrCode className="w-4 h-4 text-emerald-600" />
              <span>Scan QR Code</span>
              <ArrowRight className="w-3.5 h-3.5 text-emerald-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Published Trainings List */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Available Corporate Trainings
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sessions scheduled for your team. Check attendance and complete the 10-question evaluation.
          </p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading trainings...</div>
        ) : trainings.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
            No published trainings currently available.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {trainings.map((training) => {
              const attended = attendance.some((a) => a.training_id === training.id);
              const quiz = availableQuizzes[training.id];
              const pastAttempt = attempts.find((at) => at.training_id === training.id && at.status === 'completed');

              return (
                <div
                  key={training.id}
                  className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50">
                          {training.status}
                        </span>
                        {quiz && (
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 animate-pulse">
                            Quiz Ready
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {training.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Trainer: {training.trainer_name}
                      </p>
                    </div>

                    {attended ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        Attended
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[11px] font-semibold border border-amber-200 dark:border-amber-800">
                        Not Checked-In
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                    {training.description}
                  </p>

                  <div className="flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{training.date}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{training.time} ({training.duration_minutes}m)</span>
                    </div>
                  </div>

                  {/* Actions for this Training */}
                  <div className="pt-1 flex items-center gap-2">
                    {!attended ? (
                      <button
                        onClick={() => navigate(`/scan?trainingId=${training.id}`)}
                        className="flex-1 py-2 px-3 text-xs font-semibold rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        Mark Attendance
                      </button>
                    ) : null}

                    {quiz && (
                      <button
                        onClick={() => {
                          if (pastAttempt && !training.allow_quiz_retries) {
                            navigate(`/quiz/results/${pastAttempt.id}`);
                          } else {
                            navigate(`/quiz/${quiz.id}`);
                          }
                        }}
                        className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                          pastAttempt
                            ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20'
                        }`}
                      >
                        <FileQuestion className="w-3.5 h-3.5" />
                        {pastAttempt ? `Review Score (${pastAttempt.score}/10)` : 'Start 10-Q Quiz'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Past Attendance & Quiz Progress History */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          My Completed Assessments & Certifications
        </h3>

        {attempts.length === 0 ? (
          <p className="text-xs text-slate-400 py-3">
            No quiz attempts recorded yet. Mark attendance and take a quiz to earn scores!
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {attempts.map((attempt, idx) => (
              <div
                key={attempt.id ? `${attempt.id}-${idx}` : `attempt-${idx}`}
                onClick={() => navigate(`/quiz/results/${attempt.id}`)}
                className="py-3 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/40 px-2 rounded-xl cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      Assessment Attempt #{attempt.id?.slice(-4)}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Completed {new Date(attempt.completed_at || attempt.started_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                      {attempt.score} / {attempt.total_questions || 10} ({attempt.percentage}%)
                    </p>
                    <span className="text-[10px] text-emerald-500 font-semibold">Passed</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
