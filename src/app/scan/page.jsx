"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { supabaseService } from '@/lib/services/supabaseService';
import { Html5Qrcode } from 'html5-qrcode';
import {
  QrCode,
  CheckCircle2,
  AlertCircle,
  Camera,
  ArrowRight,
  Sparkles,
  FileQuestion
} from 'lucide-react';

export default function QRScannerPage() {
  const { currentUser, showToast, navigate } = useApp();
  const [trainings, setTrainings] = useState([]);
  const [selectedTrainingId, setSelectedTrainingId] = useState('training-sec-101');
  const [manualToken, setManualToken] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const scannerRef = useRef(null);

  useEffect(() => {
    const loadTrainings = async () => {
      const all = await supabaseService.getTrainings();
      setTrainings(all || []);
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const queryTrainingId = urlParams.get('trainingId');
        const queryToken = urlParams.get('token');
        if (queryTrainingId) setSelectedTrainingId(queryTrainingId);
        if (queryToken) {
          setManualToken(queryToken);
          handleProcessAttendance(queryTrainingId || 'training-sec-101', queryToken);
        }
      }
    };
    loadTrainings();
  }, []);

  const startCamera = async () => {
    try {
      setErrorMessage(null);
      const html5QrCode = new Html5Qrcode('qr-reader');
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          stopCamera();
          let cleanToken = decodedText;
          if (decodedText.includes('token=')) {
            try {
              const url = new URL(decodedText);
              cleanToken = url.searchParams.get('token') || decodedText;
              const trId = url.searchParams.get('trainingId');
              if (trId) setSelectedTrainingId(trId);
            } catch {
              // fallback
            }
          }
          setManualToken(cleanToken);
          handleProcessAttendance(selectedTrainingId, cleanToken);
        },
        () => {}
      );
      setCameraActive(true);
    } catch (err) {
      console.warn('Camera start error:', err);
      setCameraActive(false);
      setErrorMessage('Camera access unavailable or blocked. Please paste or enter the QR token code manually below.');
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current && cameraActive) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {
        // ignore
      }
      setCameraActive(false);
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleProcessAttendance = async (trainingId, token) => {
    if (!token?.trim()) {
      setErrorMessage('Please provide a valid attendance token.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await supabaseService.markAttendance(
        trainingId,
        token.trim(),
        currentUser
      );

      if (result.success) {
        setSuccessMessage('Attendance marked successfully.');
        showToast('Attendance marked successfully.', 'success');
      } else {
        setErrorMessage(result.message);
        showToast(result.message, 'error');
      }
    } catch (err) {
      setErrorMessage(err?.message || 'Verification failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAutoFillLiveToken = async () => {
    try {
      const session = await supabaseService.getActiveAttendanceSession(selectedTrainingId);
      if (session?.current_qr_token) {
        setManualToken(session.current_qr_token);
        showToast('Loaded active trainer QR token', 'info');
      } else {
        showToast('No active session found for this training', 'warning');
      }
    } catch {
      showToast('Unable to fetch active session token', 'error');
    }
  };

  return (
    <div className="max-w-lg mx-auto py-4 space-y-6">
      {/* Top Header */}
      <div className="text-center space-y-1">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/30">
          <QrCode className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Scan Attendance QR Code
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Point your phone camera at the trainer's projected 60s QR code to record presence.
        </p>
      </div>

      {/* Target Training Selector */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Active Corporate Training
        </label>
        <select
          value={selectedTrainingId}
          onChange={(e) => setSelectedTrainingId(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
        >
          {trainings.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title} ({t.date})
            </option>
          ))}
        </select>
      </div>

      {/* Camera Scanner Viewport */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
        <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-square flex flex-col items-center justify-center text-white text-center border border-slate-800">
          <div id="qr-reader" className="w-full h-full" />

          {!cameraActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 space-y-3 bg-slate-950/90">
              <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center text-emerald-400 shadow-lg">
                <Camera className="w-7 h-7" />
              </div>
              <p className="text-sm font-bold text-white">Camera Viewport</p>
              <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                Click below to grant camera access and align the projected QR code within the viewbox.
              </p>
              <button
                type="button"
                onClick={startCamera}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition-transform active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Start Mobile Camera Scanner</span>
              </button>
            </div>
          )}

          {cameraActive && (
            <button
              onClick={stopCamera}
              className="absolute top-3 right-3 px-3 py-1 bg-rose-600/80 hover:bg-rose-600 text-white rounded-lg text-xs font-semibold backdrop-blur-sm cursor-pointer"
            >
              Close Camera
            </button>
          )}
        </div>

        {/* Success Confirmation Banner */}
        {successMessage && (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 flex items-start gap-3 animate-in fade-in zoom-in-95">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div className="space-y-2 flex-1">
              <div>
                <p className="text-sm font-extrabold">{successMessage}</p>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                  Verified as <span className="font-semibold">{currentUser?.name || currentUser?.full_name}</span>.
                </p>
              </div>
              <button
                onClick={async () => {
                  const quiz = await supabaseService.getQuiz(selectedTrainingId);
                  if (quiz) navigate(`/quiz/${quiz.id}`);
                  else navigate('/trainee/dashboard');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                <FileQuestion className="w-3.5 h-3.5" />
                <span>Start 10-Question Training Quiz</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 flex items-start gap-2.5 text-xs animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">Attendance Verification Notice</p>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Manual Token Entry Fallback */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Manual Token / Desktop Testing
            </label>
            <button
              type="button"
              onClick={handleAutoFillLiveToken}
              className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3 h-3" />
              Fetch Current Live QR Token
            </button>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder="e.g. TOKEN-ABCDEF"
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="button"
              disabled={isProcessing || !manualToken.trim()}
              onClick={() => handleProcessAttendance(selectedTrainingId, manualToken)}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold disabled:opacity-50 transition-colors shrink-0 cursor-pointer"
            >
              {isProcessing ? 'Verifying...' : 'Validate & Mark'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
