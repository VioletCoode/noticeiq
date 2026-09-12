import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  X, 
  Sparkles, 
  ShieldCheck 
} from 'lucide-react';
import { formatDisplayDeadline, getEffectivePriority } from '../utils/dateUtils';

export default function SearchModal({ 
  isOpen, 
  onClose, 
  tasks = [], 
  vaultDocs = [] 
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Keyboard shortcut listener: Escape to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const cleanQuery = query.toLowerCase().trim();

  const filteredTasks = cleanQuery
    ? tasks.filter(
        (t) =>
          t.task_name?.toLowerCase().includes(cleanQuery) ||
          t.description?.toLowerCase().includes(cleanQuery) ||
          t.source_label?.toLowerCase().includes(cleanQuery) ||
          (t.required_documents && t.required_documents.some((d) => d.toLowerCase().includes(cleanQuery)))
      )
    : [];

  const filteredVault = cleanQuery
    ? vaultDocs.filter(
        (v) =>
          v.name?.toLowerCase().includes(cleanQuery) ||
          v.category?.toLowerCase().includes(cleanQuery)
      )
    : [];

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-start justify-center pt-10 sm:pt-20 px-2.5 sm:px-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="search-modal-title"
    >
      <div className="bg-white dark:bg-[#1b262d] rounded-3xl max-w-2xl w-full p-4 sm:p-5 shadow-2xl border border-slate-200/70 dark:border-[#23333d] relative space-y-4 overflow-hidden animate-popover origin-top max-h-[88vh] flex flex-col">
        
        {/* Search Bar Input Header */}
        <div className="relative flex items-center">
          <div className="absolute left-3.5 sm:left-4 text-[var(--accent-primary)] pointer-events-none flex items-center justify-center">
            <Search className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <input
            ref={inputRef}
            id="search-modal-title"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notices, tasks, documents, deadlines..."
            className="w-full pl-10 sm:pl-12 pr-20 sm:pr-24 py-3 sm:py-3.5 rounded-2xl bg-slate-100/80 dark:bg-[#141f26] border border-slate-200/80 dark:border-[#23333d] focus:bg-white dark:focus:bg-[#152026] focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-ring)] text-xs sm:text-sm text-slate-900 dark:text-[#e6edf2] placeholder-slate-400 dark:placeholder-[#8e9fa8] transition-all outline-none"
          />

          <div className="absolute right-2.5 sm:right-3 flex items-center gap-1">
            {query && (
              <button
                onClick={() => setQuery('')}
                className="px-2 py-1 min-h-[36px] flex items-center rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-[#e6edf2] text-xs font-semibold cursor-pointer"
                title="Clear input"
              >
                Clear
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-[#e6edf2] hover:bg-slate-200/60 dark:hover:bg-[#141f26] transition-colors cursor-pointer"
              title="Close search"
              aria-label="Close search modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Filter Tags (when empty query) */}
        {!cleanQuery && (
          <div className="space-y-3 pt-1 text-xs overflow-y-auto">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#8e9fa8]">
              Quick Filter Suggestions
            </span>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {['Python Lab', 'Exam Fee', 'Placement', 'Hackathon', 'College ID', 'Urgent'].map((tag) => (
                <button
                  key={tag}
                  onClick={() => setQuery(tag)}
                  className="px-2.5 sm:px-3 py-1.5 min-h-[36px] rounded-xl bg-slate-100 dark:bg-[#141f26] hover:bg-[var(--accent-light)] hover:text-[var(--accent-text)] text-slate-700 dark:text-[#e6edf2] border border-slate-200/60 dark:border-[#23333d] transition-colors font-medium flex items-center gap-1.5 cursor-pointer text-xs"
                >
                  <Sparkles className="w-3 h-3 text-[var(--accent-primary)]" />
                  <span>{tag}</span>
                </button>
              ))}
            </div>

            {/* Recent/Pinned Task Previews */}
            <div className="pt-3 border-t border-slate-100 dark:border-[#23333d] space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#8e9fa8]">
                Recent Notices & Tasks ({tasks.length})
              </span>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {tasks.slice(0, 3).map((task) => (
                  <div
                    key={task.id}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#141f26] border border-slate-100 dark:border-[#23333d] flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)] shrink-0"></span>
                      <span className="font-semibold text-slate-800 dark:text-[#e6edf2] truncate">
                        {task.task_name}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-[#8e9fa8] shrink-0 ml-2 font-medium">
                      {formatDisplayDeadline(task.deadline)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Results List */}
        {cleanQuery && (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {/* Task Results */}
            {filteredTasks.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent-text)]">
                  Notice Action Items ({filteredTasks.length})
                </span>
                {filteredTasks.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-[#141f26] hover:bg-[var(--accent-light)] border border-slate-100 dark:border-[#23333d] transition-colors flex items-center justify-between text-xs"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-[#e6edf2]">
                          {t.task_name}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                          getEffectivePriority(t) === 'high' 
                            ? 'bg-rose-100 dark:bg-[#2b191e] text-rose-800 dark:text-rose-300' 
                            : getEffectivePriority(t) === 'medium'
                            ? 'bg-amber-100 dark:bg-[#2b2214] text-amber-800 dark:text-amber-300'
                            : 'bg-emerald-100 dark:bg-[#142922] text-emerald-800 dark:text-emerald-300'
                        }`}>
                          {getEffectivePriority(t)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-[#8e9fa8] truncate">
                        {t.description || t.source_label}
                      </p>
                    </div>

                    <div className="text-right shrink-0 ml-3">
                      <span className="text-[11px] font-semibold text-slate-600 dark:text-[#e6edf2]">
                        {formatDisplayDeadline(t.deadline)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Vault Results */}
            {filteredVault.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent-text)]">
                  Campus Vault Documents ({filteredVault.length})
                </span>
                {filteredVault.map((v) => (
                  <div
                    key={v.id}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-[#141f26] border border-slate-100 dark:border-[#23333d] flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-[var(--accent-primary)]" />
                      <div>
                        <span className="font-bold text-slate-800 dark:text-[#e6edf2] block">
                          {v.name}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-[#8e9fa8] block">{v.category}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-[#142922] text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-[#1c483a]">
                      {v.status}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Empty State when no matches */}
            {filteredTasks.length === 0 && filteredVault.length === 0 && (
              <div className="py-8 text-center space-y-2">
                <p className="text-xs font-bold text-slate-700 dark:text-[#e6edf2]">
                  No matching notices or documents found for "{query}"
                </p>
                <p className="text-[11px] text-slate-400 dark:text-[#8e9fa8]">
                  Try searching for keywords like "lab", "fee", "exam", "ID", or "deadline".
                </p>
              </div>
            )}
          </div>
        )}

        {/* Footer info & shortcut hint */}
        <div className="pt-2 border-t border-slate-100 dark:border-[#23333d] flex items-center justify-between text-[11px] text-slate-400 dark:text-[#8e9fa8]">
          <span>NoticeIQ Instant Search</span>
          <div className="flex items-center gap-2">
            <span>Press</span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#141f26] border border-slate-200/80 dark:border-[#23333d] font-mono text-[10px] font-semibold text-slate-600 dark:text-[#e6edf2]">
              ESC
            </kbd>
            <span>to close</span>
          </div>
        </div>

      </div>
    </div>
  );
}
