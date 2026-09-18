"use client";
import React, { useState, useEffect, use } from 'react';
import { useApp } from '@/context/AppContext';
import { supabaseService } from '@/lib/services/supabaseService';
import confetti from 'canvas-confetti';
import {
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  FileCheck,
  AlertTriangle
} from 'lucide-react';

export default function QuizResultsPage({ params }) {
  const unwrappedParams = params ? (typeof params.then === 'function' ? use(params) : params) : {};
  const attemptId = unwrappedParams.id || '';
  const { navigate, showToast } = useApp();
  const [attempt, setAttempt] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await supabaseService.getAttemptById(attemptId);
        if (!active) return;
        if (!res) {
          setLoadError('That attempt could not be found.');
          return;
        }
        setAttempt(res.attempt);
        setAnswers(res.answers || []);
        setQuiz(res.quiz);

        const threshold = res.quiz?.passing_score ?? 70;
        if (Number(res.attempt.percentage) >= threshold) {
          try {
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
          } catch {
            // Confetti is decorative; a failure here must not break the page.
          }
        }
      } catch (e) {
        if (active) setLoadError(e?.message || 'Error loading quiz attempt');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [attemptId]);

  if (loading) {
    return <div className="p-12 text-center text-slate-400">Loading assessment results...</div>;
  }

  if (loadError || !attempt || !quiz) {
    return (
      <div className="p-12 text-center space-y-3">
        <p className="text-sm font-semibold text-rose-500">
          {loadError || 'Attempt record not found.'}
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

  const passingScore = quiz.passing_score ?? 70;
  const isPassed = Number(attempt.percentage) >= passingScore;
  const questionsMap = {};
  quiz.questions?.forEach((q) => {
    questionsMap[q.id] = q;
  });

  return (
    <div className="max-w-3xl mx-auto py-4 space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/trainee/dashboard')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Trainee Dashboard
        </button>
      </div>

      {/* Hero Score Card */}
      <div
        className={`p-8 rounded-3xl border shadow-xl text-center relative overflow-hidden space-y-4 ${
          isPassed
            ? 'bg-gradient-to-b from-emerald-500/10 via-emerald-500/5 to-white dark:to-slate-900 border-emerald-200 dark:border-emerald-800'
            : 'bg-gradient-to-b from-rose-500/10 via-rose-500/5 to-white dark:to-slate-900 border-rose-200 dark:border-rose-800'
        }`}
      >
        <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center text-white shadow-lg bg-indigo-600">
          <Award className="w-7 h-7" />
        </div>

        <div className="space-y-1">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
              isPassed
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
            }`}
          >
            {isPassed ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Passed Assessment</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4" />
                <span>Needs Improvement (Passing Grade: {passingScore}%)</span>
              </>
            )}
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white pt-2">
            {attempt.score} <span className="text-xl text-slate-400">/ {attempt.total_questions}</span>
          </h1>
          <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
            Overall Score: {attempt.percentage}%
          </p>
        </div>

        <div className="flex items-center justify-center gap-6 pt-2 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-1.5">
            <FileCheck className="w-4 h-4 text-slate-400" />
            <span>{quiz.title}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-slate-400" />
            <span>
              Completed {new Date(attempt.completed_at || attempt.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </div>

      {/* Question Breakdown */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Question Breakdown & Explanations
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Detailed review of all multiple-choice questions with verified explanations.
          </p>
        </div>

        <div className="space-y-4">
          {answers.map((ans, idx) => {
            const question = questionsMap[ans.question_id];
            if (!question) return null;

            return (
              <div
                key={ans.question_id || idx}
                className={`p-6 rounded-3xl bg-white dark:bg-slate-900 border shadow-sm space-y-4 ${
                  ans.is_correct
                    ? 'border-emerald-200 dark:border-emerald-800/60'
                    : 'border-rose-200 dark:border-rose-800/60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Question {idx + 1} of {attempt.total_questions}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          ans.is_correct
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                        }`}
                      >
                        {ans.is_correct ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" /> Correct (+1 pt)
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3" /> Incorrect (0 pts)
                          </>
                        )}
                      </span>
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                      {question.question_text}
                    </h3>
                  </div>
                </div>

                {/* 4 Options */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {question.options?.map((optText, optIdx) => {
                    const isUserChoice = ans.selected_option === optIdx;
                    const isCorrectAnswer = question.correct_answer === optIdx;

                    let badgeStyle = 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-slate-700 dark:text-slate-300';
                    if (isCorrectAnswer) {
                      badgeStyle = 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-100 font-semibold';
                    } else if (isUserChoice && !isCorrectAnswer) {
                      badgeStyle = 'border-rose-500 bg-rose-50/70 dark:bg-rose-950/60 text-rose-900 dark:text-rose-100 font-semibold';
                    }

                    return (
                      <div
                        key={optIdx}
                        className={`p-3 rounded-xl border flex items-center gap-2.5 transition-all ${badgeStyle}`}
                      >
                        <span className="w-5 h-5 rounded-lg bg-white dark:bg-slate-800 border flex items-center justify-center font-bold text-[10px] shrink-0">
                          {String.fromCharCode(65 + optIdx)}
                        </span>
                        <span className="flex-1 leading-snug">{optText}</span>
                        {isCorrectAnswer && (
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                            ✓ Correct
                          </span>
                        )}
                        {isUserChoice && !isCorrectAnswer && (
                          <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 shrink-0">
                            ✗ Your Answer
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Explanation */}
                {question.explanation && (
                  <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed">
                    <p className="font-bold mb-0.5 text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                      Explanation:
                    </p>
                    <p>{question.explanation}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
        <button
          onClick={() => navigate('/trainee/dashboard')}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 cursor-pointer"
        >
          Return to Trainee Dashboard
        </button>

        <button
          onClick={() => navigate(`/quiz/${quiz.id}`)}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Retake Assessment</span>
        </button>
      </div>
    </div>
  );
}
