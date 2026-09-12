import React, { useState, useEffect } from 'react';
import { X, Key, Check, ExternalLink, Eye, EyeOff, ShieldCheck, Bell } from 'lucide-react';
import { getGeminiApiKey, setGeminiApiKey } from '../services/gemini';
import { getGroqApiKey, setGroqApiKey } from '../services/groq';
import { getOneSignalAppId, setOneSignalAppId, initOneSignal } from '../services/notifications';
import { maskApiKey } from '../utils/securityUtils';

export default function ApiKeyModal({ isOpen, onClose, onKeyUpdated }) {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [groqKeyInput, setGroqKeyInput] = useState('');
  const [oneSignalInput, setOneSignalInput] = useState('');
  const [showRawKey, setShowRawKey] = useState(false);
  const [showRawGroqKey, setShowRawGroqKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setApiKeyInput(getGeminiApiKey());
      setGroqKeyInput(getGroqApiKey());
      setOneSignalInput(getOneSignalAppId());
      setSavedSuccess(false);
      setShowRawKey(false);
      setShowRawGroqKey(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const trimmedGemini = apiKeyInput.trim();
      const trimmedGroq = groqKeyInput.trim();
      const trimmedOneSignal = oneSignalInput.trim();

      setGeminiApiKey(trimmedGemini);
      setGroqApiKey(trimmedGroq);
      setOneSignalAppId(trimmedOneSignal);

      if (trimmedOneSignal) {
        initOneSignal().catch((err) => console.warn('[OneSignal] Re-init error:', err));
      }

      setSavedSuccess(true);

      if (onKeyUpdated) {
        await onKeyUpdated(trimmedGemini);
      }

      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 600);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = () => {
    try {
      setApiKeyInput('');
      setGroqKeyInput('');
      setOneSignalInput('');
      setGeminiApiKey('');
      setGroqApiKey('');
      setOneSignalAppId('');
      if (onKeyUpdated) onKeyUpdated('');
    } catch (err) {
      console.error('Failed to clear settings:', err);
    }
  };

  const maskedPreview = maskApiKey(apiKeyInput);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-[#1b262d] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200/70 dark:border-[#23333d] relative space-y-5 animate-popover origin-center max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-[#e6edf2] rounded-xl hover:bg-slate-100 dark:hover:bg-[#141f26] transition-colors cursor-pointer"
          aria-label="Close settings modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[var(--accent-light)] text-[var(--accent-primary)] flex items-center justify-center shadow-2xs border border-[var(--accent-light-border)]">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-[#e6edf2]">System & Integration Settings</h3>
            <p className="text-xs text-slate-500 dark:text-[#8e9fa8]">Configure your AI and Push Notification credentials</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Section 1: OneSignal App ID */}
          <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-[#141f26]/60 border border-slate-200/70 dark:border-[#23333d] space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-[#e6edf2] uppercase tracking-wider">
                <Bell className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                OneSignal App ID
              </label>
              <a
                href="https://dashboard.onesignal.com/"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-[var(--accent-text)] hover:underline flex items-center gap-0.5 font-semibold"
              >
                OneSignal Dashboard <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            <input
              type="text"
              value={oneSignalInput}
              onChange={(e) => setOneSignalInput(e.target.value)}
              placeholder="e.g. 12345678-abcd-1234-abcd-1234567890ab"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200/80 dark:border-[#23333d] bg-white dark:bg-[#141f26] text-slate-900 dark:text-[#e6edf2] focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)] focus:border-[var(--accent-primary)] text-sm font-mono transition-all"
            />
            <p className="text-[11px] text-slate-400 dark:text-[#8e9fa8]">
              Also configurable via <code className="font-mono text-slate-700 dark:text-slate-300">VITE_ONESIGNAL_APP_ID</code> in <code className="font-mono text-slate-700 dark:text-slate-300">.env</code>.
            </p>
          </div>

          {/* Section 2: Gemini API Key */}
          <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-[#141f26]/60 border border-slate-200/70 dark:border-[#23333d] space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-[#e6edf2] uppercase tracking-wider">
                <Key className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                Gemini API Key
              </label>
              {apiKeyInput && (
                <span className="text-[11px] font-mono font-medium text-[var(--accent-text)] bg-[var(--accent-badge-bg)] px-2 py-0.5 rounded-md border border-[var(--accent-light-border)]">
                  {maskedPreview}
                </span>
              )}
            </div>

            <div className="relative">
              <input
                type={showRawKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200/80 dark:border-[#23333d] bg-white dark:bg-[#141f26] text-slate-900 dark:text-[#e6edf2] focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)] focus:border-[var(--accent-primary)] text-sm font-mono transition-all"
              />
              {apiKeyInput && (
                <button
                  type="button"
                  onClick={() => setShowRawKey(!showRawKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-[#e6edf2] cursor-pointer"
                  title={showRawKey ? 'Hide key' : 'Show key'}
                  aria-label={showRawKey ? 'Hide key' : 'Show key'}
                >
                  {showRawKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-[#8e9fa8]">
              <span>Saved locally in browser client</span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[var(--accent-text)] hover:underline flex items-center gap-0.5 font-semibold"
              >
                Get Free API Key <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>

          {/* Section 3: Groq API Key (Text Extraction) */}
          <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-[#141f26]/60 border border-slate-200/70 dark:border-[#23333d] space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-[#e6edf2] uppercase tracking-wider">
                <Key className="w-3.5 h-3.5 text-emerald-500" />
                Groq API Key (Fast Text Extraction)
              </label>
              {groqKeyInput && (
                <span className="text-[11px] font-mono font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                  {maskApiKey(groqKeyInput)}
                </span>
              )}
            </div>

            <div className="relative">
              <input
                type={showRawGroqKey ? 'text' : 'password'}
                value={groqKeyInput}
                onChange={(e) => setGroqKeyInput(e.target.value)}
                placeholder="gsk_..."
                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200/80 dark:border-[#23333d] bg-white dark:bg-[#141f26] text-slate-900 dark:text-[#e6edf2] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-mono transition-all"
              />
              {groqKeyInput && (
                <button
                  type="button"
                  onClick={() => setShowRawGroqKey(!showRawGroqKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-[#e6edf2] cursor-pointer"
                  title={showRawGroqKey ? 'Hide key' : 'Show key'}
                  aria-label={showRawGroqKey ? 'Hide key' : 'Show key'}
                >
                  {showRawGroqKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-[#8e9fa8]">
              <span>Used for instant plain-text extraction</span>
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5 font-semibold"
              >
                Get Groq Key <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>

          {/* Masked Security Note */}
          <div className="p-3 bg-[var(--accent-light)] border border-[var(--accent-light-border)] rounded-2xl text-xs text-slate-900 dark:text-[#e6edf2] space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-[var(--accent-text)]">
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              Client-Side Encrypted / Masked Storage
            </div>
            <p className="text-slate-600 dark:text-[#8e9fa8] leading-relaxed text-[11px]">
              Credentials entered here are saved locally and masked across UI logs. They are used exclusively for NoticeIQ AI extraction and push subscription routing.
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-slate-400 dark:text-[#8e9fa8] hover:text-rose-600 dark:hover:text-rose-400 font-medium transition-colors cursor-pointer"
            >
              Clear Settings
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-[#8e9fa8] hover:bg-slate-100 dark:hover:bg-[#141f26] rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 text-xs font-bold text-white bg-[var(--accent-primary)] hover:opacity-90 rounded-xl shadow-2xs transition-all flex items-center gap-1.5 active:scale-[0.98] cursor-pointer"
              >
                {savedSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> Saved!
                  </>
                ) : (
                  'Save & Verify'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
