import React from 'react';
import { 
  Flame, 
  Clock, 
  CheckCircle, 
  Calendar, 
  CheckCircle2, 
  Circle
} from 'lucide-react';
import { parseDeadlineToDateBadge, getEffectivePriority } from '../utils/dateUtils';

// Helper to format clean short date without time or extra details
function formatCleanDate(deadlineStr) {
  if (!deadlineStr || typeof deadlineStr !== 'string') {
    return 'No date';
  }

  const badge = parseDeadlineToDateBadge(deadlineStr);
  if (badge && badge.month && badge.day) {
    const formattedMonth = badge.month.charAt(0) + badge.month.slice(1).toLowerCase();
    return `${formattedMonth} ${parseInt(badge.day, 10)}`;
  }

  return deadlineStr.replace(/\s*(?:by|at|•|-|until)\s*.*$/i, '').trim();
}

// Helper to truncate title to max ~32 characters with ellipsis
function formatShortTitle(title) {
  if (!title) return 'Untitled Notice';
  return title.length > 32 ? title.slice(0, 32).trim() + '...' : title;
}

export default function TaskTableView({ 
  tasks = [], 
  onToggleComplete
}) {
  // Priority configuration for pills
  const priorityConfig = {
    high: {
      icon: Flame,
      pillClass: 'bg-rose-100/90 dark:bg-[#2b191e] text-rose-800 dark:text-rose-300 border-rose-300/70 dark:border-rose-900/50',
      iconCircleClass: 'bg-rose-200/80 dark:bg-rose-950 text-rose-700 dark:text-rose-300',
      label: 'High'
    },
    medium: {
      icon: Clock,
      pillClass: 'bg-[var(--accent-light)] text-[var(--accent-text)] border-[var(--accent-light-border)]',
      iconCircleClass: 'bg-[var(--accent-badge-bg)] text-[var(--accent-badge-text)]',
      label: 'Medium'
    },
    low: {
      icon: CheckCircle,
      pillClass: 'bg-emerald-50 dark:bg-[#142922] text-emerald-700 dark:text-emerald-300 border-emerald-200/70 dark:border-[#1c483a]',
      iconCircleClass: 'bg-emerald-200/70 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
      label: 'Low'
    }
  };

  return (
    <div className="w-full bg-white dark:bg-[#1b262d] rounded-3xl border border-slate-200/70 dark:border-[#23333d]/80 shadow-2xs overflow-hidden transition-colors">
      {/* ======================================================== */}
      {/* DESKTOP / TABLET SPREADSHEET VIEW (md and up)            */}
      {/* ======================================================== */}
      <div className="hidden sm:block">
        <table className="w-full text-left border-collapse">
          {/* Header Row */}
          <thead>
            <tr className="bg-slate-50/90 dark:bg-[#141f26]/90 border-b border-slate-200/70 dark:border-[#23333d] text-[11px] font-bold text-slate-500 dark:text-[#8e9fa8] uppercase tracking-wider select-none">
              <th scope="col" className="py-3 pl-4 pr-1 w-12 text-center">
                Status
              </th>
              <th scope="col" className="py-3 px-4 font-bold">
                Notice
              </th>
              <th scope="col" className="py-3 px-4 font-bold w-36 text-center">
                Priority
              </th>
              <th scope="col" className="py-3 pr-5 pl-4 font-bold w-36 text-right">
                Deadline
              </th>
            </tr>
          </thead>

          {/* Body Rows */}
          <tbody className="divide-y divide-slate-100 dark:divide-[#23333d]/70 text-xs">
            {tasks.map((task) => {
              const {
                id,
                task_name,
                deadline,
                priority = 'medium',
                completed = false
              } = task;

              const effectivePriority = getEffectivePriority(task);
              const priorityPill = priorityConfig[effectivePriority.toLowerCase()] || priorityConfig.medium;
              const PriorityIcon = priorityPill.icon;
              const cleanDate = formatCleanDate(deadline);
              const shortTitle = formatShortTitle(task_name);

              return (
                <tr
                  key={id}
                  onClick={() => onToggleComplete && onToggleComplete(id)}
                  className={`group transition-colors duration-150 cursor-pointer min-h-[48px] hover:bg-slate-50/80 dark:hover:bg-[#141f26]/60 ${
                    completed
                      ? 'bg-slate-50/40 dark:bg-[#141f26]/30 text-slate-400 dark:text-[#8e9fa8]'
                      : 'text-slate-900 dark:text-[#e6edf2]'
                  }`}
                >
                  {/* Status / Checkbox */}
                  <td className="py-3.5 pl-4 pr-1 text-center align-middle">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onToggleComplete) onToggleComplete(id);
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-[var(--accent-text)] hover:bg-[var(--accent-light)] transition-colors cursor-pointer inline-flex items-center justify-center min-w-[28px] min-h-[28px]"
                      title={completed ? 'Mark as active' : 'Mark as completed'}
                    >
                      {completed ? (
                        <CheckCircle2 className="w-4.5 h-4.5 text-[var(--accent-primary)] fill-[var(--accent-light)]" />
                      ) : (
                        <Circle className="w-4.5 h-4.5 text-slate-300 dark:text-slate-600 group-hover:text-[var(--accent-primary)] transition-colors" />
                      )}
                    </button>
                  </td>

                  {/* 1. Notice Column (Truncated short title with tooltip) */}
                  <td className="py-3.5 px-4 align-middle">
                    <span
                      title={task_name}
                      className={`font-semibold text-xs sm:text-sm tracking-tight transition-colors truncate block max-w-xs lg:max-w-sm ${
                        completed
                          ? 'line-through text-slate-400 dark:text-[#8e9fa8]'
                          : 'text-slate-900 dark:text-[#e6edf2] group-hover:text-[var(--accent-primary)]'
                      }`}
                    >
                      {shortTitle}
                    </span>
                  </td>

                  {/* 2. Priority Column (Pill) */}
                  <td className="py-3.5 px-4 align-middle text-center">
                    <div
                      className={`inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-0.5 rounded-full text-[11px] font-bold border tracking-wide shadow-2xs whitespace-nowrap ${priorityPill.pillClass}`}
                    >
                      <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${priorityPill.iconCircleClass}`}>
                        <PriorityIcon className="w-2 h-2" />
                      </span>
                      <span>{priorityPill.label}</span>
                    </div>
                  </td>

                  {/* 3. Deadline Column (Clean Date Only) */}
                  <td className="py-3.5 pr-5 pl-4 align-middle text-right">
                    <div className="inline-flex items-center gap-1.5 font-semibold text-slate-600 dark:text-[#8e9fa8] text-xs justify-end">
                      <Calendar className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
                      <span className="whitespace-nowrap">{cleanDate}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ======================================================== */}
      {/* MOBILE COMPACT STACKED-ROW VIEW (No Horizontal Scroll)    */}
      {/* ======================================================== */}
      <div className="block sm:hidden divide-y divide-slate-100 dark:divide-[#23333d]/70">
        {tasks.map((task) => {
          const {
            id,
            task_name,
            deadline,
            priority = 'medium',
            completed = false
          } = task;

          const effectivePriority = getEffectivePriority(task);
          const priorityPill = priorityConfig[effectivePriority.toLowerCase()] || priorityConfig.medium;
          const PriorityIcon = priorityPill.icon;
          const cleanDate = formatCleanDate(deadline);
          const shortTitle = formatShortTitle(task_name);

          return (
            <div
              key={id}
              onClick={() => onToggleComplete && onToggleComplete(id)}
              className={`flex items-center justify-between gap-3 px-4 py-3.5 min-h-[52px] transition-colors cursor-pointer active:bg-slate-100/60 dark:active:bg-[#141f26]/80 ${
                completed
                  ? 'bg-slate-50/40 dark:bg-[#141f26]/30 text-slate-400 dark:text-[#8e9fa8]'
                  : 'text-slate-900 dark:text-[#e6edf2]'
              }`}
            >
              {/* Left: Checkbox + Short Notice Title */}
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onToggleComplete) onToggleComplete(id);
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-[var(--accent-text)] transition-colors cursor-pointer shrink-0 min-w-[28px] min-h-[28px] flex items-center justify-center"
                  title={completed ? 'Mark as active' : 'Mark as completed'}
                >
                  {completed ? (
                    <CheckCircle2 className="w-5 h-5 text-[var(--accent-primary)] fill-[var(--accent-light)]" />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                  )}
                </button>

                <span
                  title={task_name}
                  className={`font-semibold text-xs tracking-tight truncate block ${
                    completed
                      ? 'line-through text-slate-400 dark:text-[#8e9fa8]'
                      : 'text-slate-900 dark:text-[#e6edf2]'
                  }`}
                >
                  {shortTitle}
                </span>
              </div>

              {/* Right: Priority Pill + Clean Date */}
              <div className="flex items-center gap-2 shrink-0">
                <div
                  className={`inline-flex items-center gap-1 pl-1.5 pr-2 py-0.5 rounded-full text-[10px] font-bold border tracking-wide shadow-2xs whitespace-nowrap ${priorityPill.pillClass}`}
                >
                  <span className={`w-3 h-3 rounded-full flex items-center justify-center ${priorityPill.iconCircleClass}`}>
                    <PriorityIcon className="w-1.5 h-1.5" />
                  </span>
                  <span>{priorityPill.label}</span>
                </div>

                <div className="inline-flex items-center gap-1 font-semibold text-slate-500 dark:text-[#8e9fa8] text-[11px] whitespace-nowrap">
                  <Calendar className="w-3 h-3 text-[var(--accent-primary)] shrink-0" />
                  <span>{cleanDate}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
