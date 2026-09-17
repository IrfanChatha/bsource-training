"use client";
import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { supabaseService } from '@/lib/services/supabaseService';
import { STORAGE_KEYS, readStored } from '@/lib/storage';
import {
  Sparkles,
  Bot,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  ArrowLeft,
  Sliders,
  Send,
  Save,
  Check,
  Cpu
} from 'lucide-react';

export default function TrainerQuizPage({ params }) {
  const { showToast, navigate } = useApp();
  const trainingId = params?.id || 'training-sec-101';
  const [training, setTraining] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);

  // Generator form controls
  const [provider, setProvider] = useState('gemini');
  const [difficulty, setDifficulty] = useState('Medium');
  const [materialText, setMaterialText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationSource, setGenerationSource] = useState('');

  // Questions working state
  const [questions, setQuestions] = useState([]);
  const [quizTitle, setQuizTitle] = useState('Training Comprehension Assessment');
  const [isPublished, setIsPublished] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const t = await supabaseService.getTrainingById(trainingId);
        if (t) setTraining(t);

        const existingQuiz = await supabaseService.getQuiz(trainingId);
        if (existingQuiz) {
          setQuiz(existingQuiz);
          setQuizTitle(existingQuiz.title || 'Training Comprehension Assessment');
          setDifficulty(existingQuiz.difficulty || 'Medium');
          setIsPublished(!!existingQuiz.is_published);
          setQuestions(existingQuiz.questions || []);
        } else {
          const materials = await supabaseService.getMaterials(trainingId);
          if (materials && materials.length > 0) {
            const combined = materials.map((m) => m.extracted_text).join('\n\n');
            setMaterialText(combined);
          } else if (typeof window !== 'undefined') {
            const cached = readStored(STORAGE_KEYS.activeMaterialText);
            if (cached) setMaterialText(cached);
          }
        }
      } catch (err) {
        showToast('Error loading quiz studio', 'error');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [trainingId]);

  const handleGenerateAIQuiz = async () => {
    if (!materialText.trim()) {
      showToast('Please provide training material or slide notes to synthesize questions.', 'error');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialText: materialText.trim(),
          numQuestions: 10,
          difficulty,
          provider,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to generate quiz');
      }

      const res = await response.json();
      const generatedData = res.data;

      if (!generatedData || !Array.isArray(generatedData.questions)) {
        throw new Error('AI output was invalid.');
      }

      const formattedQuestions = generatedData.questions.map((q, idx) => ({
        id: `q-${Date.now()}-${idx}`,
        question_order: idx + 1,
        question_text: q.question,
        options: q.options,
        correct_answer: q.correctAnswer ?? 0,
        explanation: q.explanation || 'Based on core training requirements.',
      }));

      setQuestions(formattedQuestions);
      setQuizTitle(generatedData.title || `${training?.title || 'Training'} Assessment`);
      setGenerationSource(res.provider || provider);
      showToast(`Successfully generated 10 verified assessment questions via ${res.provider || provider}!`, 'success');
    } catch (err) {
      showToast(err?.message || 'Error generating AI questions', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveQuiz = async (publishNow = false) => {
    if (questions.length === 0) {
      showToast('Please generate or add questions before saving.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const saved = await supabaseService.saveQuiz({
        id: quiz?.id || `quiz-${Date.now()}`,
        training_id: trainingId,
        title: quizTitle,
        difficulty,
        total_questions: questions.length,
        is_published: publishNow ? true : isPublished,
        questions,
        created_at: quiz?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      setQuiz(saved);
      setIsPublished(saved.is_published);
      showToast(
        publishNow ? 'Quiz published! Trainees can now access the 10-question assessment.' : 'Quiz draft saved successfully!',
        'success'
      );
    } catch (err) {
      showToast(err?.message || 'Failed to save quiz', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const updateQuestionText = (idx, newText) => {
    setQuestions((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], question_text: newText };
      return copy;
    });
  };

  const updateOptionText = (qIdx, optIdx, newOption) => {
    setQuestions((prev) => {
      const copy = [...prev];
      const opts = [...copy[qIdx].options];
      opts[optIdx] = newOption;
      copy[qIdx] = { ...copy[qIdx], options: opts };
      return copy;
    });
  };

  const updateCorrectAnswer = (qIdx, correctIdx) => {
    setQuestions((prev) => {
      const copy = [...prev];
      copy[qIdx] = { ...copy[qIdx], correct_answer: correctIdx };
      return copy;
    });
  };

  const updateExplanation = (qIdx, exp) => {
    setQuestions((prev) => {
      const copy = [...prev];
      copy[qIdx] = { ...copy[qIdx], explanation: exp };
      return copy;
    });
  };

  const handleDeleteQuestion = (qIdx) => {
    setQuestions((prev) => prev.filter((_, idx) => idx !== qIdx).map((q, i) => ({ ...q, question_order: i + 1 })));
    showToast('Question removed', 'info');
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-400">Loading AI Quiz Studio...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/trainer/trainings')}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50">
                10 Multiple-Choice Questions
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

      {/* Generator Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-4">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <Bot className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Instructional AI Generator
              </h2>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                AI Provider Engine
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'gemini', label: 'Google Gemini', desc: 'GenAI 2.5 Flash' },
                  { id: 'openai', label: 'OpenAI GPT-4o', desc: 'Enterprise' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProvider(p.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      provider === p.id
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span className="text-xs font-bold block">{p.label}</span>
                    <span className="text-[10px] opacity-75">{p.desc}</span>
                  </button>
                ))}
              </div>
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
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Training Source Material
              </label>
              <textarea
                rows={8}
                value={materialText}
                onChange={(e) => setMaterialText(e.target.value)}
                placeholder="Paste corporate slide transcripts, policy text, or presentation notes here..."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>

            <button
              onClick={handleGenerateAIQuiz}
              disabled={isGenerating || !materialText.trim()}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
              {isGenerating ? 'Synthesizing 10 MCQs...' : 'Generate 10 Verified MCQs'}
            </button>
          </div>
        </div>

        {/* Questions Editor List */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Questions ({questions.length} / 10)
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
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No questions generated yet</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Paste presentation material on the left panel and click 'Generate 10 Verified MCQs' to synthesize full questions with 4 options and pedagogical explanations.
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
                      value={q.question_text}
                      onChange={(e) => updateQuestionText(qIdx, e.target.value)}
                      className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                    <button
                      onClick={() => handleDeleteQuestion(qIdx)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Options */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options?.map((opt, optIdx) => (
                      <div
                        key={optIdx}
                        onClick={() => updateCorrectAnswer(qIdx, optIdx)}
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
                          value={opt}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => updateOptionText(qIdx, optIdx, e.target.value)}
                          className="w-full bg-transparent text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Explanation */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400">
                    <span className="font-bold text-slate-700 dark:text-slate-300 mr-1">Explanation:</span>
                    <input
                      type="text"
                      value={q.explanation || ''}
                      onChange={(e) => updateExplanation(qIdx, e.target.value)}
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
