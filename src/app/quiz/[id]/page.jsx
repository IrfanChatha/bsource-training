"use client";
import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { supabaseService } from '@/lib/services/supabaseService';
import {
  Clock,
  ArrowRight,
  ArrowLeft,
  Send
} from 'lucide-react';

export default function TraineeQuizPage({ params }) {
  const unwrappedParams = params ? (typeof params.then === 'function' ? React.use(params) : params) : {};
  const quizId = unwrappedParams.id || '';
  const { showToast, navigate } = useApp();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [currentIdx, setCurrentIdx] = useState(0);

  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [startedAt] = useState(() => new Date().toISOString());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const q = await supabaseService.getQuizById(quizId);
        if (!active) return;
        if (!q) {
          setLoadError('That assessment could not be found.');
          return;
        }
        setQuiz(q);
        setTimeRemaining((q.time_limit_minutes || 10) * 60);
      } catch (e) {
        if (active) setLoadError(e?.message || 'Error loading quiz');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [quizId]);

  const handleSelectOption = (optIdx) => {
    if (!quiz?.questions) return;
    const currentQ = quiz.questions[currentIdx];
    setSelectedAnswers((prev) => ({ ...prev, [currentQ.id]: optIdx }));
  };

  const handleSubmitQuiz = useCallback(
    async (autoSubmit = false) => {
      if (!quiz?.questions || isSubmitting) return;
      setIsSubmitting(true);

      try {
        // Only the chosen option is sent; the score is computed server-side
        // against the answer key in the database.
        const answersArray = quiz.questions.map((q) => ({
          question_id: q.id,
          selected_option: selectedAnswers[q.id] ?? -1,
        }));

        const { attempt } = await supabaseService.submitQuizAttempt({
          quiz_id: quiz.id,
          answers: answersArray,
          started_at: startedAt,
        });

        showToast(
          autoSubmit
            ? `Time expired. Submitted — you scored ${attempt.score}/${attempt.total_questions}.`
            : `Assessment submitted. You scored ${attempt.score}/${attempt.total_questions}.`,
          'success'
        );

        navigate(`/quiz/results/${attempt.id}`);
      } catch (err) {
        showToast(err?.message || 'Failed to submit the assessment', 'error');
        setIsSubmitting(false);
      }
    },
    [quiz, selectedAnswers, isSubmitting, startedAt, showToast, navigate]
  );

  // Tick the clock. Auto-submission is triggered by the effect below rather
  // than from inside the state updater, so it can only fire once.
  useEffect(() => {
    if (!quiz || timeRemaining === null || timeRemaining <= 0) return undefined;
    const interval = setInterval(() => {
      setTimeRemaining((prev) => (prev === null || prev <= 0 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [quiz, timeRemaining]);

  useEffect(() => {
    if (!quiz || timeRemaining !== 0 || isSubmitting) return undefined;
    const id = setTimeout(() => handleSubmitQuiz(true), 0);
    return () => clearTimeout(id);
  }, [timeRemaining, quiz, isSubmitting, handleSubmitQuiz]);

  if (loading) {
    return <div className="p-12 text-center text-slate-400">Loading quiz questions...</div>;
  }

  if (loadError || !quiz || !quiz.questions || quiz.questions.length === 0) {
    return (
      <div className="p-12 text-center space-y-3">
        <p className="text-sm font-semibold text-rose-500">
          {loadError || 'This quiz does not have any active questions, or has not been published yet.'}
        </p>
        <button
          onClick={() => navigate('/trainee/dashboard')}
          className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white cursor-pointer"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const currentQ = quiz.questions[currentIdx];
  const answeredCount = Object.keys(selectedAnswers).length;
  const safeRemaining = timeRemaining ?? 0;
  const minutes = Math.floor(safeRemaining / 60);
  const seconds = safeRemaining % 60;

  return (
    <div className="max-w-3xl mx-auto py-4 space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200/50">
              {quiz.difficulty || 'Medium'} Level
            </span>
            <span className="text-xs text-slate-400">
              {answeredCount} of {quiz.questions.length} answered
            </span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">
            {quiz.title}
          </h1>
        </div>

        {/* Countdown Timer */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono text-sm font-bold shrink-0 self-start sm:self-auto">
          <Clock className={`w-4 h-4 ${safeRemaining < 120 ? 'text-rose-500 animate-pulse' : 'text-indigo-500'}`} />
          <span>
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* Question Number Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {quiz.questions.map((q, idx) => {
          const isAnswered = selectedAnswers[q.id] !== undefined;
          const isCurrent = idx === currentIdx;
          return (
            <button
              key={q.id || idx}
              onClick={() => setCurrentIdx(idx)}
              className={`w-8 h-8 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                isCurrent
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-105'
                  : isAnswered
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-400'
              }`}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>

      {/* Main Question Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
            Question {currentIdx + 1} of {quiz.questions.length}
          </span>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-snug">
            {currentQ.question_text}
          </h2>
        </div>

        {/* 4 Options */}
        <div className="space-y-3">
          {currentQ.options.map((optionText, optIdx) => {
            const isSelected = selectedAnswers[currentQ.id] === optIdx;
            const letter = String.fromCharCode(65 + optIdx);
            return (
              <button
                key={optIdx}
                type="button"
                onClick={() => handleSelectOption(optIdx)}
                className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center gap-3.5 group cursor-pointer ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30'
                }`}
              >
                <span
                  className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                    isSelected
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 group-hover:border-indigo-400'
                  }`}
                >
                  {letter}
                </span>
                <span
                  className={`text-xs sm:text-sm leading-relaxed ${
                    isSelected
                      ? 'font-bold text-indigo-950 dark:text-indigo-100'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {optionText}
                </span>
              </button>
            );
          })}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            disabled={currentIdx === 0}
            onClick={() => setCurrentIdx((p) => Math.max(0, p - 1))}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          {currentIdx < quiz.questions.length - 1 ? (
            <button
              type="button"
              onClick={() => setCurrentIdx((p) => p + 1)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-transform active:scale-95 cursor-pointer"
            >
              <span>Next Question</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              className="inline-flex items-center gap-1.5 px-6 py-2.5 text-xs font-extrabold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition-transform active:scale-95 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit Assessment</span>
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Ready to Submit Assessment?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              You have answered <span className="font-bold text-indigo-600 dark:text-indigo-400">{answeredCount}</span> of{' '}
              <span className="font-bold">{quiz.questions.length}</span> questions.
              {answeredCount < quiz.questions.length && (
                <span className="block mt-1 text-amber-600 dark:text-amber-400 font-semibold">
                  ⚠️ Note: Unanswered questions will receive 0 points.
                </span>
              )}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Back to Review
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  setShowConfirmModal(false);
                  handleSubmitQuiz();
                }}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                {isSubmitting ? 'Scoring...' : 'Confirm & View Results'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
