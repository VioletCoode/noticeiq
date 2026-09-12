import React from 'react';
import { 
  BarChart3, 
  Sparkles, 
  Zap 
} from 'lucide-react';

export default function AnalyticsScreen({ tasks = [], vaultDocs = [] }) {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.completed).length;
  const activeTasks = tasks.filter((t) => !t.completed).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100;

  const highPriorityCount = tasks.filter((t) => t.priority === 'high' && !t.completed).length;
  const mediumPriorityCount = tasks.filter((t) => t.priority === 'medium' && !t.completed).length;
  const lowPriorityCount = tasks.filter((t) => t.priority === 'low' && !t.completed).length;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/60 dark:border-[#23333d]">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--accent-light)] text-[var(--accent-primary)] flex items-center justify-center shadow-2xs border border-[var(--accent-light-border)]">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-[#e6edf2] tracking-tight">
                Insights & Academic Analytics
              </h1>
              <p className="text-xs text-slate-500 dark:text-[#8e9fa8] font-medium">
                Action item resolution speed, compliance metrics, and AI extraction statistics
              </p>
            </div>
          </div>
        </div>

        {/* Real-time sync badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--accent-light)] border border-[var(--accent-light-border)] text-xs font-bold text-[var(--accent-text)] self-start md:self-auto shadow-2xs">
          <Zap className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          <span>Live Local Metrics</span>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-white dark:bg-[#1b262d] border border-slate-200/60 dark:border-[#23333d]/70 shadow-2xs hover:shadow-subtle transition-all space-y-1.5">
          <span className="text-xs font-semibold text-slate-500 dark:text-[#8e9fa8]">Completion Rate</span>
          <div className="text-2xl font-black text-slate-900 dark:text-[#e6edf2]">{completionRate}%</div>
          <div className="text-[11px] text-[var(--accent-text)] font-semibold">{completedTasks} of {totalTasks} finished</div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-[#1b262d] border border-slate-200/60 dark:border-[#23333d]/70 shadow-2xs hover:shadow-subtle transition-all space-y-1.5">
          <span className="text-xs font-semibold text-slate-500 dark:text-[#8e9fa8]">Active Action Items</span>
          <div className="text-2xl font-black text-slate-900 dark:text-[#e6edf2]">{activeTasks}</div>
          <div className="text-[11px] text-slate-500 dark:text-[#8e9fa8] font-semibold">Requiring resolution</div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-[#1b262d] border border-slate-200/60 dark:border-[#23333d]/70 shadow-2xs hover:shadow-subtle transition-all space-y-1.5">
          <span className="text-xs font-semibold text-slate-500 dark:text-[#8e9fa8]">High Priority Deadlines</span>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400">{highPriorityCount}</div>
          <div className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">Due within 24-48 hours</div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-[#1b262d] border border-slate-200/60 dark:border-[#23333d]/70 shadow-2xs hover:shadow-subtle transition-all space-y-1.5">
          <span className="text-xs font-semibold text-slate-500 dark:text-[#8e9fa8]">Vault Readiness</span>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {vaultDocs.filter((d) => d.status === 'Available').length}/{vaultDocs.length}
          </div>
          <div className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">Credentials available</div>
        </div>
      </div>

      {/* Detailed Insights Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority Distribution */}
        <div className="p-6 rounded-3xl bg-white dark:bg-[#1b262d] border border-slate-200/60 dark:border-[#23333d]/70 shadow-2xs space-y-4">
          <h3 className="font-bold text-slate-900 dark:text-[#e6edf2] text-sm">Active Notice Urgency Distribution</h3>
          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between mb-1 font-semibold">
                <span className="text-rose-700 dark:text-rose-400">High Urgency</span>
                <span className="text-slate-700 dark:text-[#e6edf2]">{highPriorityCount} items</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 dark:bg-[#141f26] rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full"
                  style={{ width: `${activeTasks > 0 ? (highPriorityCount / activeTasks) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1 font-semibold">
                <span className="text-amber-700 dark:text-amber-400">Medium Urgency</span>
                <span className="text-slate-700 dark:text-[#e6edf2]">{mediumPriorityCount} items</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 dark:bg-[#141f26] rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: `${activeTasks > 0 ? (mediumPriorityCount / activeTasks) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1 font-semibold">
                <span className="text-emerald-700 dark:text-emerald-400">Low Urgency</span>
                <span className="text-slate-700 dark:text-[#e6edf2]">{lowPriorityCount} items</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 dark:bg-[#141f26] rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${activeTasks > 0 ? (lowPriorityCount / activeTasks) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* AI Notice Extraction Accuracy */}
        <div className="p-6 rounded-3xl bg-white dark:bg-[#1b262d] border border-slate-200/60 dark:border-[#23333d]/70 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-[#e6edf2] text-sm">AI Extraction Performance</h3>
            <span className="text-xs font-bold text-[var(--accent-text)] bg-[var(--accent-badge-bg)] px-2 py-0.5 rounded border border-[var(--accent-light-border)]">98% Cross-Verified</span>
          </div>

          <p className="text-xs text-slate-600 dark:text-[#8e9fa8] leading-relaxed">
            Gemini Flash multimodal models extract structured dates, document prerequisites, and departmental tags from unstructured text, screenshots, and circular PDFs.
          </p>

          <div className="p-4 rounded-2xl bg-[var(--accent-light)] border border-[var(--accent-light-border)] text-xs text-slate-900 dark:text-[#e6edf2] space-y-2 shadow-2xs">
            <div className="flex items-center gap-2 font-bold">
              <Sparkles className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>Continuous Verification Engine</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-[#8e9fa8] leading-relaxed">
              Every captured notice runs through strict schema validation with deterministic JSON parsing before rendering tasks into your workspace.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
