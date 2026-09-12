import React, { useState, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles,
  Clock,
  Plus
} from 'lucide-react';
import { 
  parseDeadlineToDateBadge, 
  formatDisplayDeadline, 
  parseDeadlineToISO, 
  getDeadlineToComparableTimestamp,
  getEffectivePriority 
} from '../utils/dateUtils';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June', 
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/**
 * Accurately determines if a task's deadline falls on a specific date (year, monthIndex, day).
 */
function getTaskDeadlinesForDay(tasksList, year, monthIdx, dayNum) {
  return tasksList.filter((t) => {
    if (!t || !t.deadline) return false;
    const clean = t.deadline.trim();

    // 1. Direct ISO or standard date match
    let d = null;
    if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
      const parsed = new Date(clean);
      if (!isNaN(parsed.getTime())) d = parsed;
    } else {
      const iso = parseDeadlineToISO(clean);
      if (iso) {
        const parsed = new Date(iso);
        if (!isNaN(parsed.getTime())) d = parsed;
      }
    }

    if (d) {
      return (
        d.getFullYear() === year &&
        d.getMonth() === monthIdx &&
        d.getDate() === dayNum
      );
    }

    // 2. Relative keywords / text date fallback
    const badge = parseDeadlineToDateBadge(clean);
    if (badge.day !== '--') {
      const dayStr = String(dayNum).padStart(2, '0');
      const monthShort = MONTH_SHORT[monthIdx];
      if (badge.day === dayStr && badge.month === monthShort) {
        const yearMatch = clean.match(/\b(20\d{2})\b/);
        if (yearMatch) {
          return parseInt(yearMatch[1], 10) === year;
        }
        return true;
      }
    }

    return false;
  });
}

export default function CalendarScreen({ tasks = [], onNavigateToCapture }) {
  const today = useMemo(() => new Date(), []);
  const [currentYear, setCurrentYear] = useState(() => today.getFullYear());
  const [currentMonthIndex, setCurrentMonthIndex] = useState(() => today.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);

  const handlePrevMonth = () => {
    setCurrentMonthIndex((prev) => {
      if (prev === 0) {
        setCurrentYear((y) => y - 1);
        return 11;
      }
      return prev - 1;
    });
    setSelectedDay(null);
  };

  const handleNextMonth = () => {
    setCurrentMonthIndex((prev) => {
      if (prev === 11) {
        setCurrentYear((y) => y + 1);
        return 0;
      }
      return prev + 1;
    });
    setSelectedDay(null);
  };

  const handleJumpToToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonthIndex(now.getMonth());
    setSelectedDay(now.getDate());
  };

  // Group active tasks
  const activeTasks = useMemo(() => {
    return tasks.filter((t) => !t.completed && t.status !== 'completed');
  }, [tasks]);

  // Sort upcoming tasks chronologically by deadline
  const sortedUpcomingTasks = useMemo(() => {
    return [...activeTasks].sort((a, b) => {
      const timeA = getDeadlineToComparableTimestamp(a.deadline);
      const timeB = getDeadlineToComparableTimestamp(b.deadline);
      return timeA - timeB;
    });
  }, [activeTasks]);

  // Today's date marker (derived dynamically from actual current date)
  const isCurrentMonth = currentYear === today.getFullYear() && currentMonthIndex === today.getMonth();
  const todayDay = today.getDate();

  // Helper for priority glow on topmost upcoming deadline
  const getTopItemGlowStyle = (priority) => {
    const p = (priority || 'medium').toLowerCase();
    if (p === 'high') {
      return 'dark:shadow-[0_0_25px_-2px_rgba(244,63,94,0.35)] dark:border-rose-700/70 dark:bg-[#25171d]';
    } else if (p === 'low') {
      return 'dark:shadow-[0_0_25px_-2px_rgba(16,185,129,0.3)] dark:border-emerald-700/70 dark:bg-[#122820]';
    }
    // Default / Medium: teal accent glow
    return 'dark:shadow-[0_0_25px_-2px_rgba(20,184,166,0.35)] dark:border-teal-600/70 dark:bg-[#13272b]';
  };

  // Calendar grid calculations
  const daysInMonth = new Date(currentYear, currentMonthIndex + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonthIndex, 1).getDay(); // 0 = Sun, 6 = Sat
  const prevMonthDaysCount = new Date(currentYear, currentMonthIndex, 0).getDate();

  const prevMonthDays = [];
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    prevMonthDays.push(prevMonthDaysCount - i);
  }

  const currentMonthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const totalCells = prevMonthDays.length + currentMonthDays.length;
  const nextMonthDaysNeeded = (7 - (totalCells % 7)) % 7;
  const nextMonthDays = Array.from({ length: nextMonthDaysNeeded }, (_, i) => i + 1);

  // If user selected a day, filter displayed tasks to that day; otherwise show all active
  const displayedTasks = useMemo(() => {
    if (!selectedDay) return sortedUpcomingTasks;
    return sortedUpcomingTasks.filter((t) => 
      getTaskDeadlinesForDay([t], currentYear, currentMonthIndex, selectedDay).length > 0
    );
  }, [selectedDay, sortedUpcomingTasks, currentYear, currentMonthIndex]);

  return (
    <div className="p-3 sm:p-6 md:p-8 max-w-6xl mx-auto space-y-5 sm:space-y-6 animate-fade-in relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/60 dark:border-[#23333d]">
        <div>
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--accent-light)] text-[var(--accent-primary)] flex items-center justify-center shadow-2xs border border-[var(--accent-light-border)] shrink-0">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-[#e6edf2] tracking-tight">
                Academic Calendar & Deadlines
              </h1>
              <p className="text-xs text-slate-500 dark:text-[#8e9fa8] font-medium">
                Visual timeline mapped from active notice tasks
              </p>
            </div>
          </div>
        </div>

        {/* Coming Soon Notice Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--accent-light)] border border-[var(--accent-light-border)] text-xs font-bold text-[var(--accent-text)] self-start md:self-auto shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          <span>Sync with Google / Outlook Calendar (Coming Soon)</span>
        </div>
      </div>

      {/* Main Grid: Calendar Strip + Deadlines List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        
        {/* Calendar View Container with Soft Ambient Glow in Dark Mode (8 Cols) */}
        <div className="lg:col-span-8 relative">
          
          {/* Ambient Glow Background Element (Dark Mode Only) */}
          <div 
            className="hidden dark:block absolute -inset-2.5 sm:-inset-4 bg-[radial-gradient(ellipse_at_center,rgba(20,184,166,0.18)_0%,rgba(13,148,136,0.08)_45%,transparent_70%)] blur-2xl -z-10 rounded-[2.5rem] pointer-events-none"
            aria-hidden="true"
          />

          {/* Calendar Card */}
          <div className="bg-white dark:bg-[#1b262d]/95 backdrop-blur-xs rounded-3xl p-3.5 sm:p-6 border border-slate-200/60 dark:border-[#23333d]/90 dark:shadow-[0_0_40px_-15px_rgba(20,184,166,0.15)] shadow-2xs space-y-4 relative z-10 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#e6edf2]">
                  {MONTH_NAMES[currentMonthIndex]} {currentYear}
                </h2>
                {isCurrentMonth ? (
                  <span className="hidden sm:inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--accent-badge-bg)] text-[var(--accent-badge-text)] border border-[var(--accent-light-border)]">
                    Current Month
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleJumpToToday}
                    className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#142026] text-slate-700 dark:text-teal-300 border border-slate-200 dark:border-teal-700/50 hover:bg-slate-200 dark:hover:bg-[#1b2f38] transition-colors cursor-pointer"
                  >
                    Jump to Today
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl border border-slate-200/80 dark:border-[#23333d] hover:bg-slate-50 dark:hover:bg-[#141f26] text-slate-600 dark:text-[#8e9fa8] transition-colors cursor-pointer"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl border border-slate-200/80 dark:border-[#23333d] hover:bg-slate-50 dark:hover:bg-[#141f26] text-slate-600 dark:text-[#8e9fa8] transition-colors cursor-pointer"
                  aria-label="Next month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Calendar Grid Representation */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-xs">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="font-bold text-[10px] sm:text-xs text-slate-400 dark:text-[#8e9fa8] py-1">
                  {d}
                </div>
              ))}

              {/* Trailing days from previous month */}
              {prevMonthDays.map((pDay) => (
                <div
                  key={`prev-${pDay}`}
                  className="min-h-[44px] sm:min-h-[58px] p-1 sm:p-1.5 rounded-xl sm:rounded-2xl border border-dashed border-slate-100 dark:border-[#1e2a32]/40 bg-slate-50/20 dark:bg-[#111c22]/20 text-slate-300 dark:text-slate-600 flex flex-col items-center justify-between select-none opacity-40 cursor-default"
                >
                  <span className="text-[10px] sm:text-[11px] font-medium">{pDay}</span>
                </div>
              ))}

              {/* Real days of current month */}
              {currentMonthDays.map((day) => {
                const dayTasks = getTaskDeadlinesForDay(activeTasks, currentYear, currentMonthIndex, day);
                const hasTask = dayTasks.length > 0;
                const isToday = isCurrentMonth && day === todayDay;
                const isSelected = selectedDay === day;

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDay(selectedDay === day ? null : day)}
                    title={
                      hasTask
                        ? dayTasks.map((t) => t.task_name || t.title).join('\n')
                        : isToday
                        ? 'Today'
                        : undefined
                    }
                    className={`min-h-[44px] sm:min-h-[58px] p-1 sm:p-1.5 rounded-xl sm:rounded-2xl border flex flex-col items-center justify-between transition-all relative text-center cursor-pointer ${
                      isSelected
                        ? 'ring-2 ring-[var(--accent-primary)] ring-offset-2 dark:ring-offset-[#1b262d] z-20'
                        : ''
                    } ${
                      hasTask
                        ? 'border-[var(--accent-light-border)] bg-[var(--accent-light)] dark:bg-[#132426] dark:border-teal-700/60 dark:shadow-[inset_0_0_12px_rgba(20,184,166,0.15)] font-bold text-slate-900 dark:text-[#e6edf2] shadow-2xs hover:scale-[1.02]'
                        : isToday
                        ? 'border-teal-300 dark:border-teal-500/50 bg-slate-50 dark:bg-[#142026] text-slate-900 dark:text-teal-200 hover:border-teal-400'
                        : 'border-slate-100 dark:border-[#23333d]/60 bg-slate-50/40 dark:bg-[#141f26]/40 text-slate-600 dark:text-[#8e9fa8] hover:bg-slate-100/70 dark:hover:bg-[#17242c]'
                    }`}
                  >
                    {hasTask ? (
                      <span
                        className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[var(--accent-primary)] text-white font-bold flex items-center justify-center text-[10px] sm:text-[11px] shadow-2xs ${
                          isToday
                            ? 'dark:shadow-[0_0_16px_rgba(20,184,166,0.9),0_0_5px_rgba(94,234,212,1)] ring-1.5 ring-teal-300 dark:ring-teal-400'
                            : 'dark:shadow-[0_0_10px_rgba(20,184,166,0.7),0_0_3px_rgba(45,212,191,0.8)]'
                        }`}
                      >
                        {day}
                      </span>
                    ) : isToday ? (
                      <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-slate-200 dark:bg-[#1f333b] text-teal-800 dark:text-teal-300 font-bold flex items-center justify-center text-[10px] sm:text-[11px] dark:shadow-[0_0_8px_rgba(20,184,166,0.3)]">
                        {day}
                      </span>
                    ) : (
                      <span className="text-[10px] sm:text-[11px] font-semibold">{day}</span>
                    )}

                    {hasTask ? (
                      <span className="text-[8px] sm:text-[9px] font-bold text-[var(--accent-text)] dark:text-teal-300 truncate max-w-full px-0.5">
                        {dayTasks.length > 1 ? `${dayTasks.length} Notices` : (dayTasks[0].category || 'Notice')}
                      </span>
                    ) : isToday ? (
                      <span className="text-[8px] sm:text-[9px] font-semibold text-slate-400 dark:text-teal-400/80 truncate max-w-full">
                        Today
                      </span>
                    ) : null}
                  </button>
                );
              })}

              {/* Leading days of next month */}
              {nextMonthDays.map((nDay) => (
                <div
                  key={`next-${nDay}`}
                  className="min-h-[44px] sm:min-h-[58px] p-1 sm:p-1.5 rounded-xl sm:rounded-2xl border border-dashed border-slate-100 dark:border-[#1e2a32]/40 bg-slate-50/20 dark:bg-[#111c22]/20 text-slate-300 dark:text-slate-600 flex flex-col items-center justify-between select-none opacity-40 cursor-default"
                >
                  <span className="text-[10px] sm:text-[11px] font-medium">{nDay}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Upcoming Notice Deadlines (4 Cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-[#1b262d] rounded-3xl p-4 sm:p-6 border border-slate-200/60 dark:border-[#23333d]/70 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#23333d]">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-[#e6edf2] text-sm">Upcoming Deadlines</h3>
              <p className="text-[11px] text-slate-400 dark:text-[#8e9fa8]">
                {selectedDay 
                  ? `Filtered for ${MONTH_NAMES[currentMonthIndex].slice(0, 3)} ${selectedDay}`
                  : 'Earliest deadlines shown first'}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {selectedDay && (
                <button
                  type="button"
                  onClick={() => setSelectedDay(null)}
                  className="text-[10px] font-bold text-slate-500 hover:text-slate-800 dark:text-[#8e9fa8] dark:hover:text-white underline cursor-pointer"
                >
                  Clear
                </button>
              )}
              <span className="text-xs font-bold text-[var(--accent-text)] bg-[var(--accent-badge-bg)] px-2.5 py-0.5 rounded-full border border-[var(--accent-light-border)] shadow-2xs">
                {displayedTasks.length} Pending
              </span>
            </div>
          </div>

          {displayedTasks.length === 0 ? (
            <div className="py-8 px-4 text-center space-y-2">
              <p className="text-xs text-slate-400 dark:text-[#8e9fa8]">
                {selectedDay
                  ? `No deadlines scheduled for ${MONTH_NAMES[currentMonthIndex]} ${selectedDay}.`
                  : 'No upcoming task deadlines found.'}
              </p>
              {selectedDay ? (
                <button
                  type="button"
                  onClick={() => setSelectedDay(null)}
                  className="text-xs text-[var(--accent-primary)] font-bold hover:underline cursor-pointer"
                >
                  Show all upcoming deadlines
                </button>
              ) : onNavigateToCapture ? (
                <button
                  type="button"
                  onClick={onNavigateToCapture}
                  className="inline-flex items-center gap-1 text-xs text-[var(--accent-primary)] font-bold hover:underline cursor-pointer pt-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Capture a new notice
                </button>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
              {displayedTasks.map((t, idx) => {
                const dateBadge = parseDeadlineToDateBadge(t.deadline);
                const isTopItem = !selectedDay && idx === 0;
                const effectivePriority = getEffectivePriority(t);

                return (
                  <div
                    key={t.id}
                    className={`p-3.5 rounded-2xl border transition-all duration-180 space-y-2 shadow-2xs relative ${
                      isTopItem
                        ? `border-slate-200/80 bg-slate-50/90 dark:bg-[#142026] ${getTopItemGlowStyle(effectivePriority)}`
                        : 'border-slate-100 dark:border-[#23333d] bg-slate-50/70 dark:bg-[#141f26]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-[var(--accent-text)] bg-[var(--accent-badge-bg)] px-2.5 py-0.5 rounded-full border border-[var(--accent-light-border)]">
                        {dateBadge.day} {dateBadge.month}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {isTopItem && (
                          <span className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.2 rounded bg-amber-100/80 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700/50">
                            Urgent
                          </span>
                        )}
                        <span className="text-slate-400 dark:text-[#8e9fa8] capitalize font-medium">
                          {effectivePriority} priority
                        </span>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-[#e6edf2] leading-snug">
                        {t.task_name || t.title}
                      </p>
                      {(t.description || t.source_label) && (
                        <p className="text-[11px] text-slate-500 dark:text-[#8e9fa8] line-clamp-1 mt-0.5">
                          {t.description || t.source_label}
                        </p>
                      )}
                    </div>

                    <div className="pt-1 border-t border-slate-200/60 dark:border-[#23333d]/70 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-[#8e9fa8] font-medium">
                        <Clock className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
                        <span>{formatDisplayDeadline(t.deadline)}</span>
                      </div>
                      {t.category && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate max-w-[100px]">
                          {t.category}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
