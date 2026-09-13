import React, { useState, useEffect, useCallback } from 'react';
import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import MobileNav from './components/MobileNav';
import SearchModal from './components/SearchModal';
import Dashboard from './screens/Dashboard';
import CampusIdScreen from './screens/CampusIdScreen';
import Capture from './screens/Capture';
import CampusVault from './screens/CampusVault';
import CalendarScreen from './screens/CalendarScreen';
import AnalyticsScreen from './screens/AnalyticsScreen';
import AuthScreen from './screens/AuthScreen';
import ApiKeyModal from './components/ApiKeyModal';
import { checkApiKeyStatus } from './services/gemini';
import { initOneSignal } from './services/notifications';
import { 
  supabase, 
  getCurrentSession, 
  signOutUser,
  fetchTasks, 
  createTask, 
  updateTask, 
  deleteTask, 
  clearAllUserTasks,
  createNotice,
  fetchDocuments,
  fetchProfile,
  upsertProfile,
  fetchUpcomingReminders
} from './services/supabase';
import { GraduationCap, AlertTriangle, X, CheckCircle2 } from 'lucide-react';
import PublicVerifyScreen from './components/PublicVerifyScreen';
import { exchangeGmailOAuthCode, getGmailConnectionStatus, syncGmail } from './services/gmail';

const THEME_KEY = 'noticeiq_theme';

export default function App() {
  // Public Verification Route detection: /verify/:studentId or /profile/:studentId or ?verify=:studentId
  const [verifyStudentId, setVerifyStudentId] = useState(() => {
    try {
      const path = window.location.pathname;
      if (path.startsWith('/verify/') || path.startsWith('/profile/')) {
        const id = path.split('/')[2];
        if (id) return decodeURIComponent(id);
      }
      const params = new URLSearchParams(window.location.search);
      const queryId = params.get('verify') || params.get('profile');
      if (queryId) return decodeURIComponent(queryId);
    } catch {}
    return null;
  });

  // Listen to popstate for URL history back/forward
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.startsWith('/verify/') || path.startsWith('/profile/')) {
        const id = path.split('/')[2];
        if (id) setVerifyStudentId(decodeURIComponent(id));
      } else {
        const params = new URLSearchParams(window.location.search);
        const queryId = params.get('verify') || params.get('profile');
        setVerifyStudentId(queryId ? decodeURIComponent(queryId) : null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Navigation State: 'campus-id' | 'dashboard' | 'capture' | 'vault' | 'calendar' | 'analytics'
  const [activeTab, setActiveTab] = useState('campus-id');

  // Supabase Auth State
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Theme State: 'light' | 'dark'
  const [theme, setTheme] = useState(() => {
    try {
      const savedTheme = localStorage.getItem(THEME_KEY);
      if (savedTheme === 'dark' || savedTheme === 'light') {
        return savedTheme;
      }
      return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    } catch {
      return 'light';
    }
  });

  // Sync theme with <html> classList and localStorage
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  // Toggle light/dark theme on 1 click
  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Search Modal state
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  // Tasks State (synced with Supabase)
  const [tasks, setTasks] = useState([]);

  // User Profile & Name state
  const [userName, setUserName] = useState('Student');

  // Vault documents state (synced with Supabase documents table)
  const [vaultDocs, setVaultDocs] = useState([]);

  // Live scheduled reminders
  const [reminders, setReminders] = useState([]);
  const [saveError, setSaveError] = useState(null);

  // Gemini API Key state & modal
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState('missing');

  // Check API Key Status on initial mount
  const refreshApiKeyStatus = useCallback(async (customKey = null) => {
    const status = await checkApiKeyStatus(customKey);
    setApiKeyStatus(status);
  }, []);

  useEffect(() => {
    refreshApiKeyStatus();
  }, [refreshApiKeyStatus]);

  // Initialize and listen to Supabase Auth session
  useEffect(() => {
    let mounted = true;

    getCurrentSession()
      .then((sess) => {
        if (mounted) {
          setSession(sess);
          setAuthLoading(false);
        }
      })
      .catch((err) => {
        console.warn('[NoticeIQ] Failed to get session:', err);
        if (mounted) setAuthLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (mounted) {
        setSession(sess);
        setAuthLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  // Fetch or Seed user data from Supabase once logged in
  useEffect(() => {
    if (!session?.user?.id) {
      setTasks([]);
      return;
    }

    const userId = session.user.id;
    let isSubscribed = true;

    async function loadUserData() {
      try {
        // 0. Initialize OneSignal Push & PWA
        initOneSignal(userId).catch(() => {});

        // 1. Fetch Profile
        const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
        const profile = await fetchProfile(userId);
        if (profile && isSubscribed) {
          if (profile.name) {
            setUserName(profile.name);
          } else if (profile.full_name) {
            setUserName(profile.full_name);
          }
          if (!profile.timezone) {
            upsertProfile(userId, { timezone: localTz }).catch(() => {});
          }
        } else if (isSubscribed) {
          const fallbackName = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Student';
          setUserName(fallbackName);
          upsertProfile(userId, { name: fallbackName, timezone: localTz }).catch(() => {});
        }

        // 2. Fetch Tasks
        const dbTasks = await fetchTasks(userId);
        if (isSubscribed) {
          setTasks(dbTasks || []);
        }

        // 3. Fetch Vault Documents
        const dbVaultDocs = await fetchDocuments(userId);
        if (isSubscribed) {
          setVaultDocs(dbVaultDocs || []);
        }

        // 4. Fetch Reminders
        const dbReminders = await fetchUpcomingReminders(userId);
        if (isSubscribed) {
          setReminders(dbReminders || []);
        }
      } catch (err) {
        console.error('[NoticeIQ] Error loading Supabase data:', err);
      }
    }

    loadUserData();

    return () => {
      isSubscribed = false;
    };
  }, [session?.user?.id]);

  const [gmailNotice, setGmailNotice] = useState(null);

  // Helper to refresh tasks and reminders
  const handleRefreshUserData = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const [updatedTasks, updatedReminders] = await Promise.all([
        fetchTasks(session.user.id),
        fetchUpcomingReminders(session.user.id)
      ]);
      if (updatedTasks) setTasks(updatedTasks);
      if (updatedReminders) setReminders(updatedReminders);
    } catch (err) {
      console.warn('[NoticeIQ] Error refreshing tasks/reminders:', err);
    }
  }, [session?.user?.id]);

  // Gmail OAuth Callback detection & initial sync
  useEffect(() => {
    const handleGmailCallback = async () => {
      const path = window.location.pathname;
      const search = window.location.search;
      const params = new URLSearchParams(search);
      const code = params.get('code');
      const state = params.get('state');

      if ((path.includes('/gmail-callback') || path.includes('/auth/callback/gmail') || path.startsWith('/auth/callback')) && code) {
        try {
          const redirectUri = `${window.location.origin}${path.includes('/auth/callback/gmail') ? '/auth/callback/gmail' : '/gmail-callback'}`;
          const result = await exchangeGmailOAuthCode(code, redirectUri);

          // Clean URL back to dashboard
          window.history.replaceState({}, document.title, '/');
          setActiveTab('dashboard');

          if (result.success) {
            setGmailNotice({
              type: 'success',
              message: 'Gmail connected successfully! Automated 5-minute background monitoring is now active.'
            });

            const targetUserId = session?.user?.id || state;
            if (targetUserId) {
              syncGmail(targetUserId).then(async (syncRes) => {
                if (syncRes.success) {
                  await handleRefreshUserData();
                }
              }).catch((e) => console.warn('[NoticeIQ] Initial sync error:', e));
            }
          } else {
            setGmailNotice({
              type: 'error',
              message: `Failed to connect Gmail: ${result.error || 'Token exchange failed'}`
            });
          }
        } catch (err) {
          window.history.replaceState({}, document.title, '/');
          setGmailNotice({
            type: 'error',
            message: `Gmail authorization error: ${err.message}`
          });
        }
      }
    };

    handleGmailCallback();
  }, [session?.user?.id, handleRefreshUserData]);

  // Background Gmail Polling every 5 minutes
  useEffect(() => {
    if (!session?.user?.id) return;
    const userId = session.user.id;

    const pollGmail = async () => {
      try {
        const status = await getGmailConnectionStatus(userId);
        if (status.isConnected) {
          console.log('[NoticeIQ] Polling Gmail sync for user:', userId);
          const syncRes = await syncGmail(userId);
          if (syncRes.success && syncRes.data?.tasksCreated > 0) {
            console.log(`[NoticeIQ] Background sync created ${syncRes.data.tasksCreated} new tasks.`);
            await handleRefreshUserData();
          }
        }
      } catch (err) {
        console.warn('[NoticeIQ] Gmail background sync poll error:', err);
      }
    };

    // Run every 5 minutes (300,000 ms)
    const intervalId = setInterval(pollGmail, 5 * 60 * 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [session?.user?.id, handleRefreshUserData]);

  // Persist user name in Supabase
  const handleUpdateUserName = async (newName) => {
    setUserName(newName);
    if (session?.user?.id) {
      try {
        await upsertProfile(session.user.id, { name: newName });
      } catch (e) {
        console.error('[NoticeIQ] Failed to save profile name:', e);
      }
    }
  };

  // Add new task & persist to Supabase (with notice reference)
  const handleTaskCreated = async (newTask) => {
    setSaveError(null);
    console.log('[NoticeIQ ManualTask] 3. handleTaskCreated received task:', {
      taskId: newTask.id,
      title: newTask.title || newTask.task_name,
      deadline: newTask.deadline,
      userId: session?.user?.id
    });

    // Instant optimistic state update
    setTasks((prev) => [newTask, ...prev]);
    setActiveTab('dashboard');

    if (session?.user?.id) {
      try {
        let noticeId = null;
        if (newTask.rawNotice) {
          try {
            const savedNotice = await createNotice(
              session.user.id, 
              newTask.rawNotice.raw_text, 
              newTask.rawNotice.source_type
            );
            noticeId = savedNotice?.id;
          } catch (noticeErr) {
            console.warn('[NoticeIQ] Could not create notice record:', noticeErr);
          }
        }

        const taskWithNotice = { ...newTask, notice_id: noticeId };
        const saved = await createTask(session.user.id, taskWithNotice);

        console.log('[NoticeIQ ManualTask] 6. Task successfully persisted to Supabase database:', saved);

        // Sync generated DB id
        setTasks((prev) => prev.map((t) => (t.id === newTask.id ? saved : t)));

        // Refresh reminders
        fetchUpcomingReminders(session.user.id).then((r) => setReminders(r || [])).catch(() => {});
      } catch (err) {
        console.error('[NoticeIQ ManualTask] Error saving new task to Supabase:', err);
        // Revert optimistic state so the user is not misled
        setTasks((prev) => prev.filter((t) => t.id !== newTask.id));
        setSaveError(`Failed to save "${newTask.title || newTask.task_name}": ${err.message || 'Database insert error'}. Please check your connection or date format.`);
      }
    } else {
      console.warn('[NoticeIQ] User not logged in, task kept only in temporary session state');
    }
  };

  // Toggle completed state & persist to Supabase
  const handleToggleComplete = async (taskId) => {
    const targetTask = tasks.find((t) => t.id === taskId);
    if (!targetTask) return;

    const newCompleted = !targetTask.completed;

    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, completed: newCompleted } : t))
    );

    if (session?.user?.id) {
      try {
        await updateTask(taskId, { completed: newCompleted });
        // Refresh live reminders so completed task reminders don't clutter notifications
        fetchUpcomingReminders(session.user.id).then((r) => setReminders(r || [])).catch(() => {});
      } catch (err) {
        console.error('[NoticeIQ] Error updating task complete state in Supabase:', err);
      }
    }
  };

  // Delete individual task & persist to Supabase
  const handleDeleteTask = async (taskId) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    if (session?.user?.id) {
      try {
        await deleteTask(taskId);
      } catch (err) {
        console.error('[NoticeIQ] Error deleting task from Supabase:', err);
      }
    }
  };

  // Clear All Data in Supabase
  const handleClearAllData = async () => {
    const confirmed = window.confirm('This will delete all your tasks from Supabase. Continue?');
    if (confirmed) {
      setTasks([]);
      if (session?.user?.id) {
        try {
          await clearAllUserTasks(session.user.id);
        } catch (err) {
          console.error('[NoticeIQ] Error clearing tasks in Supabase:', err);
        }
      }
    }
  };

  // Sign out handler
  const handleSignOut = async () => {
    try {
      await signOutUser();
      setSession(null);
      setTasks([]);
    } catch (err) {
      console.error('[NoticeIQ] Sign out error:', err);
    }
  };

  // Handle API Key updated from modal
  const handleKeyUpdated = async (key) => {
    await refreshApiKeyStatus(key);
  };

  // Public Verification Screen (Accessible to any scanner without requiring login)
  if (verifyStudentId) {
    return (
      <PublicVerifyScreen 
        studentId={verifyStudentId}
        onGoToDashboard={() => {
          window.history.pushState({}, '', '/');
          setVerifyStudentId(null);
        }}
      />
    );
  }

  // Loading Screen while verifying session
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex flex-col items-center justify-center text-slate-900 dark:text-[#e6edf2] font-sans">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-12 h-12 rounded-2xl bg-[var(--accent-primary)] flex items-center justify-center text-white shadow-lg animate-pulse">
            <GraduationCap className="w-7 h-7" />
          </div>
          <div className="text-center space-y-1">
            <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-[#e6edf2]">
              NoticeIQ
            </h2>
            <p className="text-xs text-slate-400 dark:text-[#8e9fa8]">
              Connecting to secure campus cloud...
            </p>
          </div>
          <div className="w-6 h-6 border-2 border-[var(--accent-primary)]/20 border-t-[var(--accent-primary)] rounded-full animate-spin mt-2" />
        </div>
      </div>
    );
  }

  // Gate all views behind Supabase Auth
  if (!session) {
    return (
      <AuthScreen
        onAuthSuccess={(newSession) => setSession(newSession)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)] flex flex-col text-slate-900 dark:text-[#e6edf2] selection:bg-[var(--accent-badge-bg)] selection:text-[var(--accent-text)] font-sans">
      {/* Top Bar with Single 1-Click Theme Toggle & Profile Menu */}
      <TopBar
        userName={userName}
        userRole="Student"
        userEmail={session?.user?.email || ''}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenSearch={() => setIsSearchModalOpen(true)}
        onUpdateUserName={handleUpdateUserName}
        onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
        onSignOut={handleSignOut}
        notifications={reminders}
      />

      <div className="flex-1 flex flex-col md:flex-row">
        {/* Left Sidebar (Desktop / Tablet) */}
        <div className="hidden md:block">
          <Sidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            taskCount={tasks.filter((t) => !t.completed).length}
            apiKeyStatus={apiKeyStatus}
            onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
            onClearAllData={handleClearAllData}
          />
        </div>

        {/* Main Content Area with Smooth Page Transition & Safe-Area Padding */}
        <main className="flex-1 min-h-[calc(100vh-4rem)] overflow-y-auto pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))] md:pb-8">
          {gmailNotice && (
            <div className={`m-4 p-4 rounded-2xl border text-xs flex items-center justify-between gap-3 shadow-xs animate-slide-down ${
              gmailNotice.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200'
                : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-200'
            }`}>
              <div className="flex items-center gap-2">
                {gmailNotice.type === 'error' ? (
                  <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                )}
                <span className="font-semibold">{gmailNotice.message}</span>
              </div>
              <button
                onClick={() => setGmailNotice(null)}
                className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {saveError && (
            <div className="m-4 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between gap-3 shadow-xs animate-slide-down">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span className="font-semibold">{saveError}</span>
              </div>
              <button
                onClick={() => setSaveError(null)}
                className="p-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <div key={activeTab} className="animate-page-fade">
            {activeTab === 'campus-id' && (
              <CampusIdScreen
                userName={userName}
                userEmail={session?.user?.email}
                onUpdateUserName={handleUpdateUserName}
                onNavigateToDashboard={() => setActiveTab('dashboard')}
                onNavigateToCapture={() => setActiveTab('capture')}
                onNavigateToVault={() => setActiveTab('vault')}
                tasks={tasks}
                vaultDocs={vaultDocs}
              />
            )}

            {activeTab === 'dashboard' && (
              <Dashboard
                tasks={tasks}
                apiKeyStatus={apiKeyStatus}
                onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
                onToggleComplete={handleToggleComplete}
                onDeleteTask={handleDeleteTask}
                onClearAllData={handleClearAllData}
                onNavigateToCapture={() => setActiveTab('capture')}
                onNavigateToVault={() => setActiveTab('vault')}
                vaultDocs={vaultDocs}
                userName={userName}
                onUpdateUserName={handleUpdateUserName}
                userId={session?.user?.id}
                onRefreshTasks={handleRefreshUserData}
              />
            )}

            {activeTab === 'capture' && (
              <Capture
                onTaskCreated={handleTaskCreated}
                onCancel={() => setActiveTab('dashboard')}
              />
            )}

            {activeTab === 'vault' && (
              <CampusVault 
                vaultDocs={vaultDocs} 
                tasks={tasks}
                userName={userName}
                userEmail={session?.user?.email}
                onUpdateUserName={handleUpdateUserName}
                onDocumentUploaded={(newDoc) => setVaultDocs((prev) => [newDoc, ...prev])}
                onDocumentDeleted={(deletedId) => setVaultDocs((prev) => prev.filter((d) => d.id !== deletedId))}
              />
            )}

            {activeTab === 'calendar' && (
              <CalendarScreen
                tasks={tasks}
                onNavigateToCapture={() => setActiveTab('capture')}
              />
            )}

            {activeTab === 'analytics' && (
              <AnalyticsScreen
                tasks={tasks}
                vaultDocs={vaultDocs}
              />
            )}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <MobileNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        taskCount={tasks.filter((t) => !t.completed).length}
        onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
        onClearAllData={handleClearAllData}
      />

      {/* Search Modal Overlay */}
      <SearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        tasks={tasks}
        vaultDocs={vaultDocs}
        onSelectTask={() => {
          setActiveTab('dashboard');
        }}
        onSelectDoc={() => {
          setActiveTab('vault');
        }}
      />

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        onKeyUpdated={handleKeyUpdated}
      />
    </div>
  );
}
