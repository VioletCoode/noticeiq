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
  Edit3,
  Plus,
  Link2,
  Code2,
  Globe,
  Building2
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
    institutionName: initialData.institutionName || initialData.institution || '',
    department: initialData.department || '',
    studentId: initialData.studentId || '',
    githubUrl: initialData.githubUrl || '',
    linkedinUrl: initialData.linkedinUrl || '',
    instagramUrl: initialData.instagramUrl || '',
    youtubeUrl: initialData.youtubeUrl || '',
    twitterUrl: initialData.twitterUrl || '',
    discordUrl: initialData.discordUrl || '',
    portfolioUrl: initialData.portfolioUrl || '',
    leetcodeUrl: initialData.leetcodeUrl || '',
    kaggleUrl: initialData.kaggleUrl || ''
  });

  // Custom Links state: array of { label, url }
  const [customLinks, setCustomLinks] = useState([]);

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
        institutionName: initialData.institutionName || initialData.institution || 'Apex Institute of Technology',
        department: initialData.department || 'Computer Science & Engineering',
        studentId: initialData.studentId || '',
        githubUrl: initialData.githubUrl || '',
        linkedinUrl: initialData.linkedinUrl || '',
        instagramUrl: initialData.instagramUrl || '',
        youtubeUrl: initialData.youtubeUrl || '',
        twitterUrl: initialData.twitterUrl || '',
        discordUrl: initialData.discordUrl || '',
        portfolioUrl: initialData.portfolioUrl || '',
        leetcodeUrl: initialData.leetcodeUrl || '',
        kaggleUrl: initialData.kaggleUrl || ''
      });

      // Parse custom links
      const rawCustom = Array.isArray(initialData.customLinks)
        ? initialData.customLinks
        : [];
      setCustomLinks(rawCustom.length > 0 ? rawCustom : []);
      setSaveSuccess(false);

      // Load user documents from Vault
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

  // Custom Links Handlers
  const handleAddCustomLink = () => {
    setCustomLinks((prev) => [...prev, { label: '', url: '' }]);
  };

  const handleCustomLinkChange = (index, field, value) => {
    setCustomLinks((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveCustomLink = (index) => {
    setCustomLinks((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User is not authenticated');

      const cleanName = formData.name.trim();
      const cleanInst = formData.institutionName.trim();
      const cleanDept = formData.department.trim();
      const cleanId = formData.studentId.trim();

      const normalizedGh = normalizeUrl(formData.githubUrl);
      const normalizedLi = normalizeUrl(formData.linkedinUrl);
      const normalizedIg = normalizeUrl(formData.instagramUrl);
      const normalizedYt = normalizeUrl(formData.youtubeUrl);
      const normalizedTw = normalizeUrl(formData.twitterUrl);
      const normalizedDc = normalizeUrl(formData.discordUrl);
      const normalizedPort = normalizeUrl(formData.portfolioUrl);
      const normalizedLc = normalizeUrl(formData.leetcodeUrl);
      const normalizedKg = normalizeUrl(formData.kaggleUrl);

      // Clean and sanitize custom links array
      const cleanedCustomLinks = customLinks
        .map((l) => ({
          label: (l.label || '').trim() || 'Link',
          url: normalizeUrl(l.url)
        }))
        .filter((l) => Boolean(l.url));

      const payload = {
        name: cleanName,
        institution_name: cleanInst || 'Apex Institute of Technology',
        department: cleanDept,
        student_id: cleanId,
        github_url: normalizedGh || null,
        linkedin_url: normalizedLi || null,
        instagram_url: normalizedIg || null,
        youtube_url: normalizedYt || null,
        twitter_url: normalizedTw || null,
        discord_url: normalizedDc || null,
        portfolio_url: normalizedPort || null,
        leetcode_url: normalizedLc || null,
        kaggle_url: normalizedKg || null,
        custom_links: cleanedCustomLinks
      };

      await upsertProfile(user.id, payload);

      setSaveSuccess(true);
      if (onProfileSaved) {
        onProfileSaved({
          name: cleanName,
          institutionName: cleanInst || 'Apex Institute of Technology',
          department: cleanDept,
          studentId: cleanId,
          githubUrl: normalizedGh,
          linkedinUrl: normalizedLi,
          instagramUrl: normalizedIg,
          youtubeUrl: normalizedYt,
          twitterUrl: normalizedTw,
          discordUrl: normalizedDc,
          portfolioUrl: normalizedPort,
          leetcodeUrl: normalizedLc,
          kaggleUrl: normalizedKg,
          customLinks: cleanedCustomLinks
        });
      }

      setTimeout(() => {
        onClose();
      }, 400);
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
      <div className="bg-white dark:bg-[#1b262d] rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200/70 dark:border-[#23333d] relative space-y-5 animate-popover origin-center max-h-[90vh] overflow-y-auto">
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
              Update your Digital Campus ID credentials, socials & vault files
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Section 1: Academic & Identity Fields */}
          <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-[#141f26]/60 border border-slate-200/70 dark:border-[#23333d] space-y-3">
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

            {/* Institution / College Name */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-[#8e9fa8] flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                <span>Institution / College Name</span>
              </label>
              <input
                type="text"
                required
                value={formData.institutionName}
                onChange={(e) => handleChange('institutionName', e.target.value)}
                placeholder="e.g. Apex Institute of Technology"
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

          {/* Section 2: Dedicated Social & Professional Platforms */}
          <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-[#141f26]/60 border border-slate-200/70 dark:border-[#23333d] space-y-3">
            <h4 className="text-xs font-bold text-slate-700 dark:text-[#e6edf2] uppercase tracking-wider flex items-center gap-1.5">
              <span>Primary Social & Developer Profiles</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* GitHub */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-[#8e9fa8] flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 fill-current text-[var(--accent-primary)]" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  <span>GitHub</span>
                </label>
                <input
                  type="text"
                  value={formData.githubUrl}
                  onChange={(e) => handleChange('githubUrl', e.target.value)}
                  placeholder="https://github.com/..."
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-[#23333d] bg-white dark:bg-[#141f26] text-slate-900 dark:text-[#e6edf2] focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)] text-xs font-mono transition-all"
                />
              </div>

              {/* LinkedIn */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-[#8e9fa8] flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 fill-current text-[var(--accent-primary)]" viewBox="0 0 24 24">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                  </svg>
                  <span>LinkedIn</span>
                </label>
                <input
                  type="text"
                  value={formData.linkedinUrl}
                  onChange={(e) => handleChange('linkedinUrl', e.target.value)}
                  placeholder="https://linkedin.com/in/..."
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-[#23333d] bg-white dark:bg-[#141f26] text-slate-900 dark:text-[#e6edf2] focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)] text-xs font-mono transition-all"
                />
              </div>

              {/* Instagram */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-[#8e9fa8] flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 fill-current text-[var(--accent-primary)]" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                  <span>Instagram</span>
                </label>
                <input
                  type="text"
                  value={formData.instagramUrl}
                  onChange={(e) => handleChange('instagramUrl', e.target.value)}
                  placeholder="https://instagram.com/..."
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-[#23333d] bg-white dark:bg-[#141f26] text-slate-900 dark:text-[#e6edf2] focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)] text-xs font-mono transition-all"
                />
              </div>

              {/* YouTube */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-[#8e9fa8] flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 fill-current text-[var(--accent-primary)]" viewBox="0 0 24 24">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                  <span>YouTube</span>
                </label>
                <input
                  type="text"
                  value={formData.youtubeUrl}
                  onChange={(e) => handleChange('youtubeUrl', e.target.value)}
                  placeholder="https://youtube.com/@..."
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-[#23333d] bg-white dark:bg-[#141f26] text-slate-900 dark:text-[#e6edf2] focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)] text-xs font-mono transition-all"
                />
              </div>

              {/* Twitter / X */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-[#8e9fa8] flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 fill-current text-[var(--accent-primary)]" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  <span>Twitter / X</span>
                </label>
                <input
                  type="text"
                  value={formData.twitterUrl}
                  onChange={(e) => handleChange('twitterUrl', e.target.value)}
                  placeholder="https://x.com/..."
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-[#23333d] bg-white dark:bg-[#141f26] text-slate-900 dark:text-[#e6edf2] focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)] text-xs font-mono transition-all"
                />
              </div>

              {/* Discord */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-[#8e9fa8] flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 fill-current text-[var(--accent-primary)]" viewBox="0 0 24 24">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                  </svg>
                  <span>Discord / Community</span>
                </label>
                <input
                  type="text"
                  value={formData.discordUrl}
                  onChange={(e) => handleChange('discordUrl', e.target.value)}
                  placeholder="https://discord.gg/..."
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-[#23333d] bg-white dark:bg-[#141f26] text-slate-900 dark:text-[#e6edf2] focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)] text-xs font-mono transition-all"
                />
              </div>

              {/* Portfolio */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-[#8e9fa8] flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>Portfolio / Website</span>
                </label>
                <input
                  type="text"
                  value={formData.portfolioUrl}
                  onChange={(e) => handleChange('portfolioUrl', e.target.value)}
                  placeholder="https://yourportfolio.dev"
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-[#23333d] bg-white dark:bg-[#141f26] text-slate-900 dark:text-[#e6edf2] focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)] text-xs font-mono transition-all"
                />
              </div>

              {/* LeetCode */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-[#8e9fa8] flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>LeetCode</span>
                </label>
                <input
                  type="text"
                  value={formData.leetcodeUrl}
                  onChange={(e) => handleChange('leetcodeUrl', e.target.value)}
                  placeholder="https://leetcode.com/u/..."
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-[#23333d] bg-white dark:bg-[#141f26] text-slate-900 dark:text-[#e6edf2] focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)] text-xs font-mono transition-all"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Generic Custom Links */}
          <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-[#141f26]/60 border border-slate-200/70 dark:border-[#23333d] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-700 dark:text-[#e6edf2] uppercase tracking-wider flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>Custom Links & Handles</span>
                </h4>
                <p className="text-[10px] text-slate-400 dark:text-[#8e9fa8]">
                  Add custom platforms, blogs, Substack, Linktree, etc.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddCustomLink}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-[var(--accent-text)] bg-[var(--accent-light)] hover:bg-[var(--accent-badge-bg)] border border-[var(--accent-light-border)] transition-all cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Link</span>
              </button>
            </div>

            {customLinks.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-[#8e9fa8] italic py-1">
                No custom links added. Click "+ Add Link" to attach any additional portfolio or profile link.
              </p>
            ) : (
              <div className="space-y-2">
                {customLinks.map((link, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={link.label}
                      onChange={(e) => handleCustomLinkChange(idx, 'label', e.target.value)}
                      placeholder="Label (e.g. Substack, Medium)"
                      className="w-1/3 px-2.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-[#23333d] bg-white dark:bg-[#141f26] text-slate-900 dark:text-[#e6edf2] focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)] text-xs font-medium"
                    />
                    <input
                      type="text"
                      value={link.url}
                      onChange={(e) => handleCustomLinkChange(idx, 'url', e.target.value)}
                      placeholder="https://..."
                      className="flex-1 px-2.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-[#23333d] bg-white dark:bg-[#141f26] text-slate-900 dark:text-[#e6edf2] focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)] text-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomLink(idx)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0"
                      title="Remove link"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 4: Campus Vault Documents */}
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
              <div className="py-3 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-primary)]" />
                <span>Loading vault documents...</span>
              </div>
            ) : docs.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-[#8e9fa8] italic py-1">
                No vault documents uploaded yet. Upload college ID or paperwork for verification.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
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
