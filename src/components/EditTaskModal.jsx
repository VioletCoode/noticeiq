import React, { useState, useEffect } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  Check, 
  Sparkles, 
  Tag, 
  FileText, 
  Loader2,
  Edit3
} from 'lucide-react';
import { parseDeadlineToISO, formatDisplayDeadline } from '../utils/dateUtils';

export default function EditTaskModal({
  isOpen,
  task,
  onClose,
  onSave
}) {
  const [taskName, setTaskName] = useState('');
  const [deadlineInput, setDeadlineInput] = useState('');
  const [priority, setPriority] = useState('medium');
  const [requirementsInput, setRequirementsInput] = useState('');
  const [description, setDescription] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Sync state when task changes or modal opens
  useEffect(() => {
    if (task && isOpen) {
      setTaskName(task.task_name || task.title || '');
      setDeadlineInput(task.deadline ? formatDisplayDeadline(task.deadline) : '');
      setPriority((task.priority || 'medium').toLowerCase());
      const reqs = task.required_documents || task.requirements || [];
      setRequirementsInput(Array.isArray(reqs) ? reqs.join(', ') : String(reqs || ''));
      setDescription(task.description || '');
      setErrorMsg(null);
    }
  }, [task, isOpen]);

  if (!isOpen || !task) return null;

  // Live parsed deadline preview using chrono-node
  const parsedPreviewISO = deadlineInput.trim() ? parseDeadlineToISO(deadlineInput.trim()) : null;
  const isDeadlineRecognized = !deadlineInput.trim() || Boolean(parsedPreviewISO);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!taskName.trim()) {
      setErrorMsg('Please enter a task title.');
      return;
    }

    let finalDeadlineISO = null;
    if (deadlineInput.trim()) {
      finalDeadlineISO = parseDeadlineToISO(deadlineInput.trim());
      if (!finalDeadlineISO) {
        setErrorMsg(`Could not recognize the deadline "${deadlineInput}". Please enter a valid date or relative phrase.`);
        return;
      }
    }

    const cleanedReqs = requirementsInput
      .split(',')
      .map(r => r.trim())
      .filter(Boolean);

    setIsSaving(true);
    try {
      await onSave({
        id: task.id,
        title: taskName.trim(),
        task_name: taskName.trim(),
        deadline: finalDeadlineISO,
        priority,
        requirements: cleanedReqs,
        required_documents: cleanedReqs,
        description: description.trim() || null,
      });
      onClose();
    } catch (err) {
      console.error('[EditTaskModal] Save error:', err);
      setErrorMsg(err.message || 'Failed to update task. Please check your inputs.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-task-modal-title"
    >
      <div className="w-full max-w-lg bg-white dark:bg-[#1b262d] rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200/70 dark:border-[#23333d] space-y-4 animate-popover max-h-[92vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#23333d]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[var(--accent-light)] border border-[var(--accent-light-border)] flex items-center justify-center text-[var(--accent-primary)] shadow-2xs">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h2 id="edit-task-modal-title" className="text-base font-bold text-slate-900 dark:text-[#e6edf2]">
                Edit Task
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-[#8e9fa8]">
                Update deadline, priority, or required documents for postponed events
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-[#e6edf2] rounded-xl hover:bg-slate-100 dark:hover:bg-[#141f26] active:scale-95 transition-all cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert Banner */}
        {errorMsg && (
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2.5 shadow-2xs animate-slide-down">
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <span className="font-semibold leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {/* Form Fields */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Task Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#e6edf2] mb-1.5">
              Task Title *
            </label>
            <input
              type="text"
              required
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="e.g. Python Lab Assignment 4"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200/80 dark:border-[#23333d] bg-slate-50/50 dark:bg-[#152026] text-slate-900 dark:text-[#e6edf2] text-xs sm:text-sm focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-colors"
            />
          </div>

          {/* Deadline Field with Live Chrono Preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#e6edf2]">
                Deadline (Natural language or date)
              </label>
              {deadlineInput.trim() && (
                <span className={`text-[11px] font-semibold flex items-center gap-1 ${
                  isDeadlineRecognized 
                    ? 'text-emerald-600 dark:text-emerald-400' 
                    : 'text-amber-600 dark:text-amber-400'
                }`}>
                  {isDeadlineRecognized ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>{formatDisplayDeadline(parsedPreviewISO)}</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3 h-3" />
                      <span>Unrecognized format</span>
                    </>
                  )}
                </span>
              )}
            </div>

            <div className="relative">
              <input
                type="text"
                value={deadlineInput}
                onChange={(e) => setDeadlineInput(e.target.value)}
                placeholder="e.g. Postponed to next Monday 3pm, or Sep 20"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200/80 dark:border-[#23333d] bg-slate-50/50 dark:bg-[#152026] text-slate-900 dark:text-[#e6edf2] text-xs sm:text-sm focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-colors"
              />
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Quick Date Helper Pills */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              <button
                type="button"
                onClick={() => setDeadlineInput('Today, 11:59 PM')}
                className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#141f26] dark:hover:bg-[#23333d] text-slate-700 dark:text-[#8e9fa8] active:scale-95 transition-all cursor-pointer"
              >
                Today 11:59 PM
              </button>
              <button
                type="button"
                onClick={() => setDeadlineInput('Tomorrow, 11:59 PM')}
                className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#141f26] dark:hover:bg-[#23333d] text-slate-700 dark:text-[#8e9fa8] active:scale-95 transition-all cursor-pointer"
              >
                Tomorrow 11:59 PM
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 3);
                  setDeadlineInput(`${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}, 11:59 PM`);
                }}
                className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#141f26] dark:hover:bg-[#23333d] text-slate-700 dark:text-[#8e9fa8] active:scale-95 transition-all cursor-pointer"
              >
                In 3 Days
              </button>
              <button
                type="button"
                onClick={() => setDeadlineInput('Next Monday, 3:00 PM')}
                className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#141f26] dark:hover:bg-[#23333d] text-slate-700 dark:text-[#8e9fa8] active:scale-95 transition-all cursor-pointer"
              >
                Next Monday 3 PM
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 7);
                  setDeadlineInput(`${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}, 11:59 PM`);
                }}
                className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#141f26] dark:hover:bg-[#23333d] text-slate-700 dark:text-[#8e9fa8] active:scale-95 transition-all cursor-pointer"
              >
                In 1 Week
              </button>
            </div>
          </div>

          {/* Priority Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#e6edf2] mb-1.5">
              Priority
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPriority('high')}
                className={`py-2 px-3 rounded-xl font-bold border transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                  priority === 'high'
                    ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 shadow-2xs'
                    : 'border-slate-200/80 dark:border-[#23333d] text-slate-600 dark:text-[#8e9fa8] hover:bg-slate-50 dark:hover:bg-[#141f26]'
                }`}
              >
                <span>🔥 High</span>
              </button>
              <button
                type="button"
                onClick={() => setPriority('medium')}
                className={`py-2 px-3 rounded-xl font-bold border transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                  priority === 'medium'
                    ? 'bg-[var(--accent-light)] border-[var(--accent-light-border)] text-[var(--accent-text)] shadow-2xs'
                    : 'border-slate-200/80 dark:border-[#23333d] text-slate-600 dark:text-[#8e9fa8] hover:bg-slate-50 dark:hover:bg-[#141f26]'
                }`}
              >
                <span>⏳ Medium</span>
              </button>
              <button
                type="button"
                onClick={() => setPriority('low')}
                className={`py-2 px-3 rounded-xl font-bold border transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                  priority === 'low'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 shadow-2xs'
                    : 'border-slate-200/80 dark:border-[#23333d] text-slate-600 dark:text-[#8e9fa8] hover:bg-slate-50 dark:hover:bg-[#141f26]'
                }`}
              >
                <span>✅ Low</span>
              </button>
            </div>
          </div>

          {/* Required Documents (Comma-separated) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#e6edf2] mb-1.5">
              Required Documents (Optional, comma-separated)
            </label>
            <div className="relative">
              <input
                type="text"
                value={requirementsInput}
                onChange={(e) => setRequirementsInput(e.target.value)}
                placeholder="e.g. Fee Receipt, Grade Card, College ID"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200/80 dark:border-[#23333d] bg-slate-50/50 dark:bg-[#152026] text-slate-900 dark:text-[#e6edf2] text-xs sm:text-sm focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-colors"
              />
              <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#e6edf2] mb-1.5">
              Notes / Description (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Rescheduled due to department symposium"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200/80 dark:border-[#23333d] bg-slate-50/50 dark:bg-[#152026] text-slate-900 dark:text-[#e6edf2] text-xs sm:text-sm focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-colors resize-none"
            />
          </div>

          {/* Modal Footer Controls */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-[#23333d]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 min-h-[44px] text-xs font-semibold text-slate-600 dark:text-[#8e9fa8] hover:bg-slate-100 dark:hover:bg-[#141f26] active:scale-95 rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-5 py-2 min-h-[44px] rounded-xl text-xs font-bold text-white bg-[var(--accent-primary)] hover:opacity-90 active:scale-95 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Rescheduling...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
