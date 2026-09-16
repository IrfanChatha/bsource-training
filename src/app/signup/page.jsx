"use client";
import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { supabaseService } from '@/lib/services/supabaseService';
import {
  Sparkles,
  Mail,
  Lock,
  User,
  Building,
  GraduationCap,
  UserCheck,
  Shield,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  QrCode,
  FileQuestion,
  Award,
  Zap,
  BookOpen
} from 'lucide-react';

export default function SignUpPage() {
  const { setCurrentUser, showToast, navigate } = useApp();
  
  // Form State
  const [role, setRole] = useState('trainer'); // 'trainer' | 'trainee' | 'admin'
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [department, setDepartment] = useState('Learning & Development');
  const [specialty, setSpecialty] = useState('Cybersecurity & Operations');
  const [cohort, setCohort] = useState('2026 Enterprise Batch');
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [loading, setLoading] = useState(false);

  // Sync role from query string if available
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const queryRole = params.get('role');
      if (queryRole === 'trainee' || queryRole === 'trainer' || queryRole === 'admin') {
        setRole(queryRole);
      }
    }
  }, []);

  const [verificationSentForEmail, setVerificationSentForEmail] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !password) {
      showToast('Please fill in all required fields.', 'error');
      return;
    }

    if (password.length < 6) {
      showToast('Password must be at least 6 characters.', 'error');
      return;
    }

    if (password !== confirmPassword) {
      showToast('Passwords do not match. Please verify.', 'error');
      return;
    }

    if (!agreedToTerms) {
      showToast('Please agree to the enterprise data policies.', 'error');
      return;
    }

    setLoading(true);
    try {
      // Register with Supabase & update profile
      const user = await supabaseService.register(
        email.trim(),
        password,
        fullName.trim(),
        role,
        department
      );

      // Attach additional role metadata
      const enrichedUser = {
        ...user,
        role,
        department,
        full_name: fullName.trim(),
        name: fullName.trim(),
        specialty: role === 'trainer' ? specialty : undefined,
        cohort: role === 'trainee' ? cohort : undefined,
      };

      setCurrentUser(enrichedUser);
      supabaseService.setCurrentUser(enrichedUser);

      if (user.requiresVerification) {
        setVerificationSentForEmail(email.trim());
        showToast(`Verification link sent to ${email.trim()}! Please confirm your email.`, 'info');
        return;
      }

      showToast(
        `Welcome aboard, ${enrichedUser.full_name}! Account created as ${role.toUpperCase()}.`,
        'success'
      );

      // Immediate redirect to their relative dashboard
      if (role === 'trainer') {
        navigate('/trainer/trainings');
      } else if (role === 'trainee') {
        navigate('/trainee/dashboard');
      } else if (role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/trainee/dashboard');
      }
    } catch (err) {
      showToast(err?.message || 'Registration failed. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-6rem)] py-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/80 text-indigo-700 dark:text-indigo-300 text-xs font-bold tracking-wide">
          <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
          <span>Join TrainTrack AI Enterprise Portal</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
          Create Your Account
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          Select your organization role below to get instantly routed to your dedicated dashboard with customized tools.
        </p>
      </div>

      {/* Main Registration Card / Verification Sent Screen */}
      {verificationSentForEmail ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl p-8 sm:p-12 text-center max-w-xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-600/20">
            <Mail className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">
              Check Your Inbox
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              We've dispatched an enterprise confirmation email to:
            </p>
            <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 py-1.5 px-3 rounded-xl inline-block border border-indigo-200/50">
              {verificationSentForEmail}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 pt-2">
              Click the link inside to verify your address, then sign in with your email and password.
            </p>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => navigate(`/login?role=${role}`)}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              Go to Sign In
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await supabaseService.resendVerificationEmail(verificationSentForEmail);
                  showToast('Verification email resent!', 'success');
                } catch {
                  showToast('Could not resend email. Please try again later.', 'error');
                }
              }}
              className="w-full sm:w-auto px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
            >
              Resend Email
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden">
        {/* Step 1: Role Selection Tabs */}
        <div className="p-6 sm:p-8 bg-slate-50/70 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              1. Choose Your Role
            </h2>
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
              Custom features activate per role
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Trainer Option Card */}
            <div
              onClick={() => setRole('trainer')}
              className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                role === 'trainer'
                  ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 shadow-lg shadow-indigo-600/10'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/60'
              }`}
            >
              {role === 'trainer' && (
                <span className="absolute top-3.5 right-3.5 w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </span>
              )}
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                      Corporate Trainer
                    </h3>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-indigo-100 dark:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300">
                      Instructor
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Lead training sessions, project rotating 60s dynamic attendance QR codes, upload slide decks, and generate 10-Q Gemini AI quizzes.
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
                <p className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5" />
                  Routes to: <span className="underline">/trainer/trainings</span> (Trainer Hub)
                </p>
              </div>
            </div>

            {/* Trainee Option Card */}
            <div
              onClick={() => setRole('trainee')}
              className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                role === 'trainee'
                  ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/40 shadow-lg shadow-emerald-600/10'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/60'
              }`}
            >
              {role === 'trainee' && (
                <span className="absolute top-3.5 right-3.5 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </span>
              )}
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                      Trainee / Participant
                    </h3>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-100 dark:bg-emerald-900/80 text-emerald-700 dark:text-emerald-300">
                      Attendee
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Check-in instantly using mobile camera QR scanner, take interactive 10-question evaluation quizzes, and track completion scores.
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
                <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5" />
                  Routes to: <span className="underline">/trainee/dashboard</span> (Trainee Portal)
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: Form Inputs */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          <div className="space-y-1">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              2. Profile & Enterprise Credentials
            </h2>
            <p className="text-xs text-slate-400">
              Fill in your corporate identity details.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Full Name *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={role === 'trainer' ? 'e.g. Dr. Jordan Hayes' : 'e.g. Alex Rivera'}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white transition-all shadow-xs"
                />
              </div>
            </div>

            {/* Email Address */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Work Email Address *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white transition-all shadow-xs"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Password (min 6 chars) *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white transition-all shadow-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Confirm Password *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white transition-all shadow-xs"
                />
              </div>
            </div>

            {/* Department */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Department / Division
              </label>
              <div className="relative">
                <Building className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white transition-all shadow-xs"
                >
                  <option value="Learning & Development">Learning & Development</option>
                  <option value="Engineering">Engineering & DevOps</option>
                  <option value="Global Security & Operations">Global Security & Operations</option>
                  <option value="Product Design & Management">Product Design & Management</option>
                  <option value="People & Culture">People & Culture</option>
                  <option value="Executive Governance">Executive Governance</option>
                  <option value="Sales & Customer Success">Sales & Customer Success</option>
                </select>
              </div>
            </div>

            {/* Role-Specific Field */}
            {role === 'trainer' ? (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Instruction Specialization
                </label>
                <div className="relative">
                  <Award className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    placeholder="e.g. Incident Response & SOC Operations"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white transition-all shadow-xs"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Cohort / Training Batch
                </label>
                <div className="relative">
                  <BookOpen className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={cohort}
                    onChange={(e) => setCohort(e.target.value)}
                    placeholder="e.g. Q3 2026 Engineering Cohort"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white transition-all shadow-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Terms Checkbox */}
          <div className="flex items-start gap-2.5 pt-2">
            <input
              type="checkbox"
              id="terms"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-1 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <label htmlFor="terms" className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed cursor-pointer">
              I agree to the TrainTrack AI security policy, attendance verification logging, and AI assessment grading terms.
            </label>
          </div>

          {/* Submit Action Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3.5 px-6 rounded-2xl text-white font-extrabold text-sm shadow-xl flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
              role === 'trainer'
                ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
                : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
            } disabled:opacity-50`}
          >
            {loading ? (
              <span>Creating Your {role.toUpperCase()} Account...</span>
            ) : (
              <>
                <span>Complete Sign Up & Go To {role === 'trainer' ? 'Trainer Hub' : 'Trainee Portal'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Card Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/70 border-t border-slate-200 dark:border-slate-800 text-center text-xs text-slate-600 dark:text-slate-400">
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
          >
            Sign in here
          </button>
        </div>
      </div>
      )}
    </div>
  );
}
