import React, { useState } from 'react';
import { 
  GraduationCap, 
  Sparkles, 
  Mail, 
  Lock, 
  User, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  ShieldCheck,
  Moon,
  Sun,
  Database,
  Bell
} from 'lucide-react';
import { 
  signUpUser, 
  signInUser, 
  resetPasswordForEmail,
  isSupabaseConfigured,
  saveSupabaseCredentials,
  getSupabaseCredentials
} from '../services/supabase';
import { promptPushSubscription, isPushSubscribed } from '../services/notifications';

export default function AuthScreen({ onAuthSuccess, theme, onToggleTheme }) {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [notifState, setNotifState] = useState(() => (isPushSubscribed() ? 'subscribed' : 'idle'));

  const handlePromptNotifications = async () => {
    setNotifState('prompting');
    try {
      const res = await promptPushSubscription();
      if (res?.granted && (res?.subscriptionId || res?.optedIn)) {
        setNotifState('subscribed');
      } else {
        setNotifState('idle');
      }
    } catch (err) {
      console.warn('OneSignal prompt error in AuthScreen:', err);
      setNotifState('idle');
    }
  };

  // Project Config Modal State (if user hasn't set env vars yet)
  const [showConfigModal, setShowConfigModal] = useState(!isSupabaseConfigured());
  const creds = getSupabaseCredentials();
  const [configUrl, setConfigUrl] = useState(creds.url);
  const [configAnonKey, setConfigAnonKey] = useState(creds.anonKey);
  const [configSaved, setConfigSaved] = useState(false);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setInfoMessage('');

    if (!isSupabaseConfigured()) {
      setShowConfigModal(true);
      setErrorMessage('Please enter your Supabase Project URL and Anon Key to enable live authentication.');
      return;
    }

    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    if (mode === 'forgot') {
      setIsLoading(true);
      try {
        await resetPasswordForEmail(email.trim());
        setInfoMessage('Password reset link sent! Please check your email inbox.');
      } catch (err) {
        console.error('[NoticeIQ Reset Password Error]:', err);
        setErrorMessage(err.message || 'Failed to send password reset email. Please try again.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (!password.trim()) {
      setErrorMessage('Please enter your password.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);

    try {
      if (mode === 'signup') {
        const data = await signUpUser({
          email: email.trim(),
          password,
          fullName: fullName.trim() || 'Student'
        });

        // Supabase sends a confirmation email if email confirmation is turned on
        if (data?.user && !data?.session) {
          setInfoMessage('Account created! Please check your email to confirm your account or sign in.');
          setMode('signin');
        } else if (data?.session) {
          if (onAuthSuccess) onAuthSuccess(data.session);
        }
      } else {
        const data = await signInUser({
          email: email.trim(),
          password
        });

        if (data?.session) {
          if (onAuthSuccess) onAuthSuccess(data.session);
        }
      }
    } catch (err) {
      console.error('[NoticeIQ Auth Error]:', err);
      let userFriendlyMsg = err.message || 'Authentication failed. Please check your credentials.';
      if (userFriendlyMsg.toLowerCase().includes('invalid login credentials')) {
        userFriendlyMsg = 'Invalid email or password. If you are new here, please create an account.';
      } else if (userFriendlyMsg.toLowerCase().includes('user already registered')) {
        userFriendlyMsg = 'An account with this email already exists. Please sign in instead.';
      }
      setErrorMessage(userFriendlyMsg);
    } finally {
      setIsLoading(false);
    }
  };


  const handleSaveConfig = (e) => {
    e.preventDefault();
    if (!configUrl.trim() || !configAnonKey.trim()) {
      setErrorMessage('Both Supabase URL and Anon Key are required.');
      return;
    }
    saveSupabaseCredentials(configUrl.trim(), configAnonKey.trim());
    setConfigSaved(true);
    setTimeout(() => {
      window.location.reload();
    }, 400);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-slate-900 dark:text-[#e6edf2] flex flex-col justify-between p-4 sm:p-6 md:p-8 font-sans transition-colors relative overflow-hidden">
      {/* Background Decorative Ambient Glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-[var(--accent-primary)]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar: Brand & Theme Toggle */}
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[var(--accent-primary)] flex items-center justify-center text-white shadow-2xs">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-xl tracking-tight text-slate-900 dark:text-[#e6edf2]">NoticeIQ</span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[var(--accent-badge-bg)] text-[var(--accent-badge-text)] border border-[var(--accent-light-border)]">
              AI
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Supabase Connection Status Button */}
          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-[#1b262d] border border-slate-200/70 dark:border-[#23333d] text-xs font-semibold text-slate-600 dark:text-[#8e9fa8] hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)] transition-all cursor-pointer shadow-2xs"
            title="Configure Supabase Connection"
          >
            <Database className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span className="hidden sm:inline">Supabase</span>
            <span className={`w-2 h-2 rounded-full ${isSupabaseConfigured() ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
          </button>

          {/* Theme Toggle Button */}
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              className="p-2 rounded-full bg-white dark:bg-[#1b262d] border border-slate-200/70 dark:border-[#23333d] text-slate-600 dark:text-[#8e9fa8] hover:text-[var(--accent-primary)] transition-all cursor-pointer shadow-2xs"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>
          )}
        </div>
      </header>

      {/* Main Form Center Card */}
      <main className="flex-1 flex items-center justify-center my-8 z-10">
        <div className="w-full max-w-md bg-white dark:bg-[#1b262d] border border-slate-200/70 dark:border-[#23333d] rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-900/5 dark:shadow-black/20 space-y-6 animate-fade-in">
          
          {/* Hero Heading */}
          <div className="text-center space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--accent-light)] border border-[var(--accent-light-border)] text-xs font-bold text-[var(--accent-text)] mb-2 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Campus Intelligence Platform</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-[#e6edf2]">
              {mode === 'signin' ? 'Welcome Back' : mode === 'signup' ? 'Create Your Account' : 'Reset Your Password'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-[#8e9fa8] font-medium">
              {mode === 'signin'
                ? 'Sign in to access your synchronized campus deadlines and documents'
                : mode === 'signup'
                ? 'Join NoticeIQ to track college circulars with instant AI extraction'
                : 'Enter your registered email to receive a secure password reset link'}
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-[#141f26] rounded-2xl border border-slate-200/60 dark:border-[#23333d]">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setErrorMessage('');
                setInfoMessage('');
              }}
              className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                mode === 'signin'
                  ? 'bg-white dark:bg-[#1b262d] text-slate-900 dark:text-[#e6edf2] shadow-2xs'
                  : 'text-slate-500 dark:text-[#8e9fa8] hover:text-slate-900 dark:hover:text-[#e6edf2]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMessage('');
                setInfoMessage('');
              }}
              className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                mode === 'signup'
                  ? 'bg-white dark:bg-[#1b262d] text-slate-900 dark:text-[#e6edf2] shadow-2xs'
                  : 'text-slate-500 dark:text-[#8e9fa8] hover:text-slate-900 dark:hover:text-[#e6edf2]'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-300 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <div className="font-medium leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* Success Banner */}
          {infoMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-300 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              <div className="font-medium leading-relaxed">{infoMessage}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Full Name
                </label>
                <div className="relative flex items-center">
                  <User className="w-4 h-4 absolute left-3.5 text-slate-400 dark:text-[#8e9fa8]" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Riddhi Verma"
                    className="w-full pl-10 pr-4 py-2.5 text-xs rounded-2xl bg-slate-50 dark:bg-[#141f26] border border-slate-200/80 dark:border-[#23333d] text-slate-900 dark:text-[#e6edf2] placeholder-slate-400 dark:placeholder-[#8e9fa8]/60 focus:outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-ring)] transition-all"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Email Address
              </label>
              <div className="relative flex items-center">
                <Mail className="w-4 h-4 absolute left-3.5 text-slate-400 dark:text-[#8e9fa8]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@college.edu"
                  className="w-full pl-10 pr-4 py-2.5 text-xs rounded-2xl bg-slate-50 dark:bg-[#141f26] border border-slate-200/80 dark:border-[#23333d] text-slate-900 dark:text-[#e6edf2] placeholder-slate-400 dark:placeholder-[#8e9fa8]/60 focus:outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-ring)] transition-all"
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Password
                  </label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setErrorMessage('');
                        setInfoMessage('');
                      }}
                      className="text-[11px] text-[var(--accent-primary)] hover:underline cursor-pointer font-semibold bg-transparent border-0 p-0"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 absolute left-3.5 text-slate-400 dark:text-[#8e9fa8]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 text-xs rounded-2xl bg-slate-50 dark:bg-[#141f26] border border-slate-200/80 dark:border-[#23333d] text-slate-900 dark:text-[#e6edf2] placeholder-slate-400 dark:placeholder-[#8e9fa8]/60 focus:outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-ring)] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 rounded-2xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-black shadow-md shadow-[var(--accent-shadow)] flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>
                    {mode === 'signin'
                      ? 'Sign In to NoticeIQ'
                      : mode === 'signup'
                      ? 'Create Student Account'
                      : 'Send Password Reset Link'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setErrorMessage('');
                  setInfoMessage('');
                }}
                className="w-full py-2 text-center text-xs font-semibold text-slate-500 dark:text-[#8e9fa8] hover:text-[var(--accent-primary)] transition-colors cursor-pointer"
              >
                &larr; Back to Sign In
              </button>
            )}

            {/* Instant Demo Access Button */}
            <button
              type="button"
              onClick={() => {
                if (onAuthSuccess) {
                  onAuthSuccess({
                    user: {
                      id: 'demo-student-id',
                      email: 'riddhi@college.edu',
                      user_metadata: { full_name: 'Riddhi Verma' }
                    }
                  });
                }
              }}
              className="w-full py-2 px-3 rounded-xl border border-slate-200/80 dark:border-[#23333d] hover:border-[var(--accent-primary)] hover:bg-[var(--accent-light)] text-slate-600 dark:text-[#8e9fa8] hover:text-[var(--accent-text)] text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>Explore in Demo Mode (1-Click Instant Access)</span>
            </button>

            {/* Manual OneSignal Enable Notifications Trigger Button */}
            <button
              id="auth-enable-notifications-btn"
              type="button"
              onClick={handlePromptNotifications}
              disabled={notifState === 'prompting'}
              className="w-full py-2 px-3 rounded-xl border border-teal-200/80 dark:border-teal-800/80 bg-teal-50/60 dark:bg-teal-950/40 hover:bg-teal-100/80 dark:hover:bg-teal-900/50 text-teal-800 dark:text-teal-300 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-[0.99] disabled:opacity-60"
            >
              <Bell className={`w-3.5 h-3.5 text-teal-600 dark:text-teal-400 ${notifState === 'prompting' ? 'animate-bounce' : ''}`} />
              <span>
                {notifState === 'subscribed'
                  ? 'Notifications Active'
                  : notifState === 'prompting'
                  ? 'Requesting Permission...'
                  : 'Enable Notifications'}
              </span>
            </button>
          </form>

          {/* Privacy & RLS note */}
          <div className="pt-2 border-t border-slate-100 dark:border-[#23333d] flex items-center justify-center gap-2 text-[11px] text-slate-400 dark:text-[#8e9fa8] font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>Row Level Security (RLS) encrypted per student account</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-400 dark:text-[#8e9fa8] z-10">
        NoticeIQ &copy; {new Date().getFullYear()} &bull; Campus Intelligence System
      </footer>

      {/* Supabase Credentials Setup Modal (if not configured or user clicked status) */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-[#1b262d] border border-slate-200/80 dark:border-[#23333d] rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 animate-popover">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#23333d]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[var(--accent-light)] text-[var(--accent-primary)] flex items-center justify-center border border-[var(--accent-light-border)]">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-[#e6edf2]">
                    Supabase Project Setup
                  </h2>
                  <p className="text-[11px] text-slate-400 dark:text-[#8e9fa8]">
                    Connect your NoticeIQ database & auth
                  </p>
                </div>
              </div>
              {isSupabaseConfigured() && (
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            <p className="text-xs text-slate-600 dark:text-[#8e9fa8] leading-relaxed">
              NoticeIQ requires your Supabase Project URL and Anon Public Key to store tasks, vault credentials, and authenticate users. You can find these in your{' '}
              <a 
                href="https://supabase.com/dashboard" 
                target="_blank" 
                rel="noreferrer"
                className="text-[var(--accent-primary)] font-bold hover:underline"
              >
                Supabase Dashboard &rarr; Project Settings &rarr; API
              </a>.
            </p>

            <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700 dark:text-slate-300">
                  Project URL
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://xyzcompany.supabase.co"
                  value={configUrl}
                  onChange={(e) => setConfigUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#141f26] border border-slate-200 dark:border-[#23333d] text-slate-900 dark:text-[#e6edf2] focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700 dark:text-slate-300">
                  Anon / Public Key
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={configAnonKey}
                  onChange={(e) => setConfigAnonKey(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#141f26] border border-slate-200 dark:border-[#23333d] text-slate-900 dark:text-[#e6edf2] font-mono text-[11px] focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                {isSupabaseConfigured() && (
                  <button
                    type="button"
                    onClick={() => setShowConfigModal(false)}
                    className="px-4 py-2 rounded-xl text-slate-500 dark:text-[#8e9fa8] hover:bg-slate-100 dark:hover:bg-[#141f26] font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white font-bold cursor-pointer shadow-2xs"
                >
                  {configSaved ? 'Saved! Reloading...' : 'Save & Connect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
