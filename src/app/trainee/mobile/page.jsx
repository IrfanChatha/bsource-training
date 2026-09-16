"use client";
import { useState, useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { supabaseService } from "@/lib/services/supabaseService";
import { Html5Qrcode } from "html5-qrcode";
import confetti from "canvas-confetti";
import {
  QrCode,
  CheckCircle2,
  FileQuestion,
  Calendar,
  Clock,
  ArrowRight,
  ArrowLeft,
  Award,
  BookOpen,
  Camera,
  Check,
  Shield,
  FileSpreadsheet,
  ChevronRight,
  Smartphone,
  Maximize2,
  Search,
  MapPin,
  User,
  Zap
} from "lucide-react";

export default function TraineeMobileApp({ embedded = false } = {}) {
  const { currentUser, navigate, showToast, darkMode, setDarkMode } = useApp();
  const [activeTab, setActiveTab] = useState("today");
  const [viewMode, setViewMode] = useState("device");
  const [currentTime, setCurrentTime] = useState("09:41");
  const [trainings, setTrainings] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [availableQuizzes, setAvailableQuizzes] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedTrainingId, setSelectedTrainingId] = useState("training-sec-101");
  const [cameraActive, setCameraActive] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [isProcessingAttendance, setIsProcessingAttendance] = useState(false);
  const [attendanceSuccess, setAttendanceSuccess] = useState(null);
  const scannerRef = useRef(null);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [quizTimer, setQuizTimer] = useState(600);
  const [isQuizSubmitted, setIsQuizSubmitted] = useState(false);
  const [quizResultAttempt, setQuizResultAttempt] = useState(null);
  const [courseFilter, setCourseFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourseDetail, setSelectedCourseDetail] = useState(null);
  const [showCertificateModal, setShowCertificateModal] = useState(null);
  useEffect(() => {
    const updateTime = () => {
      const now = /* @__PURE__ */ new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1e4);
    return () => clearInterval(timer);
  }, []);
  const loadData = async () => {
    setLoading(true);
    try {
      const allTrainings = await supabaseService.getTrainings();
      const published = allTrainings.filter((t) => t.is_published && t.status !== "archived");
      setTrainings(published);
      if (published.length > 0 && !selectedTrainingId) {
        setSelectedTrainingId(published[0].id);
      }
      const qMap = {};
      for (const t of published) {
        const q = await supabaseService.getQuiz(t.id);
        if (q && q.is_published) {
          qMap[t.id] = q;
        }
      }
      setAvailableQuizzes(qMap);
      const allAtts = [];
      for (const t of published) {
        const attList = await supabaseService.getAttendance(t.id);
        const myAtts = attList.filter((a) => a.trainee_id === currentUser.id);
        allAtts.push(...myAtts);
      }
      setAttendance(allAtts);
      const allAttempts = [];
      for (const t of published) {
        const attList = await supabaseService.getAttemptsForTraining(t.id);
        const myAttempts = attList.filter((a) => a.trainee_id === currentUser.id);
        allAttempts.push(...myAttempts);
      }
      setAttempts(allAttempts);
    } catch {
      showToast("Error syncing trainee data", "error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    loadData();
    const unsub = supabaseService.onRealtimeUpdate(() => loadData());
    return () => unsub();
  }, [currentUser.id]);
  const startCamera = async () => {
    try {
      const html5QrCode = new Html5Qrcode("mobile-qr-reader");
      scannerRef.current = html5QrCode;
      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          stopCamera();
          let cleanToken = decodedText;
          if (decodedText.includes("token=")) {
            try {
              const url = new URL(decodedText);
              cleanToken = url.searchParams.get("token") || decodedText;
              const trId = url.searchParams.get("trainingId");
              if (trId) setSelectedTrainingId(trId);
            } catch {
            }
          }
          handleVerifyAttendance(cleanToken);
        },
        () => {
        }
      );
      setCameraActive(true);
    } catch {
      setCameraActive(false);
      showToast("Camera not accessible. Please enter token or use Quick Demo Scan.", "warning");
    }
  };
  const stopCamera = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {
      });
      scannerRef.current = null;
    }
    setCameraActive(false);
  };
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);
  const handleVerifyAttendance = async (tokenToUse) => {
    if (!tokenToUse.trim()) {
      showToast("Please provide a valid token", "warning");
      return;
    }
    setIsProcessingAttendance(true);
    try {
      const res = await supabaseService.markAttendanceByToken({
        training_id: selectedTrainingId,
        trainee_id: currentUser.id,
        trainee_name: currentUser.full_name,
        trainee_email: currentUser.email,
        qr_token: tokenToUse.trim()
      });
      if (res.success) {
        setAttendanceSuccess(res.message);
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
        showToast("Attendance recorded in Google Sheets database!", "success");
        loadData();
      } else {
        showToast(res.message, "error");
      }
    } catch (err) {
      showToast(err.message || "Verification failed", "error");
    } finally {
      setIsProcessingAttendance(false);
    }
  };
  const handleSimulateScan = async () => {
    try {
      const session = await supabaseService.getActiveAttendanceSession(selectedTrainingId);
      if (session && session.current_qr_token) {
        setManualToken(session.current_qr_token);
        handleVerifyAttendance(session.current_qr_token);
      } else {
        const dummyToken = `tt-${selectedTrainingId.slice(0, 8)}-demo-${Date.now()}`;
        setManualToken(dummyToken);
        handleVerifyAttendance(dummyToken);
      }
    } catch {
      const dummyToken = `tt-${selectedTrainingId.slice(0, 8)}-demo-${Date.now()}`;
      setManualToken(dummyToken);
      handleVerifyAttendance(dummyToken);
    }
  };
  const startQuizSession = (quiz) => {
    setActiveQuiz(quiz);
    setCurrentQIndex(0);
    setSelectedAnswers({});
    setQuizTimer(quiz.time_limit_minutes ? quiz.time_limit_minutes * 60 : 600);
    setIsQuizSubmitted(false);
    setQuizResultAttempt(null);
    setActiveTab("quiz");
  };
  useEffect(() => {
    if (!activeQuiz || isQuizSubmitted) return;
    const interval = setInterval(() => {
      setQuizTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          submitQuizAnswers(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1e3);
    return () => clearInterval(interval);
  }, [activeQuiz, isQuizSubmitted]);
  const submitQuizAnswers = async (autoSubmit = false) => {
    if (!activeQuiz) return;
    try {
      const answersArray = activeQuiz.questions.map((q) => ({
        question_id: q.id,
        selected_option: selectedAnswers[q.id] !== void 0 ? selectedAnswers[q.id] : -1
      }));
      const res = await supabaseService.submitQuizAttempt({
        quiz_id: activeQuiz.id,
        training_id: activeQuiz.training_id,
        trainee_id: currentUser.id,
        trainee_name: currentUser.full_name,
        answers: answersArray
      });
      setQuizResultAttempt(res.attempt);
      setIsQuizSubmitted(true);
      loadData();
      if (res.attempt.percentage >= 70) {
        confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
        showToast(`Passed with ${res.attempt.score}/10 (${res.attempt.percentage}%)!`, "success");
      } else {
        showToast(`Completed. Score: ${res.attempt.score}/10 (${res.attempt.percentage}%)`, "info");
      }
    } catch {
      showToast("Error saving quiz attempt", "error");
    }
  };
  const filteredCourses = trainings.filter((t) => {
    const isAttended = attendance.some((a) => a.training_id === t.id);
    if (courseFilter === "attended" && !isAttended) return false;
    if (courseFilter === "upcoming" && t.status !== "upcoming") return false;
    if (courseFilter === "completed" && !isAttended && t.status !== "completed") return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return t.title.toLowerCase().includes(q) || t.trainer_name && t.trainer_name.toLowerCase().includes(q) || t.location && t.location.toLowerCase().includes(q);
    }
    return true;
  });
  const totalAttendedCount = attendance.length;
  const passedQuizzesCount = attempts.filter((a) => a.percentage >= 70).length;
  const avgScore = attempts.length > 0 ? Math.round(attempts.reduce((sum, a) => sum + a.percentage, 0) / attempts.length) : 0;
  const activeTrainingToday = trainings.find((t) => t.status === "in_progress") || trainings.find((t) => t.status === "upcoming") || trainings[0];
  const hasAttendedToday = activeTrainingToday ? attendance.some((a) => a.training_id === activeTrainingToday.id) : false;
  return (
    <div className={`w-full ${embedded ? 'py-0' : 'py-2 sm:py-6'} flex flex-col items-center justify-center`}>
      {
    /* Top Desktop Controls: Frame Mode, Return to Portal */
  }
      {!embedded && (
        <div className="w-full max-w-md md:max-w-2xl flex items-center justify-between mb-4 px-3 text-xs">
          <button
    onClick={() => navigate("/trainee/dashboard")}
    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold transition-colors"
  >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Desktop Portal</span>
          </button>

          <div className="flex items-center gap-2">
            {
    /* Viewport switch for desktop preview */
  }
            <div className="hidden md:flex items-center p-0.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              <button
    onClick={() => setViewMode("device")}
    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${viewMode === "device" ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm" : "hover:text-slate-900 dark:hover:text-white"}`}
  >
                <Smartphone className="w-3 h-3" />
                <span>Device Frame</span>
              </button>
              <button
    onClick={() => setViewMode("fullscreen")}
    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${viewMode === "fullscreen" ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm" : "hover:text-slate-900 dark:hover:text-white"}`}
  >
                <Maximize2 className="w-3 h-3" />
                <span>Fluid Mobile</span>
              </button>
            </div>

            <button
    onClick={() => setDarkMode(!darkMode)}
    className="p-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
    title="Toggle Dark Mode"
  >
              {darkMode ? "☀️" : "🌙"}
            </button>
          </div>
        </div>
      )}

      {
    /* Main Smartphone Shell Container */
  }
      <div
    className={`w-full transition-all duration-300 ${embedded ? "max-w-md w-full rounded-2xl md:rounded-3xl border-0 md:border border-slate-200 dark:border-slate-800 shadow-none md:shadow-lg bg-slate-50 dark:bg-slate-950 min-h-[calc(100vh-5rem)] flex flex-col relative overflow-hidden" : viewMode === "device" ? "max-w-[420px] rounded-[48px] border-[10px] border-slate-900 dark:border-slate-800 shadow-2xl overflow-hidden ring-1 ring-slate-800/20 bg-slate-50 dark:bg-slate-950 min-h-[820px] flex flex-col relative" : "max-w-md w-full rounded-3xl border border-slate-200 dark:border-slate-800 shadow-lg bg-slate-50 dark:bg-slate-950 min-h-[780px] flex flex-col relative overflow-hidden"}`}
  >
        {
    /* Device Notch & Status Bar (Simulated Mobile OS) */
  }
        <div className="pt-2 px-6 pb-2 flex items-center justify-between text-slate-800 dark:text-slate-200 text-xs font-semibold select-none shrink-0 border-b border-slate-200/50 dark:border-slate-800/40">
          <span>{currentTime}</span>

          {
    /* Dynamic Island / Camera Notch */
  }
          <div className="w-24 h-4 bg-slate-900 dark:bg-slate-800 rounded-full flex items-center justify-center gap-1.5 px-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] text-slate-300 font-mono tracking-tight">TrainTrack</span>
          </div>

          <div className="flex items-center gap-1 text-[11px]">
            <span>5G</span>
            <span>100%</span>
          </div>
        </div>

        {
    /* Mobile App Header */
  }
        <div className="px-4 py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/70 dark:border-slate-800/70 flex items-center justify-between shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 text-white font-black text-sm flex items-center justify-center shadow-md shadow-indigo-500/20">
              {currentUser.full_name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-xs font-extrabold text-slate-900 dark:text-white truncate max-w-[140px]">
                  {currentUser.full_name}
                </h2>
                <span className="px-1.5 py-0.2 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[9px] font-bold">
                  Trainee
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[150px]">
                {currentUser.department || "Enterprise Ops"}
              </p>
            </div>
          </div>

          {
    /* Live Google Sheets Status */
  }
          <div className="flex items-center gap-1.5">
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200/50">
              <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
              <span>Sheets Synced</span>
            </div>
          </div>
        </div>

        {
    /* Scrollable Mobile App Body */
  }
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-24">
          {
    /* TAB 1: TODAY / HOME */
  }
          {activeTab === "today" && <div className="space-y-4 animate-in fade-in duration-200">
              {
    /* Active Session Priority Card */
  }
              {activeTrainingToday && <div className="rounded-3xl p-4 bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 text-white shadow-xl relative overflow-hidden border border-indigo-800/30">
                  <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                    <QrCode className="w-28 h-28" />
                  </div>

                  <div className="relative z-10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 text-[10px] font-bold uppercase tracking-wider border border-indigo-400/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Today's Focus
                      </span>

                      {hasAttendedToday ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          Checked In
                        </span> : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                          <Clock className="w-3 h-3" />
                          Check-in Open
                        </span>}
                    </div>

                    <div>
                      <h3 className="text-base font-extrabold leading-snug">
                        {activeTrainingToday.title}
                      </h3>
                      <p className="text-[11px] text-indigo-200/80 mt-1 flex items-center gap-2">
                        <span>Trainer: {activeTrainingToday.trainer_name}</span>
                        <span>•</span>
                        <span>{activeTrainingToday.time}</span>
                      </p>
                    </div>

                    <div className="pt-2 flex items-center gap-2">
                      {!hasAttendedToday ? <button
    onClick={() => {
      setSelectedTrainingId(activeTrainingToday.id);
      setActiveTab("scan");
    }}
    className="flex-1 py-3 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all active:scale-95"
  >
                          <QrCode className="w-4 h-4" />
                          <span>Scan QR Token</span>
                        </button> : <button
    onClick={() => {
      const q = availableQuizzes[activeTrainingToday.id];
      if (q) startQuizSession(q);
      else setActiveTab("quiz");
    }}
    className="flex-1 py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
  >
                          <FileQuestion className="w-4 h-4" />
                          <span>Take 10-Q Quiz</span>
                        </button>}

                      <button
    onClick={() => setSelectedCourseDetail(activeTrainingToday)}
    className="p-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white transition-colors"
    title="View Course Details"
  >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>}

              {
    /* Trainee KPI Micro Stats Grid */
  }
              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center shadow-sm">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Attended</p>
                  <p className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {totalAttendedCount}
                  </p>
                  <span className="text-[9px] text-slate-500">Sessions</span>
                </div>
                <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center shadow-sm">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Avg Score</p>
                  <p className="text-base font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                    {avgScore}%
                  </p>
                  <span className="text-[9px] text-slate-500">Evaluation</span>
                </div>
                <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center shadow-sm">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Certified</p>
                  <p className="text-base font-black text-amber-600 dark:text-amber-400 mt-0.5">
                    {passedQuizzesCount}
                  </p>
                  <span className="text-[9px] text-slate-500">Badges</span>
                </div>
              </div>

              {
    /* Quick Actions Shortcuts */
  }
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white px-1">
                  <span>Quick Access</span>
                  <span className="text-[10px] text-slate-400 font-normal">Touch & Go</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
    onClick={() => setActiveTab("scan")}
    className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3 text-left hover:border-emerald-500 transition-all shadow-sm active:scale-98"
  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 font-bold">
                      <Camera className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">QR Scanner</p>
                      <p className="text-[10px] text-slate-400">Live 60s Check-in</p>
                    </div>
                  </button>

                  <button
    onClick={() => setActiveTab("quiz")}
    className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3 text-left hover:border-indigo-500 transition-all shadow-sm active:scale-98"
  >
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 font-bold">
                      <FileQuestion className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">Assessments</p>
                      <p className="text-[10px] text-slate-400">10-Question Tests</p>
                    </div>
                  </button>

                  <button
    onClick={() => setActiveTab("courses")}
    className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3 text-left hover:border-blue-500 transition-all shadow-sm active:scale-98"
  >
                    <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 font-bold">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">My Schedule</p>
                      <p className="text-[10px] text-slate-400">All Modules</p>
                    </div>
                  </button>

                  <button
    onClick={() => setActiveTab("passport")}
    className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3 text-left hover:border-amber-500 transition-all shadow-sm active:scale-98"
  >
                    <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 font-bold">
                      <Award className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">Passport</p>
                      <p className="text-[10px] text-slate-400">Digital Certificate</p>
                    </div>
                  </button>
                </div>
              </div>

              {
    /* Today's Agenda Feed */
  }
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white px-1">
                  <span>Enrolled Sessions</span>
                  <button
    onClick={() => setActiveTab("courses")}
    className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold"
  >
                    See all
                  </button>
                </div>

                <div className="space-y-2">
                  {trainings.slice(0, 3).map((tr) => {
    const isAtt = attendance.some((a) => a.training_id === tr.id);
    return <div
      key={tr.id}
      onClick={() => setSelectedCourseDetail(tr)}
      className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between cursor-pointer hover:border-indigo-400 transition-colors shadow-sm"
    >
                        <div className="flex items-center gap-3">
                          <div
      className={`w-2.5 h-10 rounded-full ${isAtt ? "bg-emerald-500" : "bg-amber-500"}`}
    />
                          <div>
                            <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                              {tr.title}
                            </p>
                            <p className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                              <span>{tr.time}</span>
                              <span>•</span>
                              <span>{tr.duration_minutes}m</span>
                              <span>•</span>
                              <span>{tr.trainer_name}</span>
                            </p>
                          </div>
                        </div>

                        {isAtt ? <span className="p-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600">
                            <Check className="w-4 h-4" />
                          </span> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                      </div>;
  })}
                </div>
              </div>
            </div>}

          {
    /* TAB 2: COURSES & SCHEDULE */
  }
          {activeTab === "courses" && <div className="space-y-3 animate-in fade-in duration-200">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Corporate Curriculum
                </h3>
                <p className="text-[11px] text-slate-400">
                  Track schedule, study slide materials, and verify attendance.
                </p>
              </div>

              {
    /* Search Bar */
  }
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
    type="text"
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    placeholder="Search trainings or trainers..."
    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
  />
              </div>

              {
    /* Segmented Filter Pills */
  }
              <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                {["all", "in_progress", "upcoming", "completed"].map((filter) => <button
    key={filter}
    onClick={() => setCourseFilter(filter)}
    className={`px-3 py-1.5 rounded-xl font-bold capitalize whitespace-nowrap text-[11px] transition-all ${courseFilter === filter ? "bg-indigo-600 text-white shadow-sm" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"}`}
  >
                    {filter.replace("_", " ")}
                  </button>)}
              </div>

              {
    /* Courses List */
  }
              <div className="space-y-2.5">
                {filteredTrainings.length === 0 ? <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-400">
                    No sessions match the selected filter.
                  </div> : filteredTrainings.map((tr) => {
    const isAtt = attendance.some((a) => a.training_id === tr.id);
    const quiz = availableQuizzes[tr.id];
    const pastAttempt = attempts.find((at) => at.training_id === tr.id);
    return <div
      key={tr.id}
      className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm"
    >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[9px] font-bold uppercase">
                                {tr.status}
                              </span>
                              {quiz && <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-[9px] font-bold">
                                  10-Q Quiz
                                </span>}
                            </div>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                              {tr.title}
                            </h4>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              Trainer: {tr.trainer_name}
                            </p>
                          </div>

                          {isAtt ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800 shrink-0">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              Attended
                            </span> : <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-semibold shrink-0">
                              Pending
                            </span>}
                        </div>

                        <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2">
                          {tr.description}
                        </p>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[10px] text-slate-400">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{tr.date} • {tr.time}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {!isAtt ? <button
      onClick={() => {
        setSelectedTrainingId(tr.id);
        setActiveTab("scan");
      }}
      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] flex items-center gap-1 shadow-sm"
    >
                                <QrCode className="w-3 h-3" />
                                <span>Check-in</span>
                              </button> : null}

                            {quiz && <button
      onClick={() => startQuizSession(quiz)}
      className={`px-3 py-1.5 rounded-xl font-bold text-[10px] flex items-center gap-1 ${pastAttempt ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300" : "bg-indigo-600 text-white shadow-sm"}`}
    >
                                <FileQuestion className="w-3 h-3" />
                                <span>{pastAttempt ? `Score: ${pastAttempt.score}/10` : "Quiz"}</span>
                              </button>}
                          </div>
                        </div>
                      </div>;
  })}
              </div>
            </div>}

          {
    /* TAB 3: SCAN QR (MOBILE CAMERA & INSTANT CHECK-IN) */
  }
          {activeTab === "scan" && <div className="space-y-4 animate-in fade-in duration-200">
              <div className="text-center space-y-1">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live 60-Second Rotating Token
                </span>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Trainee Session Check-In
                </h3>
                <p className="text-[11px] text-slate-500">
                  Point camera at the trainer's projection screen to verify attendance.
                </p>
              </div>

              {
    /* Target Training Selector */
  }
              <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Session to Check Into:
                </label>
                <select
    value={selectedTrainingId}
    onChange={(e) => setSelectedTrainingId(e.target.value)}
    className="w-full text-xs font-bold rounded-xl p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
  >
                  {trainings.map((t) => <option key={t.id} value={t.id}>
                      {t.title} ({t.status})
                    </option>)}
                </select>
              </div>

              {
    /* High-Tech Camera HUD / Viewfinder */
  }
              <div className="rounded-3xl overflow-hidden bg-slate-950 text-white border border-slate-800 shadow-2xl relative">
                <div className="h-64 flex flex-col items-center justify-center relative">
                  {
    /* Real Scanner Container */
  }
                  <div
    id="mobile-qr-reader"
    className={`w-full h-full object-cover ${cameraActive ? "block" : "hidden"}`}
  />

                  {!cameraActive && <div className="text-center p-6 space-y-3">
                      <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
                        <Camera className="w-8 h-8" />
                      </div>
                      <p className="text-xs text-slate-300 font-medium">
                        Camera preview ready. Tap below to activate your phone camera.
                      </p>
                      <button
    onClick={startCamera}
    className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black shadow-lg shadow-emerald-500/30 transition-all active:scale-95"
  >
                        Launch Camera Viewfinder
                      </button>
                    </div>}

                  {cameraActive && <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                      {
    /* Viewfinder Reticle */
  }
                      <div className="w-48 h-48 border-2 border-dashed border-emerald-400 rounded-3xl relative animate-pulse">
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-400 -mt-1 -ml-1 rounded-tl-lg" />
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-400 -mt-1 -mr-1 rounded-tr-lg" />
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-400 -mb-1 -ml-1 rounded-bl-lg" />
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-400 -mb-1 -mr-1 rounded-br-lg" />
                        {
    /* Animated Laser Bar */
  }
                        <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#10b981] animate-bounce" />
                      </div>
                      <p className="text-[10px] text-emerald-300 font-mono mt-3 bg-black/60 px-2 py-0.5 rounded-full">
                        Align QR code within reticle
                      </p>
                    </div>}
                </div>

                {cameraActive && <div className="p-3 bg-slate-900 border-t border-slate-800 flex justify-between items-center text-xs">
                    <span className="text-emerald-400 text-[11px] font-mono flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      Scanner Active
                    </span>
                    <button
    onClick={stopCamera}
    className="px-3 py-1 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 font-bold text-[11px]"
  >
                      Stop Camera
                    </button>
                  </div>}
              </div>

              {
    /* Instant Simulation Action (Convenience for testing without projector) */
  }
              <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                    Quick Simulation Scan
                  </p>
                  <p className="text-[10px] text-indigo-700/80 dark:text-indigo-300/80">
                    Testing on mobile or single screen? Check in instantly.
                  </p>
                </div>
                <button
    onClick={handleSimulateScan}
    disabled={isProcessingAttendance}
    className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-[11px] shadow-sm shrink-0 flex items-center gap-1"
  >
                  <Zap className="w-3 h-3 text-amber-300" />
                  <span>{isProcessingAttendance ? "Checking..." : "Instant Check-in"}</span>
                </button>
              </div>

              {
    /* Manual Token Fallback */
  }
              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Or enter 60-Second Token Code Manually:
                </label>
                <div className="flex gap-2">
                  <input
    type="text"
    value={manualToken}
    onChange={(e) => setManualToken(e.target.value)}
    placeholder="e.g. tt-training-sec-101-..."
    className="flex-1 text-xs rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
  />
                  <button
    onClick={() => handleVerifyAttendance(manualToken)}
    disabled={isProcessingAttendance}
    className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-extrabold shadow-sm active:scale-95"
  >
                    Submit
                  </button>
                </div>
              </div>

              {
    /* Attendance Confirmation Notice */
  }
              {attendanceSuccess && <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 space-y-2 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span className="text-xs font-bold">{attendanceSuccess}</span>
                  </div>
                  <button
    onClick={() => {
      const q = availableQuizzes[selectedTrainingId];
      if (q) startQuizSession(q);
      else setActiveTab("quiz");
    }}
    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md flex items-center justify-center gap-1.5"
  >
                    <span>Proceed to 10-Question Evaluation</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>}
            </div>}

          {
    /* TAB 4: QUIZZES & ASSESSMENTS */
  }
          {activeTab === "quiz" && <div className="space-y-4 animate-in fade-in duration-200">
              {!activeQuiz ? (
    /* Quizzes Overview List */
    <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      10-Question Knowledge Tests
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Evaluates corporate learning comprehension. Score 70% or above to certify.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {Object.values(availableQuizzes).length === 0 ? <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-400">
                        No active quizzes published for enrolled trainings yet.
                      </div> : Object.values(availableQuizzes).map((q) => {
      const tr = trainings.find((t) => t.id === q.training_id);
      const isAtt = attendance.some((a) => a.training_id === q.training_id);
      const attempt = attempts.find((at) => at.quiz_id === q.id);
      return <div
        key={q.id}
        className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm"
      >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[9px] font-bold uppercase">
                                  {q.difficulty} Difficulty
                                </span>
                                <h4 className="text-xs font-bold text-slate-900 dark:text-white mt-1">
                                  {q.title}
                                </h4>
                                <p className="text-[10px] text-slate-400">
                                  {tr?.title || "Corporate Training"}
                                </p>
                              </div>

                              {attempt ? <div className="text-right">
                                  <p
        className={`text-xs font-black ${attempt.percentage >= 70 ? "text-emerald-500" : "text-amber-500"}`}
      >
                                    {attempt.score} / 10
                                  </p>
                                  <span className="text-[9px] font-bold text-slate-400">
                                    {attempt.percentage}% {attempt.percentage >= 70 ? "Passed" : "Needs Review"}
                                  </span>
                                </div> : <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-[9px] font-bold">
                                  Unattempted
                                </span>}
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>{q.time_limit_minutes || 10} Mins</span>
                              </span>

                              <button
        onClick={() => startQuizSession(q)}
        className={`px-3 py-1.5 rounded-xl font-bold text-[10px] flex items-center gap-1 ${attempt ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200" : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm"}`}
      >
                                <FileQuestion className="w-3 h-3" />
                                <span>{attempt ? "Retake / Review" : "Start Assessment"}</span>
                              </button>
                            </div>
                          </div>;
    })}
                  </div>
                </div>
  ) : isQuizSubmitted && quizResultAttempt ? (
    /* In-App Quiz Results Screen */
    <div className="space-y-4 text-center py-2 animate-in zoom-in-95 duration-200">
                  <div
      className={`w-20 h-20 rounded-3xl mx-auto flex items-center justify-center text-3xl shadow-xl ${quizResultAttempt.percentage >= 70 ? "bg-emerald-500 text-white shadow-emerald-500/30" : "bg-amber-500 text-white shadow-amber-500/30"}`}
    >
                    {quizResultAttempt.percentage >= 70 ? "\u{1F3C6}" : "\u{1F4DA}"}
                  </div>

                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      {quizResultAttempt.percentage >= 70 ? "Congratulations! Passed" : "Assessment Completed"}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Your score has been logged to the company Google Sheets record.
                    </p>
                  </div>

                  {
      /* Score Hero */
    }
                  <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm inline-block w-full">
                    <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
                      {quizResultAttempt.score} / {quizResultAttempt.total_questions}
                    </p>
                    <p className="text-xs font-bold text-slate-400 mt-1">
                      {quizResultAttempt.percentage}% Final Grade
                    </p>
                  </div>

                  {
      /* Buttons */
    }
                  <div className="space-y-2 pt-2">
                    {quizResultAttempt.percentage >= 70 && <button
      onClick={() => {
        setShowCertificateModal(quizResultAttempt);
      }}
      className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/25 transition-all"
    >
                        <Award className="w-4 h-4" />
                        <span>View Verified Certificate</span>
                      </button>}

                    <button
      onClick={() => {
        setActiveQuiz(null);
        setIsQuizSubmitted(false);
        setActiveTab("today");
      }}
      className="w-full py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-black text-xs transition-all"
    >
                      Return to Dashboard
                    </button>
                  </div>
                </div>
  ) : (
    /* Active In-App Quiz Question View */
    <div className="space-y-4">
                  {
      /* Quiz Header Bar */
    }
                  <div className="flex items-center justify-between">
                    <button
      onClick={() => setActiveQuiz(null)}
      className="text-xs text-slate-400 hover:text-slate-600 font-semibold"
    >
                      ✕ Exit
                    </button>
                    <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-mono text-[11px] font-bold">
                      <Clock className="w-3 h-3" />
                      <span>
                        {Math.floor(quizTimer / 60)}:
                        {(quizTimer % 60).toString().padStart(2, "0")}
                      </span>
                    </div>
                  </div>

                  {
      /* Progress Line */
    }
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase">
                      <span>Question {currentQIndex + 1} of {activeQuiz.questions.length}</span>
                      <span>
                        {Math.round((currentQIndex + 1) / activeQuiz.questions.length * 100)}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div
      className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-300"
      style={{
        width: `${(currentQIndex + 1) / activeQuiz.questions.length * 100}%`
      }}
    />
                    </div>
                  </div>

                  {
      /* Question Card */
    }
                  {activeQuiz.questions[currentQIndex] && <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                      <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-snug">
                        {activeQuiz.questions[currentQIndex].question_text}
                      </p>

                      {
      /* 4 Touch-Optimized Options */
    }
                      <div className="space-y-2">
                        {activeQuiz.questions[currentQIndex].options.map((option, optIdx) => {
      const currentQId = activeQuiz.questions[currentQIndex].id;
      const isSelected = selectedAnswers[currentQId] === optIdx;
      return <button
        key={optIdx}
        onClick={() => setSelectedAnswers((prev) => ({
          ...prev,
          [currentQId]: optIdx
        }))}
        className={`w-full p-3 rounded-2xl text-left text-xs font-semibold flex items-start gap-2.5 transition-all active:scale-98 ${isSelected ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25 border-indigo-600" : "bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/60"}`}
      >
                              <span
        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${isSelected ? "bg-white text-indigo-600" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}
      >
                                {["A", "B", "C", "D"][optIdx]}
                              </span>
                              <span className="leading-snug">{option}</span>
                            </button>;
    })}
                      </div>
                    </div>}

                  {
      /* Navigation Controls */
    }
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
      onClick={() => setCurrentQIndex((prev) => Math.max(0, prev - 1))}
      disabled={currentQIndex === 0}
      className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 disabled:opacity-40 text-slate-700 dark:text-slate-300 text-xs font-bold"
    >
                      Previous
                    </button>

                    {currentQIndex < activeQuiz.questions.length - 1 ? <button
      onClick={() => setCurrentQIndex((prev) => prev + 1)}
      className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-md"
    >
                        Next Question
                      </button> : <button
      onClick={() => submitQuizAnswers(false)}
      className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md"
    >
                        Submit 10-Q Test
                      </button>}
                  </div>
                </div>
  )}
            </div>}

          {
    /* TAB 5: PASSPORT & CERTIFICATES */
  }
          {activeTab === "passport" && <div className="space-y-4 animate-in fade-in duration-200">
              {
    /* Official Corporate Digital Badge */
  }
              <div className="rounded-3xl p-5 bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-900 text-white border border-indigo-500/20 shadow-xl relative overflow-hidden space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono tracking-widest text-indigo-300 uppercase">
                    TRAINTRACK PASSPORT
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-xl shadow-lg">
                    {currentUser.full_name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-sm font-black">{currentUser.full_name}</h3>
                    <p className="text-[11px] text-slate-300">{currentUser.email}</p>
                    <p className="text-[10px] text-indigo-300 mt-0.5">
                      ID: TT-{currentUser.id.slice(0, 8).toUpperCase()}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10 grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <p className="text-slate-400">Department</p>
                    <p className="font-bold text-white">{currentUser.department || "Operations"}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Verification Ledger</p>
                    <p className="font-bold text-emerald-300 flex items-center gap-1">
                      <FileSpreadsheet className="w-3 h-3" />
                      Google Sheets
                    </p>
                  </div>
                </div>
              </div>

              {
    /* Earned Certificates List */
  }
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white px-1">
                  <span>Earned Certifications</span>
                  <span className="text-[10px] text-slate-400">{passedQuizzesCount} Verified</span>
                </div>

                {attempts.filter((a) => a.percentage >= 70).length === 0 ? <div className="p-6 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-400">
                    Complete your first 10-question evaluation with 70%+ to unlock your verified certificate.
                  </div> : attempts.filter((a) => a.percentage >= 70).map((att) => <div
    key={att.id}
    onClick={() => setShowCertificateModal(att)}
    className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between cursor-pointer hover:border-amber-400 transition-colors shadow-sm"
  >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                            <Award className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900 dark:text-white">
                              Certificate #{att.id.slice(-4).toUpperCase()}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              Grade: {att.percentage}% • {new Date(att.completed_at || att.started_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <span className="px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[10px] font-black border border-amber-200 dark:border-amber-800">
                          View
                        </span>
                      </div>)}
              </div>

              {
    /* Data & Compliance Guarantee */
  }
              <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 text-[11px] space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                  <Shield className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Verified Corporate Record</span>
                </div>
                <p className="leading-snug text-[10px]">
                  All check-ins and test scores are cryptographically bound and backed up to the enterprise Google Sheets master database.
                </p>
              </div>
            </div>}
        </div>

        {
    /* Persistent Bottom Mobile Navigation Bar */
  }
        <div className="absolute bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border-t border-slate-200/80 dark:border-slate-800/80 px-2 py-1.5 z-40">
          <div className="grid grid-cols-5 items-center">
            {
    /* Tab: Today */
  }
            <button
    onClick={() => setActiveTab("today")}
    className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${activeTab === "today" ? "text-indigo-600 dark:text-indigo-400 font-bold" : "text-slate-400 hover:text-slate-600"}`}
  >
              <Calendar className="w-4 h-4" />
              <span className="text-[9px] mt-0.5">Today</span>
            </button>

            {
    /* Tab: Courses */
  }
            <button
    onClick={() => setActiveTab("courses")}
    className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${activeTab === "courses" ? "text-indigo-600 dark:text-indigo-400 font-bold" : "text-slate-400 hover:text-slate-600"}`}
  >
              <BookOpen className="w-4 h-4" />
              <span className="text-[9px] mt-0.5">Courses</span>
            </button>

            {
    /* Tab: Scan (Elevated Primary Center Button) */
  }
            <div className="flex justify-center -mt-5">
              <button
    onClick={() => setActiveTab("scan")}
    className="w-12 h-12 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/35 border-2 border-white dark:border-slate-900 hover:scale-105 active:scale-95 transition-all"
    title="Open Live QR Scanner"
  >
                <QrCode className="w-5 h-5" />
              </button>
            </div>

            {
    /* Tab: Quiz */
  }
            <button
    onClick={() => setActiveTab("quiz")}
    className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${activeTab === "quiz" ? "text-indigo-600 dark:text-indigo-400 font-bold" : "text-slate-400 hover:text-slate-600"}`}
  >
              <FileQuestion className="w-4 h-4" />
              <span className="text-[9px] mt-0.5">Quiz</span>
            </button>

            {
    /* Tab: Passport */
  }
            <button
    onClick={() => setActiveTab("passport")}
    className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${activeTab === "passport" ? "text-indigo-600 dark:text-indigo-400 font-bold" : "text-slate-400 hover:text-slate-600"}`}
  >
              <Award className="w-4 h-4" />
              <span className="text-[9px] mt-0.5">Badges</span>
            </button>
          </div>
        </div>

        {
    /* Mobile Home Indicator (iOS Bar aesthetic) */
  }
        {viewMode === "device" && <div className="w-32 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto my-1 absolute bottom-0.5 left-1/2 -translate-x-1/2 pointer-events-none" />}
      </div>

      {/* Course Detail Modal Sheet */}
      {selectedCourseDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-200 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[9px] font-bold uppercase">
                  {selectedCourseDetail.status}
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                  {selectedCourseDetail.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedCourseDetail(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {selectedCourseDetail.description}
            </p>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                <span>Date: {selectedCourseDetail.date} at {selectedCourseDetail.time}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                <span>Location: {selectedCourseDetail.location || "Corporate Auditorium & Google Meet"}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <User className="w-3.5 h-3.5 text-indigo-500" />
                <span>Instructor: {selectedCourseDetail.trainer_name}</span>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                onClick={() => {
                  setSelectedTrainingId(selectedCourseDetail.id);
                  setSelectedCourseDetail(null);
                  setActiveTab("scan");
                }}
                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
              >
                <QrCode className="w-4 h-4" />
                <span>Check-in QR</span>
              </button>

              <button
                onClick={() => {
                  const q = availableQuizzes[selectedCourseDetail.id];
                  setSelectedCourseDetail(null);
                  if (q) startQuizSession(q);
                  else setActiveTab("quiz");
                }}
                className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
              >
                <FileQuestion className="w-4 h-4" />
                <span>Take Quiz</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verified Certificate Modal */}
      {showCertificateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xl text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-600 mx-auto flex items-center justify-center shadow-inner">
              <Award className="w-8 h-8" />
            </div>

            <div>
              <span className="text-[10px] font-mono tracking-widest text-amber-600 dark:text-amber-400 uppercase font-black">
                OFFICIAL CERTIFICATE
              </span>
              <h3 className="text-base font-black text-slate-900 dark:text-white mt-1">
                Certificate of Competency
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">
                Issued to <span className="font-bold text-slate-800 dark:text-slate-200">{currentUser.full_name}</span>
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/60 text-xs text-slate-700 dark:text-slate-300 space-y-1 text-left">
              <p><span className="font-bold">Score:</span> {showCertificateModal.score}/10 ({showCertificateModal.percentage}%)</p>
              <p><span className="font-bold">Credential:</span> TT-CERT-{showCertificateModal.id.slice(-6).toUpperCase()}</p>
              <p><span className="font-bold">Verified:</span> Synchronized to Supabase Database</p>
            </div>

            <button
              onClick={() => {
                showToast("Certificate saved to device photo roll", "success");
                setShowCertificateModal(null);
              }}
              className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-black text-xs cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
