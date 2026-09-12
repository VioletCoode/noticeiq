import React, { useState } from 'react';
import { 
  IdCard,
  LayoutDashboard, 
  Sparkles, 
  ShieldCheck, 
  Calendar, 
  MoreHorizontal, 
  BarChart3, 
  Key, 
  Trash2, 
  X 
} from 'lucide-react';

export default function MobileNav({
  activeTab,
  setActiveTab,
  taskCount = 0,
  onOpenApiKeyModal,
  onClearAllData
}) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const tabs = [
    { id: 'campus-id', label: 'Campus ID', icon: IdCard },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: taskCount > 0 ? taskCount : null },
    { id: 'capture', label: 'Capture', icon: Sparkles, highlight: true },
    { id: 'vault', label: 'Vault', icon: ShieldCheck },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
  ];

  return (
    <>
      {/* More Overflow Modal / Drawer */}
      {isMoreOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex flex-col justify-end md:hidden animate-fade-in" role="dialog" aria-modal="true">
          <div className="bg-white dark:bg-[#1b262d] rounded-t-3xl p-6 space-y-4 shadow-2xl border-t border-slate-200/70 dark:border-[#23333d] animate-slide-up">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[#23333d]">
              <h3 className="text-base font-bold text-slate-900 dark:text-[#e6edf2]">More Options</h3>
              <button
                onClick={() => setIsMoreOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-[#e6edf2] rounded-lg hover:bg-slate-100 dark:hover:bg-[#141f26] cursor-pointer"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 text-xs">
              <button
                onClick={() => {
                  setActiveTab('analytics');
                  setIsMoreOpen(false);
                }}
                className="flex items-center gap-3 p-3 rounded-2xl hover:bg-[var(--accent-light)] text-slate-700 dark:text-[#e6edf2] font-semibold transition-colors cursor-pointer"
              >
                <BarChart3 className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>Analytics & Insights</span>
              </button>

              <button
                onClick={() => {
                  setIsMoreOpen(false);
                  if (onOpenApiKeyModal) onOpenApiKeyModal();
                }}
                className="flex items-center gap-3 p-3 rounded-2xl hover:bg-[var(--accent-light)] text-slate-700 dark:text-[#e6edf2] font-semibold transition-colors cursor-pointer"
              >
                <Key className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>Gemini API Key Settings</span>
              </button>

              {onClearAllData && (
                <button
                  onClick={() => {
                    setIsMoreOpen(false);
                    onClearAllData();
                  }}
                  className="flex items-center gap-3 p-3 rounded-2xl hover:bg-rose-50 dark:hover:bg-[#2b191e] text-rose-600 dark:text-rose-400 font-semibold transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Clear All Data</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Sticky Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 dark:bg-[#152026]/95 backdrop-blur-md border-t border-slate-200/60 dark:border-[#1e2d36]/70 z-40 px-3 flex items-center justify-around shadow-sm transition-colors">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 relative transition-colors cursor-pointer ${
                isActive ? 'text-[var(--accent-text)] font-bold' : 'text-slate-500 dark:text-[#8e9fa8] hover:text-slate-800 dark:hover:text-[#e6edf2]'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${tab.highlight && !isActive ? 'text-[var(--accent-primary)]' : ''}`} />
                {tab.badge !== null && (
                  <span className="absolute -top-1.5 -right-2 text-[9px] font-bold bg-[var(--accent-primary)] text-white w-4 h-4 rounded-full flex items-center justify-center shadow-2xs">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-1">{tab.label}</span>
            </button>
          );
        })}

        {/* More Button */}
        <button
          onClick={() => setIsMoreOpen(true)}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors cursor-pointer ${
            activeTab === 'analytics' ? 'text-[var(--accent-text)] font-bold' : 'text-slate-500 dark:text-[#8e9fa8] hover:text-slate-800 dark:hover:text-[#e6edf2]'
          }`}
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-[10px] mt-1">More</span>
        </button>
      </nav>
    </>
  );
}
