import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  User,
  GraduationCap,
  Hash,
  FileText,
  UploadCloud,
  Trash2,
  Loader2,
  Check,
  ExternalLink,
  ShieldCheck,
  Edit3
} from 'lucide-react';
import {
  supabase,
  upsertProfile,
  fetchDocuments,
  uploadVaultDocument,
  deleteVaultDocument
} from '../services/supabase';

export default function EditProfileModal({
  isOpen,
  onClose,
  initialData = {},
  onProfileSaved
}) {
  const [formData, setFormData] = useState({
    name: initialData.name || '',
    department: initialData.department || '',
    studentId: initialData.studentId || '',
    githubUrl: initialData.githubUrl || '',
    linkedinUrl: initialData.linkedinUrl || ''
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Vault Documents State
  const [docs, setDocs] = useState([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('Identification');
  const fileInputRef = useRef(null);

  // Sync initialData when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: initialData.name || '',
        department: initialData.department || 'Computer Science & Engineering',
        studentId: initialData.studentId || '',
        githubUrl: initialData.githubUrl || '',
        linkedinUrl: initialData.linkedinUrl || ''
      });
      setSaveSuccess(false);

      // Load user documents
      async function loadDocs() {
        setIsLoadingDocs(true);
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const userDocs = await fetchDocuments(user.id);
            setDocs(userDocs || []);
          }
        } catch (err) {
          console.warn('[NoticeIQ EditProfile] Failed to load documents:', err);
        } finally {
          setIsLoadingDocs(false);
        }
      }
      loadDocs();
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const normalizeUrl = (rawUrl) => {
    let trimmed = (rawUrl || '').trim();
    if (!trimmed) return '';
    if (!/^https?:\/\//i.test(trimmed)) {
      trimmed = 'https://' + trimmed;
    }
    return trimmed;
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User is not authenticated');

      const cleanName = formData.name.trim();
      const cleanDept = formData.department.trim();
      const cleanId = formData.studentId.trim();
      const normalizedGh = normalizeUrl(formData.githubUrl);
      const normalizedLi = normalizeUrl(formData.linkedinUrl);

      const payload = {
        name: cleanName,
        department: cleanDept,
        student_id: cleanId,
        github_url: normalizedGh || null,
        linkedin_url: normalizedLi || null
      };

      await upsertProfile(user.id, payload);

      setSaveSuccess(true);
      if (onProfileSaved) {
        onProfileSaved({
          name: cleanName,
          department: cleanDept,
          studentId: cleanId,
          githubUrl: normalizedGh,
          linkedinUrl: normalizedLi
        });
      }

      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err) {
      console.error('[NoticeIQ EditProfile] Error saving profile:', err);
      alert('Failed to save profile changes: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  // Upload document to Vault
  const handleDocFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingDoc(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const newDoc = await uploadVaultDocument(user.id, file, selectedCategory);
        setDocs((prev) => [newDoc, ...prev]);
      }
    } catch (err) {
      console.error('[NoticeIQ EditProfile] Document upload failed:', err);
      alert('Failed to upload document: ' + (err.message || 'Unknown error'));
    } finally {
      setIsUploadingDoc(false);
      e.target.value = '';
    }
  };

  // Delete document from Vault
  const handleDeleteDoc = async (docId, fileUrl) => {
    if (!window.confirm('Delete this document from your vault?')) return;

    try {
      await deleteVaultDocument(docId, fileUrl);
      setDocs((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      console.error('[NoticeIQ EditProfile] Document deletion failed:', err);
      alert('Failed to delete document: ' + (err.message || 'Unknown error'));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-[#1b262d] rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200/70 dark:border-[#23333d] relative space-y-6 animate-popover origin-center max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-[#e6edf2] rounded-xl hover:bg-slate-100 dark:hover:bg-[#141f26] transition-colors cursor-pointer"
          aria-label="Close edit profile modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 pr-8">
          <div className="w-10 h-10 rounded-2xl bg-[var(--accent-light)] text-[var(--accent-primary)] flex items-center justify-center shadow-2xs border border-[var(--accent-light-border)] shrink-0">
            <Edit3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-[#e6edf2]">
              Edit Student Profile
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#8e9fa8]">
              Update your Digital Campus ID credentials, social links & vault files
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          {/* Section 1: Academic & Identity Fields */}
          <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-[#141f26]/60 border border-slate-200/70 dark:border-[#23333d] space-y-3.5">
            <h4 className="text-xs font-bold text-slate-700 dark:text-[#e6edf2] uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>Campus Identity Details</span>
            </h4>

            {/* Full Name */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-[#8e9fa8] flex items-center gap-1">
                <User className="w-3 h-3" />
                <span>Full Name</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g. Alex Johnson"
                className="w-full px-3 py-2 rounded-xl border border-slate-200/80 dark:border-[#23333d] bg-white dark:bg-[#141f26] text-slate-900 dark:text-[#e6edf2] focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)] text-xs font-medium transition-all"
              />
            </div>

            {/* Department & Student ID Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Department */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-[#8e9fa8] flex items-center gap-1">
                  <GraduationCap className="w-3 h-3" />
                  <span>Department / Program</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.department}
                  onChange={(e) => handleChange('department', e.target.value)}
                  placeholder="e.g. Computer Science & Engineering"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200/80 dark:border-[#23333d] bg-white dark:bg-[#141f26] text-slate-900 dark:text-[#e6edf2] focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)] text-xs font-medium transition-all"
                />
              </div>

              {/* Student ID */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-[#8e9fa8] flex items-center gap-1">
                  <Hash className="w-3 h-3" />
                  <span>Student ID / Roll No</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.studentId}
                  onChange={(e) => handleChange('studentId', e.target.value)}
                  placeholder="e.g. CS-2024-8942"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200/80 dark:border-[#23333d] bg-white dark:bg-[#141f26] text-slate-900 dark:text-[#e6edf2] focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)] text-xs font-mono font-medium transition-all"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Social & Professional Links */}
          <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-[#141f26]/60 border border-slate-200/70 dark:border-[#23333d] space-y-3.5">
            <h4 className="text-xs font-bold text-slate-700 dark:text-[#e6edf2] uppercase tracking-wider flex items-center gap-1.5">
              <span>Social & Developer Handles</span>
            </h4>

            {/* GitHub URL */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-[#8e9fa8] flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 fill-current text-[var(--accent-primary)]" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                <span>GitHub Profile URL</span>
              </label>
              <input
                type="text"
                value={formData.githubUrl}
                onChange={(e) => handleChange('githubUrl', e.target.value)}
                placeholder="https://github.com/yourhandle"
                className="w-full px-3 py-2 rounded-xl border border-slate-200/80 dark:border-[#23333d] bg-white dark:bg-[#141f26] text-slate-900 dark:text-[#e6edf2] focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)] text-xs font-mono transition-all"
              />
            </div>

            {/* LinkedIn URL */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-[#8e9fa8] flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 fill-current text-[var(--accent-primary)]" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                </svg>
                <span>LinkedIn Profile URL</span>
              </label>
              <input
                type="text"
                value={formData.linkedinUrl}
                onChange={(e) => handleChange('linkedinUrl', e.target.value)}
                placeholder="https://linkedin.com/in/yourhandle"
                className="w-full px-3 py-2 rounded-xl border border-slate-200/80 dark:border-[#23333d] bg-white dark:bg-[#141f26] text-slate-900 dark:text-[#e6edf2] focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)] text-xs font-mono transition-all"
              />
            </div>
          </div>

          {/* Section 3: Campus Vault Documents */}
          <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-[#141f26]/60 border border-slate-200/70 dark:border-[#23333d] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-slate-700 dark:text-[#e6edf2] uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>Vault Documents ({docs.length})</span>
                </h4>
                <p className="text-[10px] text-slate-400 dark:text-[#8e9fa8]">
                  Certificates, Fee Receipts & College IDs
                </p>
              </div>

              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="text-[11px] font-bold px-2 py-1 rounded-lg border border-slate-200 dark:border-[#23333d] bg-white dark:bg-[#1b262d] text-slate-700 dark:text-[#e6edf2] outline-none"
                >
                  <option value="Identification">Identification</option>
                  <option value="Academic & Career">Academic & Career</option>
                  <option value="Finance">Finance</option>
                  <option value="General">General</option>
                </select>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleDocFileSelect}
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  className="hidden"
                />

                <button
                  type="button"
                  disabled={isUploadingDoc}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-white bg-[var(--accent-primary)] hover:opacity-90 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                >
                  {isUploadingDoc ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <UploadCloud className="w-3 h-3" />
                  )}
                  <span>Upload</span>
                </button>
              </div>
            </div>

            {/* Documents List */}
            {isLoadingDocs ? (
              <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-primary)]" />
                <span>Loading vault documents...</span>
              </div>
            ) : docs.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-[#8e9fa8] italic py-2">
                No vault documents uploaded yet. Upload college ID or paperwork for verification.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {docs.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-2 rounded-xl bg-white dark:bg-[#1b262d] border border-slate-200/60 dark:border-[#23333d] flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 dark:text-[#e6edf2] truncate text-[11px]">
                          {doc.file_name || doc.name || 'Document'}
                        </p>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {doc.category || 'General'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {doc.file_url && (
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 rounded text-slate-400 hover:text-[var(--accent-text)]"
                          title="View document"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteDoc(doc.id, doc.file_url)}
                        className="p-1 rounded text-slate-400 hover:text-rose-500 cursor-pointer"
                        title="Delete document"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Modal Footer Controls */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-[#23333d]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-[#8e9fa8] hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-[#141f26] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-[var(--accent-primary)] hover:opacity-90 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : saveSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Profile</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
