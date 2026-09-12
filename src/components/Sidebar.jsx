import React from 'react';
import { 
  IdCard,
  LayoutDashboard, 
  Sparkles, 
  ShieldCheck, 
  Calendar, 
  BarChart3, 
  ArrowRight, 
  Cpu, 
  Database 
} from 'lucide-react';
import { getSessionRequestCount } from '../utils/rateLimiter';

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  taskCount = 0, 
  apiKeyStatus = 'missing',
  onOpenApiKeyModal,
  onClearAllData
}) {
  const navItems = [
    {
      id: 'campus-id',
      label: 'Campus ID',
      icon: IdCard,
      desc: 'Digital Student ID Card'
    },
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: taskCount > 0 ? taskCount : null,
      desc: 'Command center & tasks'
    },
    {
      id: 'capture',
      label: 'Capture Notice',
      icon: Sparkles,
      highlight: true,
      desc: 'AI notice extractor'
    },
    {
      id: 'vault',
      label: 'Campus Vault',
      icon: ShieldCheck,
      desc: 'Verified documents'
    },
    {
      id: 'calendar',
      label: 'Calendar',
      icon: Calendar,
      desc: 'Important Dates'
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart3,
      desc: 'Insights & Reports'
    }
  ];

  const sessionReqCount = getSessionRequestCount();

  return (
    <aside className="w-60 lg:w-64 xl:w-72 bg-[var(--bg-sidebar)] border-r border-[var(--border-sidebar)] flex flex-col justify-between h-[calc(100vh-4rem)] md:h-screen sticky top-0 shadow-sm select-none z-30 overflow-x-hidden overflow-y-auto text-white transition-all">
      {/* Navigation Workspace */}
      <div className="pt-4 pb-3 pl-3 pr-0 space-y-1.5 relative">
        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/50 dark:text-[#8e9fa8]">
          Workspace
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={isActive ? { backgroundColor: 'var(--bg-page)' } : {}}
              className={`flex items-center justify-between text-xs min-h-[44px] transition-all duration-180 ease-in-out group cursor-pointer ${
                isActive
                  ? 'w-[calc(100%+1px)] mr-[-1px] rounded-l-2xl rounded-r-none pl-3.5 sm:pl-4 pr-3 py-3 bg-[var(--bg-page)] text-slate-900 dark:text-[#e6edf2] font-black animate-nav-pop z-30 relative shadow-[-4px_0_12px_rgba(0,0,0,0.06)] dark:shadow-[-4px_0_16px_rgba(0,0,0,0.35)] border-y border-l border-slate-200/60 dark:border-[#23333d]/70 border-r-0'
                  : 'w-[calc(100%-0.75rem)] mr-3 px-3.5 py-2.5 rounded-2xl text-white/80 dark:text-slate-300/80 hover:bg-white/[0.08] dark:hover:bg-white/[0.05] hover:text-white font-medium hover:translate-x-0.5'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    isActive
                      ? 'bg-[var(--accent-primary)] text-white shadow-2xs font-bold'
                      : item.highlight
                      ? 'bg-white/15 text-white group-hover:bg-white/20'
                      : 'bg-black/20 dark:bg-white/5 text-white/80 group-hover:bg-white/15 group-hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="text-left min-w-0">
                  <span className={`block leading-tight text-xs truncate ${
                    isActive 
                      ? 'text-slate-900 dark:text-[#e6edf2] font-black' 
                      : 'text-white/90 dark:text-slate-200'
                  }`}>
                    {item.label}
                  </span>
                  <span className={`text-[10px] transition-colors truncate block ${
                    isActive 
                      ? 'text-[var(--accent-text)] font-semibold' 
                      : 'text-white/50 dark:text-[#8e9fa8]/70 group-hover:text-white/80'
                  }`}>
                    {item.desc}
                  </span>
                </div>
              </div>

              {item.badge !== null && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-black shadow-2xs transition-colors shrink-0 ml-1 ${
                    isActive
                      ? 'bg-[var(--accent-primary)] text-white'
                      : 'bg-black/30 dark:bg-[#182932] text-white/90 dark:text-slate-300 border border-white/10 group-hover:bg-black/40'
                  }`}
                >
                  {item.badge}
                </span>
              )}
              {item.highlight && !isActive && (
                <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)] shadow-2xs shrink-0 ml-1"></span>
              )}
            </button>
          );
        })}
      </div>

      {/* Stacked Minimal Panel Cards Below Navigation */}
      <div className="p-3 space-y-2 border-t border-white/10 dark:border-[#17232a]">
        
        {/* Panel 1: AI Assistant Card */}
        <button
          onClick={onOpenApiKeyModal}
          className="w-full text-left p-3 rounded-2xl bg-white/[0.05] dark:bg-[#142229]/80 hover:bg-white/[0.09] dark:hover:bg-[#1b2d36] border border-white/10 dark:border-[#1e2f38] text-white shadow-2xs transition-all group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-[var(--accent-primary)] text-white flex items-center justify-center shadow-2xs font-bold">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-white dark:text-[#e6edf2]">AI Assistant</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-white/60 group-hover:translate-x-0.5 transition-transform" />
          </div>
          <p className="text-[11px] text-white/60 dark:text-[#8e9fa8] mt-1 pl-8">
            Ask NoticeIQ anything...
          </p>
        </button>

        {/* Panel 2: System Status Card */}
        <div className="p-3 rounded-2xl bg-white/[0.05] dark:bg-[#142229]/80 border border-white/10 dark:border-[#1e2f38] text-white shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>
              <span className="text-xs font-bold text-white dark:text-[#e6edf2]">System Status</span>
            </div>
            <span className="text-[10px] font-bold text-emerald-200 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-600/50 shadow-2xs">
              Operational
            </span>
          </div>

          <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/10 dark:border-[#1e2f38]">
            <span className="text-[11px] text-white/60 dark:text-[#8e9fa8]">
              {sessionReqCount > 0 ? `${sessionReqCount} reqs session` : 'All systems active'}
            </span>
            <svg className="w-16 h-5 stroke-emerald-400 fill-none" viewBox="0 0 64 20" aria-label="System active indicator">
              <path
                d="M0 12 Q 10 4, 20 11 T 40 7 T 64 10"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Panel 3: Gemini Model Status Card */}
        <div className="p-3 rounded-2xl bg-white/[0.05] dark:bg-[#142229]/80 border border-white/10 dark:border-[#1e2f38] text-white shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-black/30 text-teal-400 flex items-center justify-center border border-white/10">
                <Cpu className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white dark:text-[#e6edf2] leading-tight font-mono">gemini-flash-latest</span>
                <span className="text-[10px] text-white/50 dark:text-[#8e9fa8]">fallback: gemini-3.5-flash</span>
              </div>
            </div>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-400"></span>
            </span>
          </div>


          {/* Supabase DB & Manage Data Links */}
          <div className="pt-2 border-t border-white/10 dark:border-[#1e2f38] flex items-center justify-between text-[11px] text-white/60 dark:text-[#8e9fa8]">
            <div className="flex items-center gap-1.5 font-medium text-white/80 dark:text-slate-300">
              <Database className="w-3 h-3 text-[var(--accent-text)]" />
              <span>Supabase DB</span>
            </div>
            {onClearAllData && (
              <button
                onClick={onClearAllData}
                className="text-[11px] text-white/70 hover:text-rose-300 transition-colors font-bold hover:underline cursor-pointer"
                title="Manage cloud data or reset tasks"
              >
                Clear Data
              </button>
            )}
          </div>
        </div>

      </div>
    </aside>
  );
}
