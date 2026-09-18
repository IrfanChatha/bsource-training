"use client";
import React, { useCallback, useState, useEffect, useRef, use } from 'react';
import { useApp } from '@/context/AppContext';
import { supabaseService } from '@/lib/services/supabaseService';
import { STORAGE_KEYS, writeStored } from '@/lib/storage';
import { SUPPORTED_EXTENSIONS } from '@/lib/services/fileExtractor';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  Calendar,
  Clock,
  MapPin,
  QrCode,
  FileQuestion,
  ArrowLeft,
  Sparkles,
  ChevronRight
} from 'lucide-react';

export default function TrainingDetailsPage({ params }) {
  const unwrappedParams = params ? (typeof params.then === 'function' ? use(params) : params) : {};
  const trainingId = unwrappedParams.id || '';
  const { showToast, navigate } = useApp();
  const [training, setTraining] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);

  // Upload & Extraction state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const fileInputRef = useRef(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [t, mats] = await Promise.all([
        supabaseService.getTrainingById(trainingId),
        supabaseService.getMaterials(trainingId),
      ]);
      setTraining(t);
      setMaterials(mats || []);
      // Keep whatever the user has open; otherwise show the newest upload.
      setSelectedMaterial((prev) => prev || mats?.[0] || null);
    } catch (e) {
      showToast(e?.message || 'Error loading training details', 'error');
    } finally {
      setLoading(false);
    }
  }, [trainingId, showToast]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => loadData());
    return () => cancelAnimationFrame(raf);
  }, [loadData]);

  const handleFileUpload = async (file) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      showToast(
        `Unsupported file format ".${ext}". Upload one of: ${SUPPORTED_EXTENSIONS.join(', ')}.`,
        'error'
      );
      return;
    }

    setIsUploading(true);
    setUploadProgress(5);
    setUploadStatus(`Preparing ${file.name}...`);

    try {
      const uploaded = await supabaseService.uploadMaterial(trainingId, file, (percent, status) => {
        setUploadProgress(percent);
        setUploadStatus(status);
      });
      showToast(
        `Extracted ${uploaded.wordCount ?? 0} words from ${file.name}.`,
        'success'
      );
      await loadData();
      setSelectedMaterial(uploaded);
    } catch (err) {
      showToast(err?.message || `Could not ingest ${file.name}.`, 'error');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStatus('');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-400">Loading training...</div>;
  }

  if (!training) {
    return (
      <div className="p-12 text-center space-y-4">
        <p className="text-sm font-semibold text-rose-500">Training session not found.</p>
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
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/trainer/trainings')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Trainings List
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/trainer/attendance/${trainingId}`)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800 text-xs font-semibold transition-colors cursor-pointer"
          >
            <QrCode className="w-3.5 h-3.5" />
            Launch Live QR Attendance
          </button>

          <button
            onClick={() => navigate(`/trainer/quiz/${trainingId}`)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <FileQuestion className="w-3.5 h-3.5" />
            AI Quiz Studio
          </button>
        </div>
      </div>

      {/* Header Card */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/50">
                {training.status}
              </span>
              <span className="text-xs text-slate-400">
                Trainer: <span className="font-semibold text-slate-700 dark:text-slate-300">{training.trainer_name}</span>
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {training.title}
            </h1>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span>{training.date}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>{training.time} ({training.duration_minutes} min)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-slate-400" />
              <span>{training.location || 'Remote'}</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-4xl">
          {training.description || 'No description provided.'}
        </p>
      </div>

      {/* Material Upload & Text Extraction Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Upload zone & Extracted Text */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Training Slide & Document Ingestion
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Supported files: <span className="font-semibold text-indigo-600 dark:text-indigo-400">PDF, PPTX, DOCX, TXT</span>. Documents are parsed, chunked, and synthesized for AI quiz creation.
                </p>
              </div>
            </div>

            {/* Drag and Drop Zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-8 rounded-2xl border-2 border-dashed transition-all text-center cursor-pointer ${
                isUploading
                  ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20'
                  : 'border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 bg-slate-50/50 dark:bg-slate-800/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.pptx,.docx,.txt"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
              />

              <div className="max-w-sm mx-auto space-y-3">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Click to browse or drag & drop training slides
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    PDF decks, PowerPoint slides, Word manuals, or policy text
                  </p>
                </div>

                {isUploading && (
                  <div className="space-y-2 pt-2 text-left">
                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                      <span className="font-medium">{uploadStatus}</span>
                      <span className="font-bold">{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 transition-all duration-300 rounded-full"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Sample Document Inserter */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-400">Need immediate demo training slides?</span>
              <button
                type="button"
                onClick={async () => {
                  const sampleText = `# Enterprise Cybersecurity Protocol 2026

## Module 1: Zero-Trust Principles
The enterprise enforces strict Zero-Trust network segmentation. Trust is never granted implicitly. Every employee and external contractor must undergo multi-factor authentication (MFA) on each session renewal. Device compliance is continuously verified through mobile device management certificates.

## Module 2: AI-Generated Spear Phishing & Social Engineering
Adversaries increasingly synthesize executive voice clones and targeted spear-phishing emails containing urgent wire or password requests. Employees must independently verify unexpected financial instructions via authorized secondary channels. Never approve unsolicited MFA push notifications. Report MFA fatigue attacks immediately to the Security Operations Center (SOC).

## Module 3: Confidential Data Classification
All customer personally identifiable information (PII), source code, internal roadmap drafts, and proprietary cryptographic keys fall under the "Restricted Confidential" tier. Storing production API credentials in frontend repositories or public cloud storage buckets is strictly prohibited. Production secrets must reside in enterprise hardware security modules or audited secret vaults.

## Module 4: Incident Response Timelines
If an enterprise endpoint is lost, stolen, or exhibits unauthorized activity, the employee must contact the incident response desk within 1 hour. Remote device encryption keys are revoked immediately to prevent local storage exfiltration.`;

                  const fakeFile = new File([sampleText], 'Cybersecurity_Protocol_2026.txt', { type: 'text/plain' });
                  await handleFileUpload(fakeFile);
                }}
                className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                Load Sample CyberSec Protocol (TXT)
              </button>
            </div>
          </div>

          {/* Extracted Text Viewer */}
          {selectedMaterial && (
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {selectedMaterial.file_name}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200/50">
                      {selectedMaterial.file_type}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {selectedMaterial.chunks_count || 1} semantic chunk(s)
                  </p>
                </div>

                <button
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      writeStored(STORAGE_KEYS.activeMaterialText, selectedMaterial.extracted_text);
                    }
                    navigate(`/trainer/quiz/${trainingId}`);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Generate AI Quiz from This
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 max-h-72 overflow-y-auto font-mono text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {selectedMaterial.extracted_text}
              </div>
            </div>
          )}
        </div>

        {/* Right 1 Col: Ingested Materials List & Checklist */}
        <div className="space-y-4">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Ingested Training Materials ({materials.length})
            </h3>

            {materials.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700">
                No materials uploaded yet. Upload a slide deck or manual to power the AI quiz generator.
              </div>
            ) : (
              <div className="space-y-2">
                {materials.map((mat) => (
                  <div
                    key={mat.id}
                    onClick={() => setSelectedMaterial(mat)}
                    className={`p-3 rounded-2xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                      selectedMaterial?.id === mat.id
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                      <div className="truncate">
                        <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {mat.file_name}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {mat.file_size ? (mat.file_size / 1024).toFixed(1) + ' KB' : 'Document'}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Workflow Checklist */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Session Execution Flow</h3>
            <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
              <li className="flex items-start gap-2">
                <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${materials.length > 0 ? 'text-emerald-500' : 'text-slate-300'}`} />
                <span>1. Upload slides/material & extract text</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-indigo-500 shrink-0" />
                <span>2. Generate & publish the AI quiz</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-indigo-500 shrink-0" />
                <span>3. Project 60s dynamic QR code on screen</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-indigo-500 shrink-0" />
                <span>4. Monitor live attendance and score completion</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
