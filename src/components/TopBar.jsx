import React, { useState, useRef, useEffect } from 'react';
import { 
  GraduationCap, 
  Search, 
  Bell, 
  ChevronDown, 
  Check, 
  Edit2,
  Key,
  Moon,
  Sun,
  LogOut
} from 'lucide-react';
import { promptPushSubscription, isPushSubscribed } from '../services/notifications';

export default function TopBar({ 
  userName = 'Student', 
  userRole = 'Student',
  userEmail = '',
  onUpdateUserName,
  onOpenApiKeyModal,
  onOpenSearch,
  onSignOut,
  theme = 'light',
  onToggleTheme,
  notifications = []
}) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(userName);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifState, setNotifState] = useState(() => (isPushSubscribed() ? 'subscribed' : 'idle'));

  const handleEnableNotifications = async () => {
    setNotifState('prompting');
    try {
      const res = await promptPushSubscription();
      if (res?.granted && (res?.subscriptionId || res?.optedIn)) {
        setNotifState('subscribed');
      } else {
        setNotifState('idle');
        if (res?.error) {
          console.error('[TopBar] Push subscription error:', res.error);
        }
      }
    } catch (e) {
      console.error('[TopBar] Push subscription trigger error:', e);
      setNotifState('idle');
      alert(`Could not enable notifications: ${e.message || e}`);
    }
  };

  const profileRef = useRef(null);
  const notifRef = useRef(null);

  // Close popovers on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut listener: Escape to close open popovers
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setIsProfileOpen(false);
        setShowNotifications(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNameSave = () => {
    if (tempName.trim()) {
      onUpdateUserName(tempName.trim());
    }
    setIsEditingName(false);
  };

  const isDark = theme === 'dark';

  return (
    <header className="h-[calc(4rem+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)] bg-white/95 dark:bg-[#152026]/95 backdrop-blur-md border-b border-slate-200/60 dark:border-[#1e2d36]/70 sticky top-0 z-40 px-2 sm:px-4 md:px-8 flex items-center justify-between shadow-2xs rounded-b-2xl md:rounded-b-3xl transition-colors select-none w-full max-w-full overflow-hidden">
      {/* Far Left: Brand / Logo */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-[#18305A] via-[#493C62] to-[#BB81B5] flex items-center justify-center text-white shadow-2xs">
          <GraduationCap className="w-4.5 h-4.5 sm:w-5 sm:h-5" aria-hidden="true" />
        </div>
        <div className="hidden sm:flex items-center gap-1.5">
          <span className="font-extrabold text-lg text-slate-900 dark:text-[#e6edf2] tracking-tight">NoticeIQ</span>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[var(--accent-badge-bg)] text-[var(--accent-badge-text)] border border-[var(--accent-light-border)]">
            AI
          </span>
        </div>
      </div>

      {/* Centered: Search Input Trigger Button (Opens Popup Search Modal) */}
      <div className="flex-1 min-w-0 max-w-md mx-1.5 sm:mx-4 md:mx-8">
        <button
          id="topbar-search-trigger-btn"
          type="button"
          onClick={() => {
            if (onOpenSearch) onOpenSearch();
          }}
          className="w-full flex items-center justify-between px-2.5 sm:px-4 py-1.5 sm:py-2 min-h-[36px] sm:min-h-[40px] rounded-full bg-slate-100/80 dark:bg-[#1b262d] hover:bg-slate-200/70 dark:hover:bg-[#23333d] active:scale-95 border border-slate-200/60 dark:border-[#23333d]/80 text-xs sm:text-sm text-slate-500 dark:text-[#8e9fa8] transition-all group shadow-2xs cursor-pointer text-left"
          title="Search notices, documents, and tasks (Ctrl + /)"
          aria-label="Open search popup"
        >
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--accent-primary)] shrink-0 group-hover:scale-105 transition-transform" aria-hidden="true" />
            <span className="truncate hidden sm:inline">Search notices, tasks, documents...</span>
            <span className="truncate sm:hidden text-xs">Search notices...</span>
          </div>

          <div className="hidden sm:flex items-center gap-1 shrink-0 ml-2">
            <kbd className="px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-[#8e9fa8] bg-white dark:bg-[#152026] border border-slate-200/70 dark:border-[#23333d] rounded-md shadow-2xs">
              Ctrl /
            </kbd>
          </div>
        </button>
      </div>

      {/* Right Side: Single 1-Click Theme Toggle Button + Notification Bell + User Profile Chip */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        
        {/* Single Theme Toggle Button (Moon in Light mode -> switches to dark; Sun in Dark mode -> switches to light) */}
        <button
          id="theme-toggle-btn"
          type="button"
          onClick={onToggleTheme}
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-100/80 dark:bg-[#1b262d] hover:bg-slate-200/80 dark:hover:bg-[#23333d] active:scale-90 text-slate-700 dark:text-[#e6edf2] flex items-center justify-center transition-all border border-slate-200/60 dark:border-[#23333d] cursor-pointer shrink-0"
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-amber-400 animate-fade-in" aria-hidden="true" />
          ) : (
            <Moon className="w-4 h-4 text-[var(--accent-primary)] animate-fade-in" aria-hidden="true" />
          )}
        </button>

        {/* Manual Enable Notifications Trigger Button (Desktop/Tablet Only) */}
        <button
          id="enable-notifications-btn"
          type="button"
          onClick={handleEnableNotifications}
          disabled={notifState === 'prompting'}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200/80 dark:border-teal-800/80 hover:bg-teal-100 dark:hover:bg-teal-900/60 transition-all shadow-2xs cursor-pointer active:scale-95 disabled:opacity-60 shrink-0"
          title="Enable OneSignal Push Notifications"
          aria-label="Enable Notifications"
        >
          <Bell className={`w-3.5 h-3.5 text-teal-600 dark:text-teal-400 ${notifState === 'prompting' ? 'animate-bounce' : ''}`} />
          <span>
            {notifState === 'subscribed'
              ? 'Notifications Active'
              : notifState === 'prompting'
              ? 'Enabling...'
              : 'Enable Notifications'}
          </span>
        </button>

        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            id="notifications-toggle-btn"
            type="button"
            onClick={() => setShowNotifications(!showNotifications)}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-100/80 dark:bg-[#1b262d] hover:bg-slate-200/80 dark:hover:bg-[#23333d] text-slate-600 dark:text-[#8e9fa8] flex items-center justify-center transition-colors relative border border-slate-200/60 dark:border-[#23333d] cursor-pointer shrink-0"
            title="Notifications"
            aria-label="View notifications"
          >
            <Bell className="w-4 h-4" aria-hidden="true" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#152026]"></span>
          </button>

          {/* Notification dropdown popover */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-1.5rem)] bg-white dark:bg-[#1b262d] rounded-2xl p-4 shadow-xl border border-slate-200/70 dark:border-[#23333d] z-50 text-xs space-y-2.5 animate-popover origin-top-right">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[#23333d] font-bold text-slate-800 dark:text-[#e6edf2]">
                <span>Notifications</span>
                {notifications.length > 0 ? (
                  <span className="text-[10px] text-[var(--accent-badge-text)] bg-[var(--accent-badge-bg)] px-2 py-0.5 rounded-full font-semibold border border-[var(--accent-light-border)]">
                    {notifications.length} New
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 font-normal">All caught up</span>
                )}
              </div>

              {notifications.length > 0 ? (
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {notifications.map((notif, idx) => (
                    <div key={notif.id || idx} className="p-2.5 rounded-xl bg-[var(--accent-light)] border border-[var(--accent-light-border)] flex items-start gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)] mt-1.5 shrink-0"></span>
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-[#e6edf2]">
                          {notif.tasks?.title || notif.tasks?.task_name || notif.title || 'Upcoming Deadline'}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-[#8e9fa8] mt-0.5">
                          {notif.fire_time ? `Alert set for: ${new Date(notif.fire_time).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : 'Due soon'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-slate-400 dark:text-[#8e9fa8] text-xs">
                  No pending deadline alerts
                </div>
              )}
              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => setShowNotifications(false)}
                  className="text-[11px] text-slate-400 dark:text-[#8e9fa8] hover:text-[var(--accent-text)] font-medium cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Chip */}
        <div className="relative shrink-0" ref={profileRef}>
          <button
            id="profile-menu-btn"
            type="button"
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-1.5 sm:gap-2 pl-1 sm:pl-1.5 pr-2 sm:pr-3 py-1 min-h-[34px] sm:min-h-[38px] rounded-full bg-slate-100/80 dark:bg-[#1b262d] hover:bg-slate-200/80 dark:hover:bg-[#23333d] border border-slate-200/60 dark:border-[#23333d] transition-all group cursor-pointer shrink-0"
            aria-label="Open profile settings"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#18305A] via-[#493C62] to-[#BB81B5] text-white flex items-center justify-center font-bold text-xs shadow-2xs">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="text-left hidden md:block leading-tight">
              <span className="block text-xs font-bold text-slate-900 dark:text-[#e6edf2] group-hover:text-[var(--accent-text)]">
                {userName}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-[#8e9fa8] font-medium">{userRole}</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-transform" aria-hidden="true" />
          </button>

          {/* Profile Dropdown Menu */}
          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-1.5rem)] bg-white dark:bg-[#1b262d] rounded-2xl p-3 shadow-xl border border-slate-200/70 dark:border-[#23333d] z-50 text-xs space-y-2 animate-popover origin-top-right">
              <div className="p-2 border-b border-slate-100 dark:border-[#23333d]">
                {isEditingName ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
                      className="w-full px-2 py-1 text-xs border rounded-lg border-[var(--accent-primary)] bg-white dark:bg-[#152026] text-slate-900 dark:text-[#e6edf2] outline-none"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleNameSave}
                      className="p-1 bg-[var(--accent-primary)] text-white rounded-md hover:opacity-90 cursor-pointer"
                      aria-label="Save name"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-[#e6edf2]">{userName}</p>
                      <p className="text-[11px] text-slate-400 dark:text-[#8e9fa8]">{userRole} Account</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setTempName(userName);
                        setIsEditingName(true);
                      }}
                      className="p-1 text-slate-400 hover:text-[var(--accent-text)] rounded cursor-pointer"
                      title="Edit Name"
                      aria-label="Edit user name"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {onOpenApiKeyModal && (
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    onOpenApiKeyModal();
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-[#e6edf2] hover:bg-[var(--accent-light)] hover:text-[var(--accent-text)] font-medium transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Key className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>Gemini API Settings</span>
                </button>
              )}

              {onSignOut && (
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    onSignOut();
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-medium transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsProfileOpen(false)}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-slate-500 dark:text-[#8e9fa8] hover:bg-slate-50 dark:hover:bg-[#141f26] text-[11px] cursor-pointer"
              >
                Close Menu
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
