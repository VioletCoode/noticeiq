import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  CheckCircle2, 
  Circle, 
  MoreVertical, 
  Trash2, 
  FileText, 
  Flame, 
  Clock, 
  CheckCircle,
  Tag,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { checkDocumentReadiness } from '../utils/vaultData';
import { parseDeadlineToDateBadge, formatDisplayDeadline, getEffectivePriority } from '../utils/dateUtils';

export default function TaskCard({ 
  task, 
  onToggleComplete, 
  onDelete,
  vaultDocs 
}) {
  const {
    id,
    task_name,
    description,
    deadline,
    priority = 'medium',
    required_documents = [],
    source_label = 'College Notice',
    completed = false
  } = task;

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  // Priority configuration & badge styling with dynamic theme tokens
  const priorityConfig = {
    high: {
      icon: Flame,
      badgeClass: 'bg-rose-100/80 dark:bg-[#2b191e] text-rose-800 dark:text-rose-300 border-rose-300/70 dark:border-rose-900/50',
      iconCircleClass: 'bg-rose-200/80 dark:bg-rose-950 text-rose-700 dark:text-rose-300',
      iconClass: 'text-rose-600 dark:text-rose-400',
      label: 'High Priority',
      cardClass: 'bg-[#FEF2F2] dark:bg-[#1f171a] border-rose-200 dark:border-rose-900/40 hover:border-rose-300 dark:hover:border-rose-800 shadow-2xs hover:shadow-subtle',
      dateBadgeClass: 'bg-rose-100/90 dark:bg-[#2b191e] text-rose-900 dark:text-rose-200 border-rose-200 dark:border-rose-900/50'
    },
    medium: {
      icon: Clock,
      badgeClass: 'bg-[var(--accent-light)] text-[var(--accent-text)] border-[var(--accent-light-border)]',
      iconCircleClass: 'bg-[var(--accent-badge-bg)] text-[var(--accent-badge-text)]',
      iconClass: 'text-[var(--accent-primary)]',
      label: 'Medium Priority',
      cardClass: 'bg-white dark:bg-[#1b262d] border-slate-200/60 dark:border-[#23333d]/70 hover:border-[var(--accent-primary)] shadow-2xs hover:shadow-subtle',
      dateBadgeClass: 'bg-[var(--accent-light)] text-[var(--accent-text)] border-[var(--accent-light-border)]'
    },
    low: {
      icon: CheckCircle,
      badgeClass: 'bg-emerald-50 dark:bg-[#142922] text-emerald-700 dark:text-emerald-300 border-emerald-200/70 dark:border-[#1c483a]',
      iconCircleClass: 'bg-emerald-200/70 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
      iconClass: 'text-emerald-600 dark:text-emerald-400',
      label: 'Low Priority',
      cardClass: 'bg-white dark:bg-[#1b262d] border-slate-200/60 dark:border-[#23333d]/70 hover:border-[var(--accent-primary)] shadow-2xs hover:shadow-subtle',
      dateBadgeClass: 'bg-slate-100 dark:bg-[#141f26] text-slate-800 dark:text-[#e6edf2] border-slate-200/80 dark:border-[#23333d]'
    }
  };

  const effectivePriority = getEffectivePriority(task);
  const currentPriority = priorityConfig[effectivePriority.toLowerCase()] || priorityConfig.medium;
  const PriorityIcon = currentPriority.icon;

  // Cross-check documents with Campus Vault
  const docReadiness = checkDocumentReadiness(required_documents, vaultDocs);
  const isDocumentsReady = required_documents.length > 0 && docReadiness.isAllReady;

  // Date badge breakdown
  const dateInfo = parseDeadlineToDateBadge(deadline);

  return (
    <div
      className={`group rounded-3xl p-4 sm:p-5 md:p-6 border transition-all duration-180 relative overflow-hidden flex flex-col sm:flex-row items-start gap-3.5 sm:gap-5 ${
        completed 
          ? 'border-slate-200/60 dark:border-[#23333d]/60 bg-slate-50/70 dark:bg-[#141f26]/50 opacity-60' 
          : currentPriority.cardClass
      }`}
    >
      {/* Date Badge Box on Left */}
      <div className={`w-14 sm:w-16 h-16 sm:h-20 rounded-2xl border flex flex-col items-center justify-center shrink-0 shadow-2xs select-none ${currentPriority.dateBadgeClass}`}>
        <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8e9fa8]">
          {dateInfo.month}
        </span>
        <span className="text-xl sm:text-2xl font-black leading-none mt-0.5">
          {dateInfo.day}
        </span>
      </div>

      {/* Main Task Content */}
      <div className="flex-1 min-w-0 w-full space-y-2.5">
        {/* Top Badges Row + Action Controls */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {/* Priority Badge with circular icon */}
            <div
              className={`inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-0.5 rounded-full text-[11px] font-bold border tracking-wide shadow-2xs ${currentPriority.badgeClass}`}
            >
              <span className={`w-4 h-4 rounded-full flex items-center justify-center ${currentPriority.iconCircleClass}`}>
                <PriorityIcon className="w-2.5 h-2.5" />
              </span>
              <span>{currentPriority.label}</span>
            </div>

            {/* AI Detected Tag */}
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--accent-light)] text-[var(--accent-text)] border border-[var(--accent-light-border)] shadow-2xs">
              <Sparkles className="w-3 h-3 text-[var(--accent-primary)]" />
              <span>AI Detected</span>
            </span>

            {/* Docs Ready Badge */}
            {required_documents && required_documents.length > 0 && (
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border shadow-2xs ${
                  isDocumentsReady
                    ? 'bg-emerald-50 dark:bg-[#142922] text-emerald-700 dark:text-emerald-300 border-emerald-200/70 dark:border-[#1c483a]'
                    : 'bg-amber-50 dark:bg-[#2b2214] text-amber-700 dark:text-amber-300 border-amber-200/70 dark:border-[#4d3a1d]'
                }`}
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>Docs Ready ({docReadiness.readyCount}/{docReadiness.totalRequired})</span>
              </span>
            )}
          </div>

          {/* Right Action Controls: Checkbox + Kebab Menu */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onToggleComplete(id)}
              title={completed ? 'Mark task as active' : 'Mark task as done'}
              className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-[var(--accent-text)] hover:bg-[var(--accent-light)] rounded-xl transition-colors cursor-pointer"
            >
              {completed ? (
                <CheckCircle2 className="w-5 h-5 text-[var(--accent-primary)] fill-[var(--accent-light)]" />
              ) : (
                <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600 hover:text-[var(--accent-primary)]" />
              )}
            </button>

            {/* Kebab Dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#141f26] rounded-xl transition-colors cursor-pointer"
                title="More options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {isMenuOpen && (
                <div className="absolute right-0 mt-1 w-32 bg-white dark:bg-[#1b262d] rounded-2xl shadow-lg border border-slate-200/70 dark:border-[#23333d] py-1 z-30 animate-popover origin-top-right text-xs">
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      onDelete(id);
                    }}
                    className="w-full text-left px-3 py-2 min-h-[40px] text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 flex items-center gap-2 font-medium cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Task Title & Description */}
        <div>
          <h3
            className={`text-sm md:text-base font-bold text-slate-900 dark:text-[#e6edf2] leading-snug tracking-tight ${
              completed ? 'line-through text-slate-400 dark:text-[#8e9fa8]' : ''
            }`}
          >
            {task_name}
          </h3>
          {description && (
            <p className="text-xs text-slate-600 dark:text-[#8e9fa8] leading-relaxed line-clamp-2 mt-1">
              {description}
            </p>
          )}
        </div>

        {/* Required Documents Pill List if any */}
        {required_documents && required_documents.length > 0 && (
          <div className="p-3 rounded-2xl bg-slate-50/70 dark:bg-[#141f26] border border-slate-200/50 dark:border-[#23333d] text-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-slate-700 dark:text-[#e6edf2] flex items-center gap-1.5 text-[11px]">
                <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-[#8e9fa8]" />
                Required Documents:
              </span>
              <span className="text-[10px] font-bold text-slate-500 dark:text-[#8e9fa8]">
                {docReadiness.readyCount}/{docReadiness.totalRequired} in Vault
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {required_documents.map((doc, idx) => {
                const isAvailable = docReadiness.availableDocs.includes(doc);
                return (
                  <span
                    key={idx}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium border shadow-2xs ${
                      isAvailable
                        ? 'bg-emerald-50 dark:bg-[#142922] text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-[#1c483a]'
                        : 'bg-amber-50 dark:bg-[#2b2214] text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-[#4d3a1d]'
                    }`}
                  >
                    {isAvailable ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    )}
                    <span>{doc}</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer Info: Deadline & Source */}
        <div className="pt-2.5 border-t border-slate-100 dark:border-[#23333d] flex items-center justify-between text-xs text-slate-500 dark:text-[#8e9fa8]">
          <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-[#e6edf2] text-xs">
            <Calendar className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>{formatDisplayDeadline(deadline)}</span>
          </div>

          <div className="flex items-center gap-1 text-slate-400 dark:text-[#8e9fa8] text-xs font-medium">
            <Tag className="w-3 h-3 text-slate-400 dark:text-[#8e9fa8]" />
            <span className="truncate max-w-[150px]" title={source_label}>
              {source_label}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
