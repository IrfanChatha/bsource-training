"use client";
import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { supabaseService, DEFAULT_SETTINGS } from '../lib/services/supabaseService';
import { STORAGE_KEYS, readStored } from '../lib/storage';
import { prepareTextForAI } from '../lib/services/fileExtractor';
import { Sparkles, Bot, Trash2, ArrowLeft, Send, Save, AlertTriangle } from 'lucide-react';

/**
 * AI Quiz Studio for one training.
 *
 * Questions are held in the canonical `{ question_text, correct_answer }` shape
 * that `supabaseService` reads and writes, so a saved quiz round-trips with its
 * text and answer key intact.
 */
export function QuizStudio({ trainingId }) {
  const { showToast, navigate } = useApp();
  const [training, setTraining] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [difficulty, setDifficulty] = useState('Medium');
  const [materialText, setMaterialText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationWarning, setGenerationWarning] = useState(null);
  const [generationSource, setGenerationSource] = useState('');

  const [questions, setQuestions] = useState([]);
  const [quizTitle, setQuizTitle] = useState('Training Comprehension Assessment');
  const [isPublished, setIsPublished] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    let active = true;

    const init = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [t, loaded] = await Promise.all([
          supabaseService.getTrainingById(trainingId),
          supabaseService.getSettings().catch(() => DEFAULT_SETTINGS),
        ]);
        if (!active) return;
        if (!t) {
          setLoadError('That training session no longer exists.');
          return;
        }
        setTraining(t);
        setSettings(loaded || DEFAULT_SETTINGS);

        const existingQuiz = await supabaseService.getQuiz(trainingId);
        if (!active) return;

        if (existingQuiz) {
          setQuiz(existingQuiz);
          setQuizTitle(existingQuiz.title || 'Training Comprehension Assessment');
          setDifficulty(existingQuiz.difficulty || 'Medium');
          setIsPublished(!!existingQuiz.is_published);
          setQuestions(existingQuiz.questions || []);
        }

        // Seed the generator with whatever material has been ingested.
        const materials = await supabaseService.getMaterials(trainingId);
        if (!active) return;
        const chunks = (materials || []).map((m) => m.extracted_text).filter(Boolean);
        if (chunks.length) {
          setMaterialText(prepareTextForAI(chunks));
        } else {
          const cached = readStored(STORAGE_KEYS.activeMaterialText);
          if (cached) setMaterialText(cached);
        }
      } catch (err) {
        if (active) setLoadError(err?.message || 'Error loading the quiz studio.');
      } finally {
        if (active) setLoading(false);
      }
    };

    init();
    return () => {
      active = false;
    };
  }, [trainingId]);

  const handleGenerateAIQuiz = async () => {
    if (!materialText.trim()) {
      showToast('Add training material or slide notes before generating questions.', 'error');
      return;
    }

    setIsGenerating(true);
    setGenerationWarning(null);
    try {
      const response = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialText: materialText.trim(),
          numQuestions: settings.default_question_count || 10,
          difficulty,
          provider: 'gemini',
          model: settings.ai_model,
        }),
      });

      const res = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(res.error || 'Failed to generate quiz');
      if (!res.data || !Array.isArray(res.data.questions)) {
        throw new Error('The AI returned an unusable response.');
      }

      setQuestions(
        res.data.questions.map((q, idx) => ({
          id: `q-${Date.now()}-${idx}`,
          question_order: idx + 1,
          question_text: q.question,
          options: q.options,
          correct_answer: q.correctAnswer ?? 0,
          explanation: q.explanation || '',
        }))
      );
      setQuizTitle(res.data.title || `${training?.title || 'Training'} Assessment`);
      setGenerationSource(res.provider || 'gemini');
      setGenerationWarning(res.warning || null);

      if (res.warning) {
        showToast('Questions generated from a template — review them before publishing.', 'warning');
      } else {
        showToast(`Generated ${res.data.questions.length} assessment questions.`, 'success');
      }
    } catch (err) {
      showToast(err?.message || 'Error generating questions', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveQuiz = async (publishNow = false) => {
    if (questions.length === 0) {
      showToast('Generate or add questions before saving.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const saved = await supabaseService.saveQuiz({
        id: quiz?.id,
        training_id: trainingId,
        title: quizTitle,
        difficulty,
        passing_score: settings.passing_score,
        is_published: publishNow ? true : isPublished,
        questions,
      });
      setQuiz(saved);
      setQuestions(saved.questions);
      setIsPublished(!!saved.is_published);
      showToast(
        publishNow
          ? 'Quiz published. Trainees can now take the assessment.'
          : 'Quiz draft saved.',
        'success'
      );
    } catch (err) {
      showToast(err?.message || 'Failed to save the quiz', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const patchQuestion = (idx, patch) =>
    setQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)));

  const updateOptionText = (qIdx, optIdx, newOption) =>
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx ? { ...q, options: q.options.map((o, j) => (j === optIdx ? newOption : o)) } : q
      )
    );

  const handleDeleteQuestion = (qIdx) => {
    setQuestions((prev) =>
      prev.filter((_, idx) => idx !== qIdx).map((q, i) => ({ ...q, question_order: i + 1 }))
    );
    showToast('Question removed', 'info');
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-400">Loading AI Quiz Studio...</div>;
  }

  if (loadError) {
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

  // How many to generate next, versus how many this quiz actually has. The
  // header used to show the target even when a shorter quiz was loaded.
  const targetCount = settings.default_question_count || 10;
  const actualCount = questions.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50">
                {actualCount > 0
                  ? `${actualCount} Multiple-Choice Question${actualCount === 1 ? '' : 's'}`
                  : `Target: ${targetCount} Questions`}
              </span>
              {isPublished && (
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50">
                  Published Live
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              AI Quiz Studio
            </h1>
            <p className="text-[11px] text-slate-400">{training?.title}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSaveQuiz(false)}
            disabled={isSaving || questions.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Draft</span>
          </button>
          <button
            onClick={() => handleSaveQuiz(true)}
            disabled={isSaving || questions.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isPublished ? 'Update Published Quiz' : 'Publish for Trainees'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-4">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <Bot className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Instructional AI Generator</h2>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                Engine: Google Gemini
              </p>
              <p className="text-[10px] text-slate-400 font-mono">{settings.ai_model}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Difficulty Target
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['Easy', 'Medium', 'Hard'].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    className={`py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      difficulty === d
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="material-text" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Training Source Material
              </label>
              <textarea
                id="material-text"
                rows={8}
                value={materialText}
                onChange={(e) => setMaterialText(e.target.value)}
                placeholder="Paste slide transcripts, policy text or presentation notes here, or upload a document on the training page."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>

            <button
              onClick={handleGenerateAIQuiz}
              disabled={isGenerating || !materialText.trim()}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
              {isGenerating ? `Synthesizing ${targetCount} MCQs...` : `Generate ${targetCount} MCQs`}
            </button>

            {generationWarning && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-800 dark:text-amber-200 leading-relaxed">
                  {generationWarning}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Questions ({questions.length})
            </h2>
            {generationSource && (
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
                Generated via {generationSource}
              </span>
            )}
          </div>

          {questions.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 space-y-3">
              <Bot className="w-10 h-10 mx-auto text-slate-400" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No questions yet
              </p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Paste material on the left, then generate a full question set with four options and an
                explanation each.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((q, qIdx) => (
                <div
                  key={q.id || qIdx}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0">
                      {qIdx + 1}
                    </span>
                    <input
                      type="text"
                      aria-label={`Question ${qIdx + 1} text`}
                      value={q.question_text || ''}
                      onChange={(e) => patchQuestion(qIdx, { question_text: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                    <button
                      onClick={() => handleDeleteQuestion(qIdx)}
                      aria-label={`Delete question ${qIdx + 1}`}
                      className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options?.map((opt, optIdx) => (
                      <div
                        key={optIdx}
                        onClick={() => patchQuestion(qIdx, { correct_answer: optIdx })}
                        className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-colors ${
                          q.correct_answer === optIdx
                            ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100 font-semibold'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                            q.correct_answer === optIdx
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                          }`}
                        >
                          {String.fromCharCode(65 + optIdx)}
                        </span>
                        <input
                          type="text"
                          aria-label={`Question ${qIdx + 1} option ${String.fromCharCode(65 + optIdx)}`}
                          value={opt}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => updateOptionText(qIdx, optIdx, e.target.value)}
                          className="w-full bg-transparent text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400">
                    <span className="font-bold text-slate-700 dark:text-slate-300 mr-1">Explanation:</span>
                    <input
                      type="text"
                      aria-label={`Question ${qIdx + 1} explanation`}
                      value={q.explanation || ''}
                      onChange={(e) => patchQuestion(qIdx, { explanation: e.target.value })}
                      className="w-full bg-transparent border-none text-[11px] text-slate-600 dark:text-slate-300 focus:outline-none mt-1"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default QuizStudio;
