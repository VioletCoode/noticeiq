import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, 
  CheckCircle2, 
  Lock, 
  FileText, 
  Sparkles, 
  Layers,
  ExternalLink,
  Plus,
  Edit2,
  Trash2,
  Check,
  Globe,
  Code2,
  Link2,
  UploadCloud,
  Loader2,
  Compass
} from 'lucide-react';
import DigitalStudentId from '../components/DigitalStudentId';
import RoomFinder from '../components/RoomFinder';
import { 
  supabase, 
  fetchProfile, 
  upsertProfile, 
  uploadVaultDocument, 
  deleteVaultDocument 
} from '../services/supabase';

const DEFAULT_PROFILES = [
  {
    id: 'github',
    field: 'github_url',
    name: 'GitHub',
    category: 'Developer Profile',
    url: '',
    iconType: 'github'
  },
  {
    id: 'linkedin',
    field: 'linkedin_url',
    name: 'LinkedIn',
    category: 'Professional Network',
    url: '',
    iconType: 'linkedin'
  },
  {
    id: 'portfolio',
    field: 'portfolio_url',
    name: 'Portfolio / Website',
    category: 'Personal Showcase',
    url: '',
    iconType: 'globe'
  },
  {
    id: 'leetcode',
    field: 'leetcode_url',
    name: 'LeetCode',
    category: 'Competitive Coding',
    url: '',
    iconType: 'code'
  },
  {
    id: 'kaggle',
    field: 'kaggle_url',
    name: 'Kaggle',
    category: 'Data Science & ML',
    url: '',
    iconType: 'code'
  }
];

export default function CampusVault({ 
  vaultDocs = [], 
  tasks = [], 
  userName,
  userEmail,
  onUpdateUserName,
  onDocumentUploaded, 
  onDocumentDeleted 
}) {
  const docInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('Identification');

  // Extract all required documents across active tasks
  const tasksRequiringDocs = tasks.filter(
    (t) => !t.completed && (t.requirements?.length > 0 || t.required_documents?.length > 0)
  );

  // Social & Professional Profiles State
  const [profiles, setProfiles] = useState(DEFAULT_PROFILES);

  // Load profiles from Supabase on mount
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        try {
          const prof = await fetchProfile(user.id);
          if (prof) {
            setProfiles([
              {
                id: 'github',
                field: 'github_url',
                name: 'GitHub',
                category: 'Developer Profile',
                url: prof.github_url || '',
                iconType: 'github'
              },
              {
                id: 'linkedin',
                field: 'linkedin_url',
                name: 'LinkedIn',
                category: 'Professional Network',
                url: prof.linkedin_url || '',
                iconType: 'linkedin'
              },
              {
                id: 'portfolio',
                field: 'portfolio_url',
                name: 'Portfolio / Website',
                category: 'Personal Showcase',
                url: prof.portfolio_url || '',
                iconType: 'globe'
              },
              {
                id: 'leetcode',
                field: 'leetcode_url',
                name: 'LeetCode',
                category: 'Competitive Coding',
                url: prof.leetcode_url || '',
                iconType: 'code'
              },
              {
                id: 'kaggle',
                field: 'kaggle_url',
                name: 'Kaggle',
                category: 'Data Science & ML',
                url: prof.kaggle_url || '',
                iconType: 'code'
              }
            ]);
          }
        } catch (err) {
          console.warn('[NoticeIQ] Error fetching profile social links:', err);
        }
      }
    });
  }, []);

  // Inline editing state: profileId -> editing url
  const [editingId, setEditingId] = useState(null);
  const [tempUrl, setTempUrl] = useState('');

  // URL normalization & validation helper
  const normalizeUrl = (rawUrl) => {
    let trimmed = (rawUrl || '').trim();
    if (!trimmed) return '';
    if (!/^https?:\/\//i.test(trimmed)) {
      trimmed = 'https://' + trimmed;
    }
    return trimmed;
  };

  const handleStartEdit = (profile) => {
    setEditingId(profile.id);
    setTempUrl(profile.url || '');
  };

  const handleSaveEdit = async (profileId) => {
    const finalUrl = normalizeUrl(tempUrl);
    setProfiles((prev) =>
      prev.map((p) => (p.id === profileId ? { ...p, url: finalUrl } : p))
    );
    setEditingId(null);
    setTempUrl('');

    const target = profiles.find((p) => p.id === profileId);
    if (target?.field) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        upsertProfile(user.id, { [target.field]: finalUrl }).catch((err) => {
          console.error('[NoticeIQ] Failed to save profile link:', err);
        });
      }
    }
  };

  const handleRemoveUrl = async (profileId) => {
    setProfiles((prev) =>
      prev.map((p) => (p.id === profileId ? { ...p, url: '' } : p))
    );
    if (editingId === profileId) {
      setEditingId(null);
    }
    const target = profiles.find((p) => p.id === profileId);
    if (target?.field) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        upsertProfile(user.id, { [target.field]: null }).catch(() => {});
      }
    }
  };

  // Real document upload to Supabase Storage
  const handleDocFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const newDoc = await uploadVaultDocument(user.id, file, selectedCategory);
        if (onDocumentUploaded) {
          onDocumentUploaded(newDoc);
        }
      }
    } catch (err) {
      console.error('[NoticeIQ] Document upload failed:', err);
      alert('Failed to upload document to storage: ' + (err.message || 'Unknown error'));
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  // Real document deletion
  const handleDeleteDocument = async (docId, fileUrl) => {
    if (!window.confirm('Delete this document from your private vault?')) return;

    try {
      await deleteVaultDocument(docId, fileUrl);
      if (onDocumentDeleted) {
        onDocumentDeleted(docId);
      }
    } catch (err) {
      console.error('[NoticeIQ] Document deletion failed:', err);
      alert('Failed to delete document: ' + (err.message || 'Unknown error'));
    }
  };

  // Icon renderer based on platform type
  const renderPlatformIcon = (iconType) => {
    switch (iconType) {
      case 'github':
        return (
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
          </svg>
        );
      case 'linkedin':
        return (
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
          </svg>
        );
      case 'code':
        return <Code2 className="w-4 h-4" />;
      case 'globe':
        return <Globe className="w-4 h-4" />;
      default:
        return <Link2 className="w-4 h-4" />;
    }
  };

  const linkedProfilesCount = profiles.filter((p) => Boolean(p.url)).length;

  return (
    <div className="p-3 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6 sm:space-y-8 animate-fade-in">
      {/* Hidden Document File Picker */}
      <input 
        type="file" 
        ref={docInputRef} 
        onChange={handleDocFileSelect} 
        accept=".pdf,.png,.jpg,.jpeg,.webp" 
        className="hidden" 
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 sm:pb-6 border-b border-slate-200/60 dark:border-[#23333d]">
        <div>
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--accent-light)] text-[var(--accent-primary)] flex items-center justify-center shadow-2xs border border-[var(--accent-light-border)] shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-[#e6edf2] tracking-tight">
                Campus Vault
              </h1>
              <p className="text-xs text-slate-500 dark:text-[#8e9fa8] font-medium">
                Verified Document Repository & Compliance Locker
              </p>
            </div>
          </div>
        </div>

        {/* Private by default badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white dark:bg-[#1b262d] border border-slate-200/70 dark:border-[#1e343e] text-xs font-bold text-slate-800 dark:text-[#e6edf2] shadow-2xs self-start md:self-auto">
          <Lock className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          <span>Private by default</span>
        </div>
      </div>

      {/* Info Banner */}
      <div className="p-4 sm:p-5 rounded-3xl bg-[var(--accent-light)] border border-[var(--accent-light-border)] flex items-start gap-3.5 shadow-2xs">
        <Sparkles className="w-5 h-5 text-[var(--accent-primary)] shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-bold text-slate-900 dark:text-[#e6edf2]">
            Automated Notice Cross-Referencing & Profile Hub
          </p>
          <p className="text-slate-600 dark:text-[#8e9fa8] leading-relaxed">
            When you capture a college notice mentioning paperwork or competitive profiles (GitHub, LinkedIn, coding handles), NoticeIQ verifies readiness instantly against your uploaded credentials.
          </p>
        </div>
      </div>

      {/* Digital Student Identity Card Section */}
      <div className="pb-2">
        <DigitalStudentId 
          profiles={profiles} 
          userName={userName}
          userEmail={userEmail}
          onUpdateName={onUpdateUserName}
        />
      </div>

      {/* Section 1: Real Vault Documents Grid */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-[#e6edf2] tracking-tight">
              Vault Documents ({vaultDocs.length} Stored)
            </h2>
            <p className="text-xs text-slate-400 dark:text-[#8e9fa8] font-medium">
              Files stored privately with Per-User Row Level Security
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs font-bold px-2.5 py-2 min-h-[40px] rounded-xl border border-slate-200 dark:border-[#23333d] bg-white dark:bg-[#1b262d] text-slate-700 dark:text-[#e6edf2] outline-none cursor-pointer"
            >
              <option value="Identification">Identification</option>
              <option value="Finance">Finance</option>
              <option value="Academic & Career">Academic & Career</option>
              <option value="Enrollment">Enrollment</option>
              <option value="General">General</option>
            </select>

            <button
              type="button"
              disabled={isUploading}
              onClick={() => docInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-xl text-xs font-bold text-white bg-[var(--accent-primary)] hover:opacity-90 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Upload Document</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Empty state when no documents uploaded */}
        {vaultDocs.length === 0 ? (
          <div className="p-8 rounded-3xl border border-dashed border-slate-300 dark:border-[#23333d] text-center bg-white dark:bg-[#1b262d] space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[var(--accent-light)] text-[var(--accent-primary)] mx-auto flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-800 dark:text-[#e6edf2]">No documents uploaded yet</h3>
              <p className="text-xs text-slate-400 dark:text-[#8e9fa8]">
                Upload your College ID, Fee Receipts, and Certificates so NoticeIQ can verify paperwork requirements.
              </p>
            </div>
            <button
              type="button"
              onClick={() => docInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[var(--accent-primary)] hover:opacity-90 shadow-2xs transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add First Document</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {vaultDocs.map((doc) => {
              const docName = doc.file_name || doc.name || 'Document';

              // Find if any active task needs this document
              const matchedTasks = tasksRequiringDocs.filter((task) => {
                const reqs = task.requirements || task.required_documents || [];
                return reqs.some((reqDoc) =>
                  reqDoc.toLowerCase().includes(docName.toLowerCase()) ||
                  docName.toLowerCase().includes(reqDoc.toLowerCase())
                );
              });

              return (
                <div
                  key={doc.id}
                  className="p-5 rounded-3xl border border-slate-200/60 dark:border-[#23333d]/70 bg-white dark:bg-[#1b262d] shadow-2xs hover:shadow-subtle hover:border-[var(--accent-primary)] transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-10 h-10 rounded-2xl bg-[var(--accent-light)] text-[var(--accent-primary)] border border-[var(--accent-light-border)] flex items-center justify-center shadow-2xs shrink-0">
                        <FileText className="w-5 h-5" />
                      </span>
                      <div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-[#e6edf2] leading-snug line-clamp-1">
                          {docName}
                        </h3>
                        <span className="text-[11px] text-slate-400 dark:text-[#8e9fa8] font-medium">
                          {doc.category || 'General'}
                        </span>
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-[#142922] text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-[#1c483a] shadow-2xs shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Stored
                    </span>
                  </div>

                  {/* Linked Tasks notification */}
                  {matchedTasks.length > 0 && (
                    <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-[#141f26] border border-slate-200/50 dark:border-[#23333d] text-[11px] space-y-1">
                      <div className="flex items-center gap-1 font-bold text-slate-700 dark:text-[#e6edf2]">
                        <Layers className="w-3 h-3 text-[var(--accent-primary)]" />
                        <span>Required by {matchedTasks.length} active task:</span>
                      </div>
                      <div className="truncate text-slate-600 dark:text-[#8e9fa8] font-medium">
                        {matchedTasks.map((t) => t.title || t.task_name).join(', ')}
                      </div>
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="pt-3 border-t border-slate-100 dark:border-[#23333d] flex items-center justify-between">
                    {doc.file_url ? (
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-bold text-[var(--accent-text)] hover:underline"
                      >
                        <span>View / Download</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">Available</span>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteDocument(doc.id, doc.file_url)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title="Delete document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 2: Social & Professional Links (Wired to profiles table) */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-[#e6edf2] tracking-tight">
              Social & Professional Links ({linkedProfilesCount}/{profiles.length} Linked)
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--accent-badge-bg)] text-[var(--accent-badge-text)] border border-[var(--accent-light-border)]">
              Profiles
            </span>
          </div>
        </div>

        {/* Profiles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {profiles.map((profile) => {
            const hasUrl = Boolean(profile.url);
            const isEditing = editingId === profile.id;

            return (
              <div
                key={profile.id}
                className={`p-5 rounded-3xl border transition-all duration-180 bg-white dark:bg-[#1b262d] shadow-2xs hover:shadow-subtle ${
                  hasUrl
                    ? 'border-slate-200/60 dark:border-[#23333d]/70 hover:border-[var(--accent-primary)]'
                    : 'border-dashed border-slate-200 dark:border-[#23333d] hover:border-slate-300'
                }`}
              >
                {/* Header: Platform & Category */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-9 h-9 rounded-full flex items-center justify-center shadow-2xs ${
                        hasUrl
                          ? 'bg-[var(--accent-light)] text-[var(--accent-primary)] border border-[var(--accent-light-border)]'
                          : 'bg-slate-100 dark:bg-[#141f26] text-slate-400 dark:text-[#8e9fa8] border border-slate-200 dark:border-[#23333d]'
                      }`}
                    >
                      {renderPlatformIcon(profile.iconType)}
                    </span>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-[#e6edf2]">
                        {profile.name}
                      </h3>
                      <span className="text-[11px] text-slate-400 dark:text-[#8e9fa8] font-medium">
                        {profile.category}
                      </span>
                    </div>
                  </div>

                  {/* Badge */}
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold shadow-2xs ${
                      hasUrl
                        ? 'bg-emerald-100 dark:bg-[#142922] text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-[#1c483a]'
                        : 'bg-slate-100 dark:bg-[#141f26] text-slate-500 dark:text-[#8e9fa8] border border-slate-200/60 dark:border-[#23333d]'
                    }`}
                  >
                    {hasUrl ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        <span>Linked</span>
                      </>
                    ) : (
                      <span>Not Set</span>
                    )}
                  </span>
                </div>

                {/* Edit Mode vs Display Mode */}
                {isEditing ? (
                  <div className="pt-2 space-y-2 animate-fade-in">
                    <input
                      type="text"
                      value={tempUrl}
                      onChange={(e) => setTempUrl(e.target.value)}
                      placeholder={`Enter ${profile.name} profile URL`}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(profile.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-[var(--accent-primary)] bg-white dark:bg-[#141f26] text-slate-900 dark:text-[#e6edf2] focus:outline-none font-mono"
                    />
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-[#e6edf2]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(profile.id)}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-[var(--accent-primary)] text-white text-xs font-bold rounded-xl hover:opacity-90"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Save</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-slate-100 dark:border-[#23333d] flex items-center justify-between text-xs">
                    {hasUrl ? (
                      <a
                        href={profile.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-[var(--accent-text)] font-mono text-[11px] hover:underline max-w-[240px] flex items-center gap-1"
                      >
                        <span className="truncate">{profile.url.replace(/^https?:\/\//, '')}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">No handle configured</span>
                    )}

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(profile)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-[var(--accent-text)] hover:bg-slate-100 dark:hover:bg-[#141f26] transition-colors cursor-pointer"
                        title="Edit profile link"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {hasUrl && (
                        <button
                          type="button"
                          onClick={() => handleRemoveUrl(profile.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="Clear link"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================== */}
      {/* CAMPUS INFO & DIRECTORY (PUBLIC CAMPUS DATA)              */}
      {/* Visually separated from private vault & ID card sections   */}
      {/* ========================================================== */}
      <div className="pt-8 sm:pt-10 border-t-2 border-slate-200/80 dark:border-[#23333d] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200/60 dark:border-amber-900/60 shadow-2xs shrink-0">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#e6edf2] tracking-tight">
                  Campus Info &amp; Directory
                </h2>
                <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-[#142922] text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-[#1c483a]">
                  Public Directory
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-[#8e9fa8] font-medium">
                Campus-wide room numbers, labs, and facility locations (accessible to all students)
              </p>
            </div>
          </div>
        </div>

        {/* Room Finder Component */}
        <RoomFinder />
      </div>
    </div>
  );
}
