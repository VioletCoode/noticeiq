import React from 'react';
import { 
  IdCard, 
  LayoutDashboard, 
  ArrowRight, 
  ShieldCheck, 
  Sparkles,
  FileCheck,
  Calendar
} from 'lucide-react';
import DigitalStudentId from '../components/DigitalStudentId';

export default function CampusIdScreen({
  userName = 'Student',
  userEmail = '',
  onUpdateUserName,
  onNavigateToDashboard,
  onNavigateToCapture,
  onNavigateToVault,
  tasks = [],
  vaultDocs = []
}) {
  const activeTasks = tasks.filter((t) => !t.completed);
  const activeTaskCount = activeTasks.length;
  const verifiedDocCount = vaultDocs.length;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Top Banner / Navigation Shortcut to Notices & Tasks */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 md:p-5 rounded-3xl bg-gradient-to-r from-teal-500/10 via-[var(--accent-light)] to-emerald-500/10 border border-[var(--accent-light-border)] shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[var(--accent-primary)] text-white flex items-center justify-center shadow-2xs shrink-0">
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-[#e6edf2]">
                College Circulars & Tasks
              </h2>
              {activeTaskCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white shadow-2xs">
                  {activeTaskCount} Due
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 dark:text-[#8e9fa8] mt-0.5">
              {activeTaskCount > 0 
                ? `You have ${activeTaskCount} action item${activeTaskCount === 1 ? '' : 's'} requiring attention.`
                : 'All circulars and tasks are up to date.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onNavigateToDashboard}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-[var(--accent-primary)] hover:opacity-90 text-white font-bold text-xs shadow-2xs transition-all cursor-pointer active:scale-95 shrink-0"
          id="btn-goto-notices-dashboard"
          aria-label="Open Notices and Tasks Dashboard"
        >
          <span>Open Notices Dashboard</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Screen Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/60 dark:border-[#23333d]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[var(--accent-light)] text-[var(--accent-primary)] flex items-center justify-center shadow-2xs border border-[var(--accent-light-border)]">
            <IdCard className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-[#e6edf2] tracking-tight">
              Digital Campus ID
            </h1>
            <p className="text-xs text-slate-500 dark:text-[#8e9fa8] font-medium">
              Verified Student Identity, Live Verification QR, & Credentials
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/60 text-xs font-bold shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Verified Student</span>
          </span>
        </div>
      </div>

      {/* Digital Student ID Card Component */}
      <div className="pb-2">
        <DigitalStudentId
          userName={userName}
          userEmail={userEmail}
          onUpdateName={onUpdateUserName}
        />
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        <button
          type="button"
          onClick={onNavigateToDashboard}
          className="p-4 rounded-2xl bg-white dark:bg-[#1b262d] border border-slate-200/70 dark:border-[#23333d] hover:border-[var(--accent-primary)] text-left transition-all shadow-2xs group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-[var(--accent-primary)] flex items-center justify-center">
              <LayoutDashboard className="w-4 h-4" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[var(--accent-primary)] group-hover:translate-x-0.5 transition-all" />
          </div>
          <h3 className="text-xs font-bold text-slate-900 dark:text-[#e6edf2]">Notices & Tasks</h3>
          <p className="text-[11px] text-slate-500 dark:text-[#8e9fa8] mt-0.5">
            {activeTaskCount} active priority items
          </p>
        </button>

        <button
          type="button"
          onClick={onNavigateToCapture}
          className="p-4 rounded-2xl bg-white dark:bg-[#1b262d] border border-slate-200/70 dark:border-[#23333d] hover:border-[var(--accent-primary)] text-left transition-all shadow-2xs group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all" />
          </div>
          <h3 className="text-xs font-bold text-slate-900 dark:text-[#e6edf2]">Capture Notice</h3>
          <p className="text-[11px] text-slate-500 dark:text-[#8e9fa8] mt-0.5">
            AI text, image & PDF extraction
          </p>
        </button>

        <button
          type="button"
          onClick={onNavigateToVault}
          className="p-4 rounded-2xl bg-white dark:bg-[#1b262d] border border-slate-200/70 dark:border-[#23333d] hover:border-[var(--accent-primary)] text-left transition-all shadow-2xs group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <FileCheck className="w-4 h-4" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
          </div>
          <h3 className="text-xs font-bold text-slate-900 dark:text-[#e6edf2]">Campus Vault</h3>
          <p className="text-[11px] text-slate-500 dark:text-[#8e9fa8] mt-0.5">
            {verifiedDocCount} stored documents
          </p>
        </button>
      </div>
    </div>
  );
}
