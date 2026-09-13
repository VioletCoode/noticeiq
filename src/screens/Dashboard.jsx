import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  ShieldCheck, 
  Plus, 
  Inbox, 
  FileText, 
  Edit2, 
  Bot,
  ListTodo,
  Activity,
  SlidersHorizontal,
  Bell,
  Lock,
  Check,
  LayoutGrid,
  Table as TableIcon,
  Mail,
  RefreshCw
} from 'lucide-react';
import TaskCard from '../components/TaskCard';
import TaskTableView from '../components/TaskTableView';
import { checkDocumentReadiness } from '../utils/vaultData';
import { getDeadlineToComparableTimestamp, getEffectivePriority } from '../utils/dateUtils';
import { requestNotificationPermissionAndRegister } from '../services/notifications';
import { supabase } from '../services/supabase';
import { initiateGmailOAuth, getGmailConnectionStatus, syncGmail, disconnectGmail } from '../services/gmail';

const STORAGE_VIEW_MODE_KEY = 'noticeiq_task_view_mode_v1';

function formatRelativeDue(deadline) {
  if (!deadline) return "without a deadline";
  const days = Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "due today";
  if (days === 1) return "due tomorrow";
  return `due in ${days} days`;
}

function speakDigest(userName, tasks, onEnd) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('[NoticeIQ] SpeechSynthesis is not supported in this browser.');
    onEnd?.();
    return;
  }

  window.speechSynthesis.cancel();

  const topTasks = (tasks || [])
    .filter(t => t.status !== 'completed' && !t.completed)
    .sort((a, b) => new Date(a.deadline || 0) - new Date(b.deadline || 0))
    .slice(0, 3);

  let text = `Good morning ${userName || 'Student'}. `;
  if (topTasks.length === 0) {
    text += "You have no urgent tasks today. Nice work.";
  } else {
    text += `You have ${topTasks.length} thing${topTasks.length > 1 ? 's' : ''} that need your attention. `;
    topTasks.forEach((t, i) => {
      const dueText = formatRelativeDue(t.deadline);
      const title = t.title || t.task_name || 'Task';
      text += `${i + 1}. ${title}, ${dueText}. `;
    });
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  if (onEnd) {
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
  }
  window.speechSynthesis.speak(utterance);
}


export default function Dashboard({ 
  tasks = [], 
  apiKeyStatus = 'missing',
  onOpenApiKeyModal,
  onToggleComplete, 
  onDeleteTask, 
  onClearAllData,
  onNavigateToCapture, 
  onNavigateToVault,
  vaultDocs = [],
  userName = 'Riddhi',
  onUpdateUserName,
  userId,
  onRefreshTasks
}) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(userName);
  const [sortMode, setSortMode] = useState('urgency'); // 'urgency' | 'deadline'
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [alertEnabled, setAlertEnabled] = useState(false);
  const [isRegisteringAlerts, setIsRegisteringAlerts] = useState(false);

  // Gmail Sync state
  const [gmailConnected, setGmailConnected] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [isSyncingGmail, setIsSyncingGmail] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);

  // Audio Briefing state
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Pull-to-refresh native feel state
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);

  const handleTouchStart = (e) => {
    if (window.scrollY <= 0 && !isRefreshing) {
      touchStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    } else {
      isPulling.current = false;
    }
  };

  const handleTouchMove = (e) => {
    if (!isPulling.current || isRefreshing) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY.current;
    if (diff > 0 && window.scrollY <= 0) {
      const distance = Math.min(diff * 0.4, 65);
      setPullDistance(distance);
    } else {
      setPullDistance(0);
    }
  };

  const handleTouchEnd = async () => {
    if (!isPulling.current) return;
    isPulling.current = false;
    if (pullDistance > 45) {
      setIsRefreshing(true);
      setPullDistance(48);
      try {
        if (onRefreshTasks) await onRefreshTasks();
      } catch (err) {
        console.warn('Refresh error:', err);
      }
      setTimeout(() => {
        setIsRefreshing(false);
        setPullDistance(0);
      }, 500);
    } else {
      setPullDistance(0);
    }
  };

  const handleToggleBriefing = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis?.speaking && isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    setIsSpeaking(true);
    speakDigest(userName, tasks, () => setIsSpeaking(false));
  };

  useEffect(() => {
    let mounted = true;
    const checkGmail = async () => {
      let resolvedId = userId;
      if (!resolvedId) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          resolvedId = user?.id;
        } catch {
          // ignore
        }
      }
      if (!resolvedId) return;

      const res = await getGmailConnectionStatus(resolvedId);
      if (mounted) {
        setGmailConnected(res.isConnected);
        setLastSyncedAt(res.lastSyncedAt);
      }
    };
    checkGmail();
    return () => { mounted = false; };
  }, [userId]);

  const handleConnectGmail = () => {
    let resolvedId = userId;
    try {
      initiateGmailOAuth(resolvedId);
    } catch (err) {
      setSyncMessage({ type: 'error', text: err.message || 'Failed to initiate Gmail connection' });
    }
  };

  const handleManualSync = async () => {
    let resolvedId = userId;
    if (!resolvedId) {
      const { data: { user } } = await supabase.auth.getUser();
      resolvedId = user?.id;
    }
    if (!resolvedId) return;

    setIsSyncingGmail(true);
    setSyncMessage(null);
    try {
      const res = await syncGmail(resolvedId);
      if (res.success) {
        setGmailConnected(true);
        const now = new Date().toISOString();
        setLastSyncedAt(now);
        const count = res.data?.tasksCreated || 0;
        if (count > 0) {
          setSyncMessage({ type: 'success', text: `Sync complete! ${count} new task${count > 1 ? 's' : ''} added.` });
        } else {
          setSyncMessage({ type: 'success', text: 'Inbox scanned: everything is up to date.' });
        }
        if (onRefreshTasks) {
          await onRefreshTasks();
        }
      } else {
        setSyncMessage({ type: 'error', text: res.error || 'Failed to sync emails.' });
      }
    } catch (err) {
      setSyncMessage({ type: 'error', text: err.message || 'Sync error occurred.' });
    } finally {
      setIsSyncingGmail(false);
    }
  };

  const handleDisconnectGmail = async () => {
    let resolvedId = userId;
    if (!resolvedId) {
      const { data: { user } } = await supabase.auth.getUser();
      resolvedId = user?.id;
    }
    if (!resolvedId) return;

    const confirmed = window.confirm('Disconnect Gmail? Automated notice scanning will stop.');
    if (!confirmed) return;

    try {
      const res = await disconnectGmail(resolvedId);
      if (res.success) {
        setGmailConnected(false);
        setLastSyncedAt(null);
        setSyncMessage({ type: 'success', text: 'Gmail disconnected successfully.' });
      } else {
        setSyncMessage({ type: 'error', text: res.error || 'Failed to disconnect.' });
      }
    } catch (err) {
      setSyncMessage({ type: 'error', text: err.message || 'Error disconnecting Gmail.' });
    }
  };

  const formatLastSynced = (timestamp) => {
    if (!timestamp) return 'Never';
    try {
      const d = new Date(timestamp);
      const now = new Date();
      const diffSec = Math.floor((now - d) / 1000);
      if (diffSec < 60) return 'Just now';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      return d.toLocaleDateString();
    } catch {
      return 'Recently';
    }
  };

  // Sync actual OneSignal subscription status from Supabase profile or SDK
  useEffect(() => {
    let mounted = true;
    async function checkSubscriptionState() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('onesignal_id')
            .eq('user_id', user.id)
            .maybeSingle();

          const hasDbSub = Boolean(profile?.onesignal_id);
          const hasLocalSub = typeof window !== 'undefined' && 
            Boolean(window.OneSignal?.User?.PushSubscription?.optedIn && window.OneSignal?.User?.PushSubscription?.id);

          if (mounted) {
            setAlertEnabled(hasDbSub || hasLocalSub);
          }
        }
      } catch (e) {
        // ignore
      }
    }
    checkSubscriptionState();
    return () => { mounted = false; };
  }, []);

  const handleToggleAlerts = async () => {
    setIsRegisteringAlerts(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const res = await requestNotificationPermissionAndRegister(user?.id);
      if (res?.subscriptionId || (res?.granted && res?.optedIn)) {
        setAlertEnabled(true);
      }
    } catch (err) {
      console.warn('Error enabling alerts:', err);
    } finally {
      setIsRegisteringAlerts(false);
    }
  };

  // View Mode: 'cards' | 'table' with localStorage persistence
  const [viewMode, setViewMode] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_VIEW_MODE_KEY);
      if (saved === 'table' || saved === 'cards') {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'cards';
  });

  // Save viewMode to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_VIEW_MODE_KEY, viewMode);
    } catch {
      // ignore
    }
  }, [viewMode]);

  // Directly derive active tasks needing attention
  const activeTasks = tasks.filter(t => !t.completed);
  const attentionCount = activeTasks.length;

  // Aggregate all required documents from active tasks
  const allRequiredDocs = useMemo(() => {
    return Array.from(new Set(activeTasks.flatMap(t => t.required_documents || [])));
  }, [activeTasks]);

  const overallDocReadiness = useMemo(() => {
    return checkDocumentReadiness(allRequiredDocs, vaultDocs);
  }, [allRequiredDocs, vaultDocs]);

  // Compute live numeric stats for the 4 stat cards
  const statsData = useMemo(() => {
    // Stat 1: Active Tasks
    const activeCount = activeTasks.length;

    // Stat 2: Documents Ready ratio
    let readyRatio = '0/0';
    let readyLabel = 'Almost complete';
    if (allRequiredDocs.length > 0) {
      readyRatio = `${overallDocReadiness.readyCount}/${overallDocReadiness.totalRequired}`;
      readyLabel = overallDocReadiness.isAllReady ? '100% Verified' : 'Almost complete';
    } else {
      const availableVaultCount = vaultDocs.filter(d => d.status === 'Available').length;
      readyRatio = `${availableVaultCount}/${vaultDocs.length}`;
      readyLabel = availableVaultCount === vaultDocs.length ? '100% Verified' : 'Almost complete';
    }

    // Stat 3: AI Extracted This week (tasks created in last 7 days)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const extractedThisWeekCount = tasks.filter(t => {
      if (!t.created_at) return true;
      const createdTime = new Date(t.created_at).getTime();
      return !isNaN(createdTime) && createdTime >= sevenDaysAgo;
    }).length;

    // Stat 4: Sync Accuracy - calculated from real task confidence scores
    const validConfTasks = tasks.filter(t => t.confidence !== undefined && t.confidence !== null);
    const syncAccuracy = validConfTasks.length > 0
      ? `${Math.round((validConfTasks.reduce((acc, t) => acc + Number(t.confidence), 0) / validConfTasks.length) * 100)}%`
      : '98%';

    return {
      activeCount,
      readyRatio,
      readyLabel,
      extractedThisWeekCount,
      syncAccuracy
    };
  }, [tasks, activeTasks, allRequiredDocs, overallDocReadiness, vaultDocs]);

  // Due soon active tasks (due within 24 hours)
  const [dismissDueSoon, setDismissDueSoon] = useState(false);
  const dueSoonTasks = useMemo(() => {
    const now = Date.now();
    const next24h = now + 24 * 60 * 60 * 1000;
    return activeTasks.filter(t => {
      if (!t.deadline) return false;
      const dueTime = new Date(t.deadline).getTime();
      return !isNaN(dueTime) && dueTime > now && dueTime <= next24h;
    });
  }, [activeTasks]);

  // Detect iOS browser without PWA installed
  const [dismissIosPrompt, setDismissIosPrompt] = useState(false);
  const showIosBanner = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent || '');
    const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    return isIos && !isStandalone;
  }, []);

  // Handle saving edited user name
  const handleNameSave = () => {
    if (tempName.trim()) {
      onUpdateUserName(tempName.trim());
    }
    setIsEditingName(false);
  };

  // Sort tasks based on sortMode
  const displayedTasks = useMemo(() => {
    const taskList = showAllTasks ? tasks : activeTasks;
    return [...taskList].sort((a, b) => {
      if (sortMode === 'urgency') {
        const priorityWeight = { high: 3, medium: 2, low: 1 };
        const pA = priorityWeight[getEffectivePriority(a)?.toLowerCase()] || 2;
        const pB = priorityWeight[getEffectivePriority(b)?.toLowerCase()] || 2;
        if (pA !== pB) return pB - pA;
        return (new Date(b.created_at || 0).getTime()) - (new Date(a.created_at || 0).getTime());
      } else {
        const timeA = getDeadlineToComparableTimestamp(a.deadline);
        const timeB = getDeadlineToComparableTimestamp(b.deadline);
        if (timeA !== timeB) return timeA - timeB;
        return (new Date(b.created_at || 0).getTime()) - (new Date(a.created_at || 0).getTime());
      }
    });
  }, [tasks, activeTasks, showAllTasks, sortMode]);

  // AI Command Center Status
  const aiStatus = {
    dotColor: 'bg-emerald-500',
    pingColor: 'bg-emerald-400',
    label: 'AI Notice Extraction Active',
    textColor: 'text-emerald-700 dark:text-emerald-300'
  };

  return (
    <div 
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="p-3 sm:p-5 md:p-8 max-w-7xl mx-auto space-y-5 sm:space-y-6 animate-fade-in"
    >
      {/* Pull-to-refresh Visual Indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-all duration-200"
        style={{
          height: `${pullDistance}px`,
          opacity: pullDistance > 10 ? Math.min(pullDistance / 45, 1) : 0,
        }}
        aria-hidden={pullDistance === 0}
      >
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--accent-text)] bg-white dark:bg-[#1b262d] px-3.5 py-1.5 rounded-full shadow-xs border border-slate-200/80 dark:border-[#23333d] select-none">
          <RefreshCw className={`w-3.5 h-3.5 text-[var(--accent-primary)] ${isRefreshing ? 'animate-spin' : ''}`} style={{ transform: isRefreshing ? undefined : `rotate(${pullDistance * 6}deg)` }} />
          <span>{isRefreshing ? 'Refreshing tasks...' : pullDistance > 45 ? 'Release to refresh' : 'Pull to refresh'}</span>
        </div>
      </div>
      
      {/* iOS PWA PROMPT BANNER */}
      {showIosBanner && !dismissIosPrompt && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-[#2b2214] border border-amber-200/80 dark:border-[#4d3a1d] flex items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200 shadow-2xs animate-fade-in">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-amber-200/60 dark:bg-[#3d2f19] text-amber-800 dark:text-amber-300 font-bold">iOS</span>
            <span>
              <strong>Enable Push on iOS:</strong> Tap the Safari Share button and select <strong>"Add to Home Screen"</strong> to receive deadline notifications.
            </span>
          </div>
          <button 
            type="button"
            onClick={() => setDismissIosPrompt(true)}
            className="text-amber-700 dark:text-amber-400 hover:text-amber-900 font-bold px-2 py-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* DUE SOON IN-APP ALERT BANNER */}
      {dueSoonTasks.length > 0 && !dismissDueSoon && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-[#2b191e] border border-rose-200/80 dark:border-rose-900/50 flex items-center justify-between gap-4 text-xs text-rose-900 dark:text-rose-200 shadow-2xs animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-950 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
              <Bell className="w-4 h-4 animate-bounce" />
            </div>
            <div>
              <p className="font-bold">
                {dueSoonTasks.length} {dueSoonTasks.length === 1 ? 'task is' : 'tasks are'} due within the next 24 hours!
              </p>
              <p className="text-[11px] text-rose-700 dark:text-rose-300">
                Next up: <strong>{dueSoonTasks[0].title || dueSoonTasks[0].task_name}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDismissDueSoon(true)}
            className="text-xs font-bold text-rose-700 dark:text-rose-400 hover:text-rose-900 dark:hover:text-rose-200 px-2 py-1 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* GREETING / HERO SECTION */}
      <div className="bg-white dark:bg-[#1b262d] rounded-3xl p-4 sm:p-6 md:p-8 border border-slate-200/60 dark:border-[#23333d]/70 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6 relative overflow-hidden transition-colors">
        {/* Left Column: Greeting + Task count + Capture Notice Pill Button */}
        <div className="space-y-3 z-10 max-w-xl">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <span className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-[#e6edf2] tracking-tight">Good morning,</span>
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onBlur={handleNameSave}
                  onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
                  autoFocus
                  className="text-xl sm:text-2xl md:text-3xl font-extrabold text-[var(--accent-text)] bg-[var(--accent-light)] border-b-2 border-[var(--accent-primary)] px-2 py-0.5 rounded-lg outline-none w-36 sm:w-44"
                />
              </div>
            ) : (
              <h1 
                onClick={() => setIsEditingName(true)}
                className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-[#e6edf2] tracking-tight flex items-center gap-2 group cursor-pointer"
                title="Click to edit name"
              >
                Good morning, <span className="text-[var(--accent-text)] underline decoration-[var(--accent-primary)] decoration-wavy underline-offset-4">{userName}</span>
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--accent-primary)] inline-block animate-pulse" aria-hidden="true" />
                <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
              </h1>
            )}

            <button
              id="dashboard-play-briefing-btn"
              type="button"
              onClick={handleToggleBriefing}
              className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 min-h-[36px] rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-800 dark:text-[#e6edf2] text-xs font-semibold border border-slate-200/70 dark:border-white/10 shadow-2xs transition-all active:scale-95 cursor-pointer"
            >
              <span>{isSpeaking ? '⏹️ Stop briefing' : '🔊 Play briefing'}</span>
            </button>
          </div>

          <p className="text-slate-600 dark:text-[#8e9fa8] text-sm md:text-base font-medium">
            You have <span className="font-bold text-slate-900 dark:text-[#e6edf2]">{attentionCount}</span> {attentionCount === 1 ? 'task' : 'tasks'} that need your attention today.
          </p>

          <div className="pt-1 sm:pt-2 flex items-center gap-3">
            <button
              id="dashboard-capture-btn"
              onClick={onNavigateToCapture}
              className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 min-h-[44px] rounded-full font-bold text-sm text-white bg-[var(--accent-primary)] hover:opacity-90 shadow-2xs hover:shadow-subtle transition-all active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Capture Notice</span>
            </button>
            {onClearAllData && (
              <button
                onClick={onClearAllData}
                className="text-xs text-slate-400 dark:text-[#8e9fa8] hover:text-rose-600 dark:hover:text-rose-400 transition-colors font-medium hover:underline px-2 py-1 cursor-pointer min-h-[44px] flex items-center"
                title="Delete all tasks and reset state"
              >
                Clear All Data
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Decorative Campus Illustration */}
        <div className="hidden md:flex items-center justify-center shrink-0 w-44 h-36 relative">
          <svg viewBox="0 0 200 160" fill="none" className="w-full h-full drop-shadow-xs" aria-label="Campus illustration">
            <circle cx="100" cy="80" r="70" fill="var(--accent-primary)" fillOpacity="0.08" />
            <circle cx="140" cy="50" r="30" fill="var(--accent-primary)" fillOpacity="0.12" />
            <path d="M20 140h160v6H20z" fill="var(--accent-primary)" />
            <rect x="50" y="60" width="100" height="80" rx="4" fill="var(--accent-primary)" fillOpacity="0.8" />
            <polygon points="100,20 40,60 160,60" fill="var(--accent-primary)" />
            <rect x="62" y="75" width="10" height="65" fill="#f8faf9" className="dark:fill-[#141f26]" />
            <rect x="82" y="75" width="10" height="65" fill="#f8faf9" className="dark:fill-[#141f26]" />
            <rect x="108" y="75" width="10" height="65" fill="#f8faf9" className="dark:fill-[#141f26]" />
            <rect x="128" y="75" width="10" height="65" fill="#f8faf9" className="dark:fill-[#141f26]" />
            <circle cx="100" cy="48" r="8" fill="#fde68a" />
            <path d="M100 44v4l3 2" stroke="var(--accent-hover)" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M100 20V8" stroke="var(--accent-hover)" strokeWidth="2" />
            <polygon points="100,8 115,13 100,18" fill="#f59e0b" />
            <circle cx="35" cy="115" r="16" fill="var(--accent-primary)" />
            <rect x="33" y="125" width="4" height="15" fill="var(--accent-hover)" />
            <circle cx="165" cy="115" r="16" fill="var(--accent-primary)" />
            <rect x="163" y="125" width="4" height="15" fill="var(--accent-hover)" />
          </svg>
        </div>
      </div>

      {/* STATS ROW (4 Notion-style Minimal Stat Cards with clean subtle borders) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Card 1: Active Tasks */}
        <div className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#1b262d] border border-slate-200/60 dark:border-[#23333d]/70 shadow-2xs hover:shadow-subtle transition-all flex flex-col justify-between space-y-2.5 sm:space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-[#8e9fa8] uppercase tracking-wider">Active Tasks</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[var(--accent-badge-bg)] text-[var(--accent-badge-text)] flex items-center justify-center border border-[var(--accent-light-border)] shadow-2xs shrink-0">
              <ListTodo className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 dark:text-[#e6edf2] tracking-tight">
              {statsData.activeCount}
            </div>
            <p className="text-[11px] sm:text-xs text-[var(--accent-text)] font-semibold mt-0.5">Needs attention</p>
          </div>
        </div>

        {/* Card 2: Documents Ready */}
        <div className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#1b262d] border border-slate-200/60 dark:border-[#23333d]/70 shadow-2xs hover:shadow-subtle transition-all flex flex-col justify-between space-y-2.5 sm:space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-[#8e9fa8] uppercase tracking-wider">Docs Ready</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-50 dark:bg-[#142922] text-emerald-700 dark:text-emerald-300 flex items-center justify-center border border-emerald-200/60 dark:border-[#1c483a] shadow-2xs shrink-0">
              <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 dark:text-[#e6edf2] tracking-tight">
              {statsData.readyRatio}
            </div>
            <p className="text-[11px] sm:text-xs text-emerald-700 dark:text-emerald-400 font-semibold mt-0.5">{statsData.readyLabel}</p>
          </div>
        </div>

        {/* Card 3: AI Extracted This Week */}
        <div className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#1b262d] border border-slate-200/60 dark:border-[#23333d]/70 shadow-2xs hover:shadow-subtle transition-all flex flex-col justify-between space-y-2.5 sm:space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-[#8e9fa8] uppercase tracking-wider">This Week</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[var(--accent-badge-bg)] text-[var(--accent-badge-text)] flex items-center justify-center border border-[var(--accent-light-border)] shadow-2xs shrink-0">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 dark:text-[#e6edf2] tracking-tight">
              {statsData.extractedThisWeekCount}
            </div>
            <p className="text-[11px] sm:text-xs text-[var(--accent-text)] font-semibold mt-0.5">AI Extracted</p>
          </div>
        </div>

        {/* Card 4: Sync Accuracy */}
        <div className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#1b262d] border border-slate-200/60 dark:border-[#23333d]/70 shadow-2xs hover:shadow-subtle transition-all flex flex-col justify-between space-y-2.5 sm:space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-[#8e9fa8] uppercase tracking-wider">Accuracy</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-50 dark:bg-[#142922] text-emerald-700 dark:text-emerald-300 flex items-center justify-center border border-emerald-200/60 dark:border-[#1c483a] shadow-2xs shrink-0">
              <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 dark:text-[#e6edf2] tracking-tight">
              {statsData.syncAccuracy}
            </div>
            <p className="text-[11px] sm:text-xs text-emerald-700 dark:text-emerald-400 font-semibold mt-0.5">Cross-verified</p>
          </div>
        </div>
      </div>

      {/* MAIN TWO-COLUMN CONTENT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: Priority Tasks Section (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Section Header with Sort Tabs & Filter Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-[#e6edf2] tracking-tight">
                Priority Tasks
              </h2>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[var(--accent-badge-bg)] text-[var(--accent-badge-text)] border border-[var(--accent-light-border)]">
                {displayedTasks.length}
              </span>
            </div>

            {/* Sort Tabs, View Toggle & Filter */}
            <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
              {/* Sort Tabs */}
              <div className="inline-flex p-1 rounded-2xl bg-slate-100/90 dark:bg-[#141f26] border border-slate-200/60 dark:border-[#23333d] text-xs font-semibold shadow-2xs">
                <button
                  onClick={() => setSortMode('urgency')}
                  className={`px-3 py-2 min-h-[40px] sm:min-h-[36px] rounded-xl transition-all cursor-pointer flex items-center justify-center ${
                    sortMode === 'urgency'
                      ? 'bg-white dark:bg-[#1b262d] text-slate-900 dark:text-[#e6edf2] shadow-2xs font-bold'
                      : 'text-slate-500 dark:text-[#8e9fa8] hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  By Urgency
                </button>
                <button
                  onClick={() => setSortMode('deadline')}
                  className={`px-3 py-2 min-h-[40px] sm:min-h-[36px] rounded-xl transition-all cursor-pointer flex items-center justify-center ${
                    sortMode === 'deadline'
                      ? 'bg-white dark:bg-[#1b262d] text-slate-900 dark:text-[#e6edf2] shadow-2xs font-bold'
                      : 'text-slate-500 dark:text-[#8e9fa8] hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  By Deadline
                </button>
              </div>

              {/* View Mode Toggle: Cards vs Table */}
              <div className="inline-flex p-1 rounded-2xl bg-slate-100/90 dark:bg-[#141f26] border border-slate-200/60 dark:border-[#23333d] text-xs font-semibold shadow-2xs">
                <button
                  onClick={() => setViewMode('cards')}
                  className={`p-2.5 sm:p-2 min-h-[40px] min-w-[40px] sm:min-h-[36px] sm:min-w-[36px] rounded-xl transition-all cursor-pointer flex items-center justify-center ${
                    viewMode === 'cards'
                      ? 'bg-white dark:bg-[#1b262d] text-[var(--accent-text)] shadow-2xs'
                      : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                  title="Card View"
                  aria-label="Switch to Card View"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-2.5 sm:p-2 min-h-[40px] min-w-[40px] sm:min-h-[36px] sm:min-w-[36px] rounded-xl transition-all cursor-pointer flex items-center justify-center ${
                    viewMode === 'table'
                      ? 'bg-white dark:bg-[#1b262d] text-[var(--accent-text)] shadow-2xs'
                      : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                  title="Table View (Spreadsheet Grid)"
                  aria-label="Switch to Table View"
                >
                  <TableIcon className="w-4 h-4" />
                </button>
              </div>

              {/* Filter Icon Button */}
              <button
                className="p-2.5 sm:p-2 min-h-[40px] min-w-[40px] sm:min-h-[36px] sm:min-w-[36px] rounded-2xl bg-slate-100/90 dark:bg-[#141f26] hover:bg-slate-200/70 dark:hover:bg-[#1b262d] text-slate-600 dark:text-[#8e9fa8] border border-slate-200/60 dark:border-[#23333d] transition-colors cursor-pointer flex items-center justify-center shadow-2xs"
                title="Filter tasks"
                aria-label="Filter tasks"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Empty State vs Task List */}
          {displayedTasks.length === 0 ? (
            <div className="bg-white dark:bg-[#1b262d] rounded-3xl p-10 border border-dashed border-[var(--accent-light-border)] text-center space-y-4 shadow-2xs">
              <div className="w-14 h-14 rounded-2xl bg-[var(--accent-light)] text-[var(--accent-primary)] mx-auto flex items-center justify-center">
                <Inbox className="w-7 h-7" />
              </div>
              <div className="max-w-md mx-auto space-y-1.5">
                <h3 className="text-base font-bold text-slate-800 dark:text-[#e6edf2]">No priority tasks right now</h3>
                <p className="text-xs text-slate-500 dark:text-[#8e9fa8]">
                  Paste a college notice, upload a circular PDF, or add a screenshot to generate organized tasks automatically.
                </p>
              </div>
              <button
                onClick={onNavigateToCapture}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[var(--accent-primary)] hover:opacity-90 shadow-2xs transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Capture Notice
              </button>
            </div>
          ) : viewMode === 'table' ? (
            <div className="space-y-3.5">
              <TaskTableView
                tasks={displayedTasks}
                onToggleComplete={onToggleComplete}
                onDeleteTask={onDeleteTask}
                vaultDocs={vaultDocs}
              />

              {/* View All Tasks Button */}
              <div className="pt-2 text-center">
                <button
                  onClick={() => setShowAllTasks(!showAllTasks)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-100 dark:bg-[#141f26] hover:bg-slate-200/70 dark:hover:bg-[#1b262d] text-xs font-bold text-slate-700 dark:text-[#8e9fa8] hover:text-slate-900 dark:hover:text-[#e6edf2] transition-colors cursor-pointer"
                >
                  <span>{showAllTasks ? 'Show Active Only' : 'View All Tasks →'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3.5">
              {displayedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onToggleComplete={onToggleComplete}
                  onDelete={onDeleteTask}
                  vaultDocs={vaultDocs}
                />
              ))}

              {/* View All Tasks Button */}
              <div className="pt-2 text-center">
                <button
                  onClick={() => setShowAllTasks(!showAllTasks)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-100 dark:bg-[#141f26] hover:bg-slate-200/70 dark:hover:bg-[#1b262d] text-xs font-bold text-slate-700 dark:text-[#8e9fa8] hover:text-slate-900 dark:hover:text-[#e6edf2] transition-colors cursor-pointer"
                >
                  <span>{showAllTasks ? 'Show Active Only' : 'View All Tasks →'}</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: AI Command Center + Campus Vault + Bottom CTA (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* AI COMMAND CENTER CARD */}
          <div className="bg-white dark:bg-[#1b262d] rounded-3xl p-6 border border-slate-200/60 dark:border-[#23333d]/70 shadow-2xs space-y-4 relative overflow-hidden transition-all">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--accent-light)] text-[var(--accent-primary)] flex items-center justify-center shadow-2xs border border-[var(--accent-light-border)]">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 dark:text-[#e6edf2] text-base">AI Command Center</h3>
                <p className="text-[11px] text-slate-400 dark:text-[#8e9fa8] font-medium">Multimodal Processing Hub</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-[#8e9fa8] leading-relaxed">
              NoticeIQ is continuously syncing deadlines and cross-checking important updates.
            </p>

            {/* Status Line with live dot color & label */}
            <div className="pt-3 border-t border-slate-100 dark:border-[#23333d] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-bold">
                <span className="relative flex h-2.5 w-2.5">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${aiStatus.pingColor} opacity-75`}></span>
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${aiStatus.dotColor}`}></span>
                </span>
                <span className={aiStatus.textColor}>{aiStatus.label}</span>
              </div>
              <button
                onClick={onOpenApiKeyModal}
                className="text-[11px] text-[var(--accent-text)] font-semibold hover:underline cursor-pointer"
              >
                Settings
              </button>
            </div>
          </div>

          {/* CAMPUS VAULT PANEL */}
          <div className="bg-white dark:bg-[#1b262d] rounded-3xl p-6 border border-slate-200/60 dark:border-[#23333d]/70 shadow-2xs space-y-4 transition-all">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#23333d]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[var(--accent-light)] text-[var(--accent-primary)] flex items-center justify-center shadow-2xs border border-[var(--accent-light-border)]">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-[#e6edf2] text-sm">Campus Vault</h3>
                  <p className="text-[11px] text-slate-400 dark:text-[#8e9fa8]">Document Readiness Status</p>
                </div>
              </div>

              <button
                onClick={onNavigateToVault}
                className="text-xs font-bold text-[var(--accent-text)] hover:opacity-80 flex items-center gap-1 group cursor-pointer"
              >
                <span>View All →</span>
              </button>
            </div>

            {/* Overall Cross-Check Status Pill */}
            {allRequiredDocs.length > 0 ? (
              <div className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${
                overallDocReadiness.isAllReady
                  ? 'bg-emerald-50 dark:bg-[#142922] border-emerald-200/70 dark:border-[#1c483a] text-emerald-900 dark:text-emerald-200'
                  : 'bg-amber-50 dark:bg-[#2b2214] border-amber-200/70 dark:border-[#4d3a1d] text-amber-900 dark:text-amber-200'
              }`}>
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-[var(--accent-primary)]" />
                    Notice Document Check
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-white dark:bg-[#1b262d] font-bold text-xs shadow-2xs">
                    {overallDocReadiness.readyCount}/{overallDocReadiness.totalRequired} Ready
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-[#8e9fa8]">
                  {overallDocReadiness.isAllReady
                    ? 'All required documents verified in your Vault.'
                    : `Missing in Vault: ${overallDocReadiness.missingDocs.join(', ')}.`}
                </p>
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-[var(--accent-light)] border border-[var(--accent-light-border)] text-xs text-slate-900 dark:text-[#e6edf2] flex items-center justify-between">
                <span>Active notices document readiness</span>
                <span className="font-bold text-[var(--accent-text)]">100% Prepared</span>
              </div>
            )}

            {/* Document mini items list */}
            <div className="space-y-2">
              {vaultDocs.map((doc) => {
                const isAvailable = doc.status === 'Available';
                return (
                  <div
                    key={doc.id}
                    className="p-2.5 rounded-2xl border border-slate-100 dark:border-[#23333d] bg-slate-50/60 dark:bg-[#141f26] flex items-center justify-between text-xs transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${isAvailable ? 'bg-emerald-500' : 'bg-amber-400'}`}></span>
                      <span className="font-semibold text-slate-800 dark:text-[#e6edf2]">{doc.name}</span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        isAvailable
                          ? 'bg-emerald-100 dark:bg-[#142922] text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-[#1c483a]'
                          : 'bg-amber-100 dark:bg-[#2b2214] text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-[#4d3a1d]'
                      }`}
                    >
                      {isAvailable ? 'Available' : 'Missing'}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 flex items-center justify-center gap-1.5 text-slate-400 dark:text-[#8e9fa8] text-[11px] font-medium border-t border-slate-100 dark:border-[#23333d]">
              <Lock className="w-3 h-3 text-[var(--accent-primary)]" />
              <span>Private Client-Side Locker</span>
            </div>
          </div>

          {/* GMAIL SYNC CARD */}
          <div className="rounded-3xl p-6 bg-white dark:bg-[#1b262d] border border-slate-200/60 dark:border-[#23333d]/70 shadow-2xs space-y-3.5 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-950/40 border border-red-200/60 dark:border-red-900/60 flex items-center justify-center text-red-600 dark:text-red-400 shadow-2xs">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-[#e6edf2]">Gmail Notice Sync</h3>
                    {gmailConnected && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-[#142922] text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-[#1c483a]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Connected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-[#8e9fa8]">
                    {gmailConnected 
                      ? (lastSyncedAt ? `Last checked: ${formatLastSynced(lastSyncedAt)}` : 'Monitors circulars every 5m')
                      : 'Auto-extract notices & deadlines from emails'}
                  </p>
                </div>
              </div>
            </div>

            {syncMessage && (
              <div className={`p-2.5 rounded-xl text-xs flex items-center justify-between ${
                syncMessage.type === 'error'
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50'
                  : 'bg-emerald-50 dark:bg-[#142922] text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-[#1c483a]'
              }`}>
                <span>{syncMessage.text}</span>
                <button onClick={() => setSyncMessage(null)} className="text-xs opacity-70 hover:opacity-100 cursor-pointer ml-2 font-bold">×</button>
              </div>
            )}

            <div className="pt-1">
              {!gmailConnected ? (
                <button
                  id="dashboard-connect-gmail-btn"
                  type="button"
                  onClick={handleConnectGmail}
                  className="w-full py-2.5 px-4 min-h-[44px] rounded-xl bg-[var(--accent-primary)] hover:opacity-90 text-white font-bold text-xs transition-all shadow-2xs active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Connect Gmail</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    id="dashboard-sync-gmail-btn"
                    type="button"
                    onClick={handleManualSync}
                    disabled={isSyncingGmail}
                    className="flex-1 py-2.5 px-4 min-h-[44px] rounded-xl bg-[var(--accent-primary)] hover:opacity-90 text-white font-bold text-xs transition-all shadow-2xs active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingGmail ? 'animate-spin' : ''}`} />
                    <span>{isSyncingGmail ? 'Scanning...' : 'Sync Now'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnectGmail}
                    disabled={isSyncingGmail}
                    title="Disconnect Gmail"
                    className="py-2.5 px-3 min-h-[44px] rounded-xl border border-slate-200 dark:border-[#23333d] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-300 text-xs font-semibold transition-all cursor-pointer"
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* BOTTOM CTA CARD */}
          <div className="rounded-3xl p-6 bg-[var(--bg-sidebar)] text-white shadow-2xs border border-white/10 dark:border-[#1e3d46] space-y-3">
            <div className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-xs flex items-center justify-center text-white border border-white/20 shadow-2xs">
              <Bell className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-extrabold tracking-tight">Stay Ahead, Always</h3>
              <p className="text-xs text-white/80 leading-relaxed">
                Enable smart alerts and never miss critical deadlines.
              </p>
            </div>
            <div className="pt-1">
              <button
                id="dashboard-enable-notifications-btn"
                type="button"
                onClick={handleToggleAlerts}
                disabled={isRegisteringAlerts}
                className="w-full py-2.5 px-4 min-h-[44px] rounded-xl bg-white hover:bg-slate-50 text-slate-900 font-bold text-xs transition-all shadow-2xs active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-75"
              >
                {isRegisteringAlerts ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-slate-800 rounded-full animate-spin" />
                    <span>Subscribing...</span>
                  </>
                ) : alertEnabled ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>Notifications Active</span>
                  </>
                ) : (
                  <span>Enable Notifications</span>
                )}
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
