"use client";
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { supabaseService } from '@/lib/services/supabaseService';
import { Html5Qrcode } from 'html5-qrcode';
import { cameraUnavailableReason, describeCameraError, scannerConfig } from '@/lib/camera';
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
  const [selectedTrainingId, setSelectedTrainingId] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const scannerRef = useRef(null);

  // The camera callback fires outside React's render cycle, so it reads the
  // selected training from a ref. Reading the state variable captured a stale
  // value and checked people in against the wrong session.
  const selectedTrainingRef = useRef('');
  useEffect(() => {
    selectedTrainingRef.current = selectedTrainingId;
  }, [selectedTrainingId]);

  const processAttendance = useCallback(
    async (trainingId, token) => {
      if (!token?.trim()) {
        setErrorMessage('Please provide a valid attendance token.');
        return;
      }
      if (!trainingId) {
        setErrorMessage('Choose the training you are attending first.');
        return;
      }

      setIsProcessing(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      try {
        const result = await supabaseService.markAttendance(trainingId, token.trim());
        if (result.success) {
          setSuccessMessage(result.message);
          showToast(result.message, 'success');
        } else {
          setErrorMessage(result.message);
          showToast(result.message, 'error');
        }
      } catch (err) {
        const message = err?.message || 'Verification failed.';
        setErrorMessage(message);
        showToast(message, 'error');
      } finally {
        setIsProcessing(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    let active = true;

    (async () => {
      let all = [];
      try {
        all = await supabaseService.getTrainings();
      } catch (e) {
        if (active) setErrorMessage(e?.message || 'Could not load training sessions.');
      }
      if (!active) return;
      setTrainings(all || []);

      const urlParams = new URLSearchParams(window.location.search);
      const queryTrainingId = urlParams.get('trainingId');
      const queryToken = urlParams.get('token');

      // Default to whatever the QR pointed at, otherwise the first session.
      const initialId = queryTrainingId || all?.[0]?.id || '';
      setSelectedTrainingId(initialId);
      selectedTrainingRef.current = initialId;

      if (queryToken) {
        setManualToken(queryToken);
        await processAttendance(initialId, queryToken);
      }
    })();

    return () => {
      active = false;
    };
  }, [processAttendance]);

  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      await scanner.stop();
      scanner.clear();
    } catch {
      // The scanner may already be stopped; nothing to recover from.
    }
    scannerRef.current = null;
    setCameraActive(false);
  }, []);

  const startCamera = async () => {
    const blocked = cameraUnavailableReason();
    if (blocked) {
      setErrorMessage(blocked);
      return;
    }

    try {
      setErrorMessage(null);
      const html5QrCode = new Html5Qrcode('qr-reader');
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        scannerConfig(),
        (decodedText) => {
          stopCamera();

          let cleanToken = decodedText;
          let trainingId = selectedTrainingRef.current;
          if (decodedText.includes('token=')) {
            try {
              const url = new URL(decodedText);
              cleanToken = url.searchParams.get('token') || decodedText;
              const trId = url.searchParams.get('trainingId');
              if (trId) {
                trainingId = trId;
                setSelectedTrainingId(trId);
                selectedTrainingRef.current = trId;
              }
            } catch {
              // Not a URL; use the scanned value as the token.
            }
          }
          setManualToken(cleanToken);
          processAttendance(trainingId, cleanToken);
        },
        () => {}
      );
      setCameraActive(true);
    } catch (err) {
      console.warn('Camera start error:', err);
      scannerRef.current = null;
      setCameraActive(false);
      setErrorMessage(describeCameraError(err));
    }
  };

  useEffect(() => () => { stopCamera(); }, [stopCamera]);

  const handleAutoFillLiveToken = async () => {
    try {
      const session = await supabaseService.getActiveAttendanceSession(selectedTrainingId);
      if (session?.current_qr_token) {
        setManualToken(session.current_qr_token);
        showToast('Loaded the trainer’s live token', 'info');
      } else {
        showToast('No attendance session is open for this training', 'warning');
      }
    } catch (e) {
      showToast(e?.message || 'Unable to fetch the active session token', 'error');
    }
  };

  return (
    <div className="max-w-lg mx-auto py-4 space-y-6">
      <div className="text-center space-y-1">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/30">
          <QrCode className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Scan Attendance QR Code
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Point your camera at the trainer&rsquo;s projected code to record your presence.
        </p>
      </div>

      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
        <label
          htmlFor="training-select"
          className="block text-[11px] font-bold uppercase tracking-wider text-slate-400"
        >
          Active Corporate Training
        </label>
        <select
          id="training-select"
          value={selectedTrainingId}
          onChange={(e) => setSelectedTrainingId(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
        >
          {trainings.length === 0 && <option value="">No training sessions available</option>}
          {trainings.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title} ({t.date})
            </option>
          ))}
        </select>
      </div>

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
                Grant camera access and align the projected QR code within the viewbox.
              </p>
              <button
                type="button"
                onClick={startCamera}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition-transform active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Start Camera Scanner</span>
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

        {successMessage && (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 flex items-start gap-3 animate-in fade-in zoom-in-95">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div className="space-y-2 flex-1">
              <div>
                <p className="text-sm font-extrabold">{successMessage}</p>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                  Verified as{' '}
                  <span className="font-semibold">
                    {currentUser?.full_name || currentUser?.name || 'you'}
                  </span>
                  .
                </p>
              </div>
              <button
                onClick={async () => {
                  try {
                    const quiz = await supabaseService.getQuiz(selectedTrainingId);
                    if (quiz?.is_published) navigate(`/quiz/${quiz.id}`);
                    else {
                      showToast('No published assessment for this session yet.', 'info');
                      navigate('/trainee/dashboard');
                    }
                  } catch {
                    navigate('/trainee/dashboard');
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                <FileQuestion className="w-3.5 h-3.5" />
                <span>Start Training Quiz</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 flex items-start gap-2.5 text-xs animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">Attendance Not Recorded</p>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <label
              htmlFor="manual-token"
              className="block text-[11px] font-bold uppercase tracking-wider text-slate-400"
            >
              Manual Token Entry
            </label>
            <button
              type="button"
              onClick={handleAutoFillLiveToken}
              className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3 h-3" />
              Fetch current live token
            </button>
          </div>

          <div className="flex gap-2">
            <input
              id="manual-token"
              type="text"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder="e.g. TRN-ABC123"
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="button"
              disabled={isProcessing || !manualToken.trim() || !selectedTrainingId}
              onClick={() => processAttendance(selectedTrainingId, manualToken)}
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
