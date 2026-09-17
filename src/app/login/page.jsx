"use client";
import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { supabaseService } from '@/lib/services/supabaseService';
import {
  Sparkles,
  Mail,
  Lock,
  LogIn,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';

export default function LoginPage() {
  const { setCurrentUser, showToast, navigate } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState(null);
  const [resendSuccess, setResendSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      showToast('Please enter both work email and password', 'error');
      return;
    }
    setLoading(true);
    setUnconfirmedEmail(null);
    setResendSuccess(false);

    try {
      const user = await supabaseService.login(email.trim(), password);
      setCurrentUser(user);
      showToast(`Welcome back, ${user.full_name || user.name || 'User'}!`, 'success');
      
      // Route user to their relative dashboard
      if (user.role === 'trainer') {
        navigate('/trainer/trainings');
      } else if (user.role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/trainee/dashboard');
      }
    } catch (err) {
      if (err?.isEmailUnconfirmed) {
        setUnconfirmedEmail(email.trim());
        showToast(err.message, 'warning');
      } else {
        showToast(err?.message || 'Invalid email or password. Please check your credentials.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!unconfirmedEmail) return;
    setResending(true);
    try {
      await supabaseService.resendVerificationEmail(unconfirmedEmail);
      setResendSuccess(true);
      showToast(`Verification link resent to ${unconfirmedEmail}. Please check your inbox.`, 'success');
    } catch (err) {
      showToast(err?.message || 'Could not resend verification email.', 'error');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 px-4">
      <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Sign In to BSource Training
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Enter your verified email and password to access your role dashboard.
          </p>
        </div>

        {/* Unconfirmed Email Verification Alert */}
        {unconfirmedEmail && (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 space-y-2 text-xs text-amber-900 dark:text-amber-200 animate-in fade-in duration-200">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Email Verification Required</p>
                <p className="text-amber-700 dark:text-amber-300">
                  A verification link was sent to <span className="font-semibold">{unconfirmedEmail}</span>. Please verify your email before logging in.
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              {resendSuccess ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Link resent! Check inbox.
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resending}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${resending ? 'animate-spin' : ''}`} />
                  <span>{resending ? 'Resending...' : 'Resend Verification Email'}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Real Email & Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Work Email Address
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

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white transition-all shadow-xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="text-center pt-2 text-xs text-slate-500 dark:text-slate-400">
          Don't have an enterprise account?{' '}
          <button
            onClick={() => navigate('/signup')}
            className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
          >
            Create one here
          </button>
        </div>
      </div>
    </div>
  );
}
