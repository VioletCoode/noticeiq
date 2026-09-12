import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  RotateCw,
  Camera,
  Share2,
  Check,
  ExternalLink,
  ShieldCheck,
  Download,
  Trash2,
  Edit3,
  QrCode,
  GraduationCap,
  Globe,
  Code2,
  Link2,
  CheckCircle2
} from 'lucide-react';
import { supabase, fetchProfile, upsertProfile, uploadProfilePhoto } from '../services/supabase';
import EditProfileModal from './EditProfileModal';

const STORAGE_STUDENT_ID_KEY = 'noticeiq_digital_id_data_v2';

const DEFAULT_STUDENT_DATA = {
  name: '',
  department: 'Computer Science & Engineering',
  studentId: 'CS-2024-8942',
  institution: 'Apex Institute of Technology',
  batch: '2023 - 2027',
  issueDate: 'AUG 2023',
  validThru: 'JUN 2027',
  bloodGroup: 'O+',
  email: ''
};

export default function DigitalStudentId({ 
  profiles = [], 
  userName = '', 
  userEmail = '', 
  onUpdateName 
}) {
  // Card Flip state
  const [isFlipped, setIsFlipped] = useState(false);

  // Edit Profile Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Student Data with localStorage persistence (cleaning up any legacy placeholder names)
  const [studentData, setStudentData] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_STUDENT_ID_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.name === 'Riddhi Sharma') {
          parsed.name = '';
        }
        return { 
          ...DEFAULT_STUDENT_DATA, 
          ...parsed, 
          name: parsed.name || userName || '' 
        };
      }
    } catch (e) {
      console.warn('[NoticeIQ] Failed to load student ID data:', e);
    }
    return { ...DEFAULT_STUDENT_DATA, name: userName || '' };
  });

  // DB Profile cache
  const [dbProfile, setDbProfile] = useState(null);

  // Profile Photo state (Public URL from Supabase Storage)
  const [photo, setPhoto] = useState('');
  const [_uploadingPhoto, setUploadingPhoto] = useState(false);

  // QR Code Data URL state & Verification URL state
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [verifyUrl, setVerifyUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  // File input ref
  const fileInputRef = useRef(null);

  // Active social links: merge props from CampusVault with direct DB profile links
  const activeSocials = [
    { id: 'github', name: 'GitHub', iconType: 'github', url: profiles.find((p) => p.id === 'github')?.url || dbProfile?.github_url || '' },
    { id: 'linkedin', name: 'LinkedIn', iconType: 'linkedin', url: profiles.find((p) => p.id === 'linkedin')?.url || dbProfile?.linkedin_url || '' },
    { id: 'portfolio', name: 'Portfolio', iconType: 'globe', url: profiles.find((p) => p.id === 'portfolio')?.url || dbProfile?.portfolio_url || '' },
    { id: 'leetcode', name: 'LeetCode', iconType: 'code', url: profiles.find((p) => p.id === 'leetcode')?.url || dbProfile?.leetcode_url || '' },
    { id: 'kaggle', name: 'Kaggle', iconType: 'code', url: profiles.find((p) => p.id === 'kaggle')?.url || dbProfile?.kaggle_url || '' },
  ].filter((p) => Boolean(p.url));

  // Handler when profile is saved via EditProfileModal
  const handleProfileSaved = (updated) => {
    setStudentData((prev) => {
      const next = {
        ...prev,
        name: updated.name || prev.name,
        department: updated.department || prev.department,
        studentId: updated.studentId || prev.studentId
      };
      try {
        localStorage.setItem(STORAGE_STUDENT_ID_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });

    if (updated.name && onUpdateName) {
      onUpdateName(updated.name);
    }

    setDbProfile((prev) => ({
      ...prev,
      name: updated.name,
      department: updated.department,
      student_id: updated.studentId,
      github_url: updated.githubUrl || null,
      linkedin_url: updated.linkedinUrl || null
    }));
  };

  // Load real student profile from Supabase
  useEffect(() => {
    let isMounted = true;

    async function loadRealProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const prof = await fetchProfile(user.id);
        if (!isMounted) return;

        if (prof) {
          setDbProfile(prof);
          const resolvedName = (
            prof.name ||
            prof.full_name ||
            userName ||
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split('@')[0] ||
            ''
          );
          const resolvedId = prof.student_id || ('CS-2024-' + user.id.slice(0, 4).toUpperCase());
          const resolvedDept = prof.department || 'Computer Science & Engineering';

          setStudentData((prev) => {
            const updated = {
              ...prev,
              name: resolvedName || prev.name,
              department: resolvedDept,
              studentId: resolvedId,
              email: user.email || userEmail || prev.email || '',
            };
            try {
              localStorage.setItem(STORAGE_STUDENT_ID_KEY, JSON.stringify(updated));
            } catch {}
            return updated;
          });

          if (prof.photo_url) {
            setPhoto(prof.photo_url);
          }
        }
      } catch (err) {
        console.error('[NoticeIQ Digital ID] Error fetching real profile:', err);
      }
    }

    loadRealProfile();

    return () => {
      isMounted = false;
    };
  }, [userName, userEmail]);

  // Regenerate QR Code whenever studentData, activeSocials, or dbProfile change
  useEffect(() => {
    const generateQr = async () => {
      const currentName = studentData.name || userName || dbProfile?.name || 'Riddhi Som';
      const currentId = studentData.studentId || dbProfile?.student_id || 'CS-2024-8942';
      const currentDept = studentData.department || dbProfile?.department || 'Computer Science & Engineering';

      const origin = typeof window !== 'undefined' && window.location.origin
        ? window.location.origin
        : 'http://localhost:5173';

      const ghUrl = profiles.find((p) => p.id === 'github')?.url || dbProfile?.github_url || '';
      const liUrl = profiles.find((p) => p.id === 'linkedin')?.url || dbProfile?.linkedin_url || '';

      const queryParams = new URLSearchParams({
        name: currentName,
        dept: currentDept,
        ...(ghUrl ? { gh: ghUrl } : {}),
        ...(liUrl ? { li: liUrl } : {})
      });

      // Clean, mobile-scannable URL encoding student's verification route with fallback parameters
      const targetVerifyUrl = `${origin}/verify/${encodeURIComponent(currentId)}?${queryParams.toString()}`;
      setVerifyUrl(targetVerifyUrl);

      // Requirement 2: Log exact URL/payload being encoded into the QR code
      console.log('====================================================');
      console.log('[NoticeIQ Digital ID] 📱 QR Code URL Being Encoded:');
      console.log(targetVerifyUrl);
      console.log('====================================================');

      try {
        // High Error Correction Level ('H' = 30% recovery) on clean URL payload for instantaneous mobile camera scanning
        const url = await QRCode.toDataURL(targetVerifyUrl, {
          width: 320,
          margin: 1.5,
          color: {
            dark: '#0f3a3a',
            light: '#ffffff'
          },
          errorCorrectionLevel: 'H'
        });
        setQrCodeUrl(url);
      } catch (err) {
        console.error('[NoticeIQ] QR Code generation error:', err);
      }
    };

    generateQr();
  }, [studentData, activeSocials, userName, userEmail, dbProfile]);

  // Photo upload handler using Supabase Storage
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, WEBP).');
      return;
    }

    setUploadingPhoto(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const publicUrl = await uploadProfilePhoto(user.id, file);
        setPhoto(publicUrl);
      }
    } catch (err) {
      console.error('[NoticeIQ] Error uploading ID photo to storage:', err);
      alert('Failed to upload ID photo to cloud storage.');
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleRemovePhoto = async (e) => {
    e.stopPropagation();
    setPhoto('');
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      upsertProfile(user.id, { photo_url: null }).catch(() => {});
    }
  };



  // Share or Copy handler
  const handleShare = async (e) => {
    if (e) e.stopPropagation();

    const socialLinksText = activeSocials
      .map((s) => `${s.name}: ${s.url}`)
      .join('\n');

    const shareUrl = verifyUrl || window.location.href;
    const shareData = {
      title: `${studentData.name} - Digital Student ID`,
      text: `NoticeIQ Verified Student Pass for ${studentData.name} (${studentData.studentId}) - ${studentData.department}`,
      url: shareUrl
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2500);
      } catch (err) {
        if (err.name !== 'AbortError') {
          copyToClipboard(shareUrl);
        }
      }
    } else {
      copyToClipboard(shareUrl);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  // Download QR Code image
  const handleDownloadQr = (e) => {
    if (e) e.stopPropagation();
    if (!qrCodeUrl) return;
    const link = document.createElement('a');
    link.href = qrCodeUrl;
    link.download = `${studentData.name.replace(/\s+/g, '_')}_ID_QR.png`;
    link.click();
  };

  // Helper to render platform icon
  const renderSocialIcon = (iconType) => {
    switch (iconType) {
      case 'github':
        return (
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
        );
      case 'linkedin':
        return (
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
          </svg>
        );
      case 'twitter':
        return (
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        );
      case 'instagram':
        return (
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
          </svg>
        );
      case 'code':
        return <Code2 className="w-3.5 h-3.5" />;
      case 'globe':
        return <Globe className="w-3.5 h-3.5" />;
      default:
        return <Link2 className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="w-full space-y-3">
      {/* Hidden File Input for Profile Photo */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handlePhotoUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Header bar above card */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent-primary)] animate-pulse" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-[#8e9fa8] flex items-center gap-1.5">
            <span>Digital College ID</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent-badge-bg)] text-[var(--accent-badge-text)] font-semibold border border-[var(--accent-light-border)]">
              Smart Pass
            </span>
          </h2>
        </div>

        {/* Action Controls: Edit Profile & Quick Flip Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsEditModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-light)] hover:bg-[var(--accent-badge-bg)] border border-[var(--accent-light-border)] transition-all cursor-pointer shadow-2xs group"
            title="Edit Student Profile & Credentials"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Profile</span>
          </button>

          <button
            type="button"
            onClick={() => setIsFlipped(!isFlipped)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold text-slate-700 dark:text-[#e6edf2] bg-slate-100 dark:bg-[#141f26] hover:bg-[var(--accent-light)] hover:text-[var(--accent-text)] border border-slate-200/70 dark:border-[#23333d] transition-all cursor-pointer shadow-2xs group"
            title="Flip ID Card"
          >
            <RotateCw className={`w-3.5 h-3.5 transition-transform duration-500 ${isFlipped ? 'rotate-180' : 'group-hover:rotate-45'}`} />
            <span>{isFlipped ? 'Show Front' : 'Flip to QR'}</span>
          </button>
        </div>
      </div>

      {/* 3D Card Container with Flip Wrapper */}
      <div className="perspective-1000 w-full max-w-2xl mx-auto">
        <div
          className={`relative w-full rounded-3xl transition-transform duration-500 preserve-3d shadow-md hover:shadow-xl ${
            isFlipped ? 'rotate-y-180' : ''
          }`}
          style={{ minHeight: '340px' }}
        >
          {/* ======================================================== */}
          {/* FRONT OF CARD                                            */}
          {/* ======================================================== */}
          <div
            className={`w-full h-full rounded-3xl p-5 sm:p-6 bg-white dark:bg-[#1b262d] border border-slate-200/80 dark:border-[#23333d] backface-hidden relative overflow-hidden flex flex-col justify-between transition-colors ${
              isFlipped ? 'pointer-events-none' : ''
            }`}
          >
            {/* Guilloché security pattern background */}
            <div className="absolute inset-0 bg-security-pattern pointer-events-none opacity-80" />

            {/* Holographic corner shimmer accent */}
            <div className="absolute top-0 right-0 w-44 h-44 bg-gradient-to-bl from-[var(--accent-primary)]/15 via-transparent to-transparent rounded-tr-3xl pointer-events-none" />

            {/* Smart Chip & Action Controls accent */}
            <div className="absolute top-6 right-6 flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-[#2e2617] border border-amber-200/70 dark:border-[#523e1c] shadow-2xs">
                <div className="w-3.5 h-3 rounded bg-amber-400/80 dark:bg-amber-500/70 border border-amber-600/40 flex items-center justify-center">
                  <div className="w-2 h-1.5 border-t border-b border-amber-700/40" />
                </div>
                <span className="text-[9px] font-mono font-bold tracking-widest text-amber-800 dark:text-amber-300">
                  SMART ID
                </span>
              </div>

              {/* Edit Profile Button on Card Face */}
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-[#141f26] hover:bg-[var(--accent-light)] text-slate-500 hover:text-[var(--accent-text)] border border-slate-200/60 dark:border-[#23333d] transition-all cursor-pointer shadow-2xs group/btn"
                title="Edit Student Profile & Credentials"
              >
                <Edit3 className="w-4 h-4 text-[var(--accent-primary)] group-hover/btn:scale-110 transition-transform" />
              </button>

              {/* Flip Button on Card Face */}
              <button
                type="button"
                onClick={() => setIsFlipped(true)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-[#141f26] hover:bg-[var(--accent-light)] text-slate-500 hover:text-[var(--accent-text)] border border-slate-200/60 dark:border-[#23333d] transition-all cursor-pointer shadow-2xs group/btn"
                title="Flip to view QR Code"
              >
                <QrCode className="w-4 h-4 text-[var(--accent-primary)] group-hover/btn:scale-110 transition-transform" />
              </button>
            </div>

            {/* Top Branding / Institutional Row */}
            <div className="relative z-10 flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-[#23333d]/80 pr-24 sm:pr-32">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-[var(--accent-primary)] text-white flex items-center justify-center shadow-2xs font-bold text-xs shrink-0">
                  <GraduationCap className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-[#e6edf2] tracking-tight truncate">
                    {studentData.institution}
                  </h3>
                  <p className="text-[10px] text-slate-400 dark:text-[#8e9fa8] font-semibold tracking-wider uppercase">
                    Official Student Identity Pass
                  </p>
                </div>
              </div>
            </div>

            {/* Core Student Info Section (Photo + Details) */}
            <div className="relative z-10 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
              {/* Photo Area */}
              <div className="relative shrink-0 mx-auto sm:mx-0 group/photo">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl p-1 bg-gradient-to-tr from-[var(--accent-primary)] via-emerald-400 to-teal-200 dark:from-[var(--accent-primary)] dark:to-[#1a3d3d] shadow-sm">
                  <div className="w-full h-full rounded-[14px] bg-slate-100 dark:bg-[#141f26] overflow-hidden relative flex items-center justify-center border border-white/60 dark:border-slate-800">
                    {photo ? (
                      <img
                        src={photo}
                        alt={studentData.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200 dark:from-[#1b262d] dark:to-[#141f26] text-slate-400">
                        <GraduationCap className="w-10 h-10 text-[var(--accent-primary)]/70 mb-1" />
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                          Add Photo
                        </span>
                      </div>
                    )}

                    {/* Camera overlay on hover / click */}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover/photo:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer"
                      title="Upload new profile photo"
                    >
                      <Camera className="w-6 h-6 mb-1 drop-shadow" />
                      <span className="text-[10px] font-bold tracking-wider">
                        {photo ? 'Change' : 'Upload'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Small camera trigger button in corner */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[var(--accent-primary)] text-white flex items-center justify-center shadow-md hover:scale-110 active:scale-95 transition-all cursor-pointer border-2 border-white dark:border-[#1b262d]"
                  title="Upload profile photo"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>

                {/* Remove photo option if custom photo exists */}
                {photo && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-md hover:bg-rose-600 transition-colors cursor-pointer border-2 border-white dark:border-[#1b262d]"
                    title="Remove custom photo"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>

              {/* Student Fields (Display-Only) */}
              <div className="flex-1 min-w-0 space-y-2.5 w-full">
                {/* Student Name */}
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#8e9fa8]">
                    Student Name
                  </span>
                  <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-[#e6edf2] tracking-tight truncate mt-0.5">
                    {studentData.name}
                  </h4>
                </div>

                {/* Department & ID Number Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {/* Department */}
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#8e9fa8]">
                      Department / Program
                    </span>
                    <span className="font-semibold text-slate-700 dark:text-[#d1dce2] truncate block mt-0.5">
                      {studentData.department}
                    </span>
                  </div>

                  {/* Student ID / Roll No */}
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#8e9fa8]">
                      Student ID / Roll No
                    </span>
                    <div className="mt-0.5">
                      <span className="font-mono font-bold text-[var(--accent-text)] bg-[var(--accent-light)] dark:bg-[#132426] px-2 py-0.5 rounded-md border border-[var(--accent-light-border)]">
                        {studentData.studentId}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Row: Verified Social Links Chips + Validity & Status Badge */}
            <div className="relative z-10 pt-3 border-t border-slate-100 dark:border-[#23333d]/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
              {/* Social & Professional Links Chips */}
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                  Profiles:
                </span>
                {activeSocials.length > 0 ? (
                  activeSocials.map((prof) => (
                    <a
                      key={prof.id}
                      href={prof.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-slate-50 dark:bg-[#141f26] hover:bg-[var(--accent-light)] text-slate-700 dark:text-[#e6edf2] hover:text-[var(--accent-text)] border border-slate-200/60 dark:border-[#23333d] transition-colors cursor-pointer group/chip shadow-2xs"
                      title={`${prof.name}: ${prof.url}`}
                    >
                      <span className="text-[var(--accent-primary)] group-hover/chip:scale-110 transition-transform">
                        {renderSocialIcon(prof.iconType)}
                      </span>
                      <span>{prof.name}</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-40 group-hover/chip:opacity-100 transition-opacity" />
                    </a>
                  ))
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(true)}
                    className="text-[11px] text-[var(--accent-primary)] hover:underline font-semibold cursor-pointer"
                  >
                    + Add GitHub / LinkedIn
                  </button>
                )}
              </div>

              {/* Verified Status Tag */}
              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-[#142922] border border-emerald-200/60 dark:border-[#1c483a] text-emerald-700 dark:text-emerald-300 text-[10px] font-bold shadow-2xs">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>ACTIVE STUDENT</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  {studentData.validThru}
                </span>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* BACK OF CARD (QR CODE & SHARING)                        */}
          {/* ======================================================== */}
          <div
            className={`w-full h-full rounded-3xl p-5 sm:p-6 bg-white dark:bg-[#1b262d] border border-slate-200/80 dark:border-[#23333d] backface-hidden rotate-y-180 absolute inset-0 flex flex-col justify-between transition-colors ${
              !isFlipped ? 'pointer-events-none' : ''
            }`}
          >
            {/* Guilloché pattern background */}
            <div className="absolute inset-0 bg-security-pattern pointer-events-none opacity-80" />

            {/* Back Header */}
            <div className="relative z-10 flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#23333d]/80">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-[var(--accent-light)] text-[var(--accent-primary)] flex items-center justify-center border border-[var(--accent-light-border)]">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-[#e6edf2] tracking-tight">
                    Digital Identity Verification
                  </h3>
                  <p className="text-[10px] text-slate-400 dark:text-[#8e9fa8]">
                    Scan QR to inspect credentials & verified handles
                  </p>
                </div>
              </div>

              {/* Flip Back Button */}
              <button
                onClick={() => setIsFlipped(false)}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-semibold text-slate-600 dark:text-[#e6edf2] bg-slate-100 dark:bg-[#141f26] hover:bg-[var(--accent-light)] hover:text-[var(--accent-text)] border border-slate-200/70 dark:border-[#23333d] transition-colors cursor-pointer shadow-2xs"
                title="Flip back to front"
              >
                <RotateCw className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>Flip Back</span>
              </button>
            </div>

            {/* Back Body: Centered QR Code & Student Summary */}
            <div className="relative z-10 py-3 flex flex-col sm:flex-row items-center justify-center gap-5">
              {/* QR Code Container */}
              <div className="relative p-2.5 bg-white dark:bg-white rounded-2xl shadow-md border-2 border-[var(--accent-primary)] group/qr">
                {qrCodeUrl ? (
                  <img
                    src={qrCodeUrl}
                    alt="Student ID QR Code"
                    className="w-36 h-36 sm:w-40 sm:h-40 rounded-xl"
                  />
                ) : (
                  <div className="w-36 h-36 sm:w-40 sm:h-40 flex items-center justify-center bg-slate-50 text-slate-400">
                    <QrCode className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
                  </div>
                )}

                {/* Instant preview badge */}
                <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-[var(--accent-primary)] text-white text-[9px] font-bold uppercase tracking-wider shadow-sm whitespace-nowrap">
                  Dynamic QR
                </div>
              </div>

              {/* Details & Quick Stats next to QR */}
              <div className="text-center sm:text-left space-y-2 max-w-xs">
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-[#e6edf2]">
                    {studentData.name}
                  </h4>
                  <p className="text-xs font-mono font-bold text-[var(--accent-text)]">
                    {studentData.studentId}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-[#8e9fa8] truncate">
                    {studentData.department}
                  </p>
                </div>

                <div className="p-2 rounded-xl bg-slate-50 dark:bg-[#141f26] border border-slate-200/50 dark:border-[#23333d] text-[10px] text-slate-500 dark:text-[#8e9fa8] space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Active Handles:</span>
                    <span className="font-bold text-slate-700 dark:text-[#e6edf2]">
                      {activeSocials.length} Linked
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Security Check:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      Tamper-Resistant
                    </span>
                  </div>
                </div>

                {/* Action Controls */}
                <div className="flex items-center gap-2 pt-1 justify-center sm:justify-start">
                  <button
                    onClick={handleShare}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer ${
                      copied || shareSuccess
                        ? 'bg-emerald-600 dark:bg-emerald-500 text-white ring-2 ring-emerald-300 dark:ring-emerald-700 animate-nav-pop'
                        : 'bg-[var(--accent-primary)] hover:opacity-90 text-white'
                    }`}
                    title="Share or Copy Student ID Details"
                  >
                    {copied || shareSuccess ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied Info!</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Share ID</span>
                      </>
                    )}
                  </button>

                  <a
                    href={verifyUrl || `/verify/${encodeURIComponent(studentData.studentId || 'CS-2024-8942')}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-[#13282b] hover:bg-teal-100 dark:hover:bg-[#18363a] text-teal-800 dark:text-teal-300 text-xs font-bold border border-teal-200/70 dark:border-teal-800/60 transition-colors shadow-2xs"
                    title="Open public-facing verification pass in new tab"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Pass</span>
                  </a>

                  <button
                    onClick={handleDownloadQr}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#141f26] hover:bg-slate-200 dark:hover:bg-[#1e2f38] text-slate-700 dark:text-[#e6edf2] text-xs font-semibold border border-slate-200/60 dark:border-[#23333d] transition-colors cursor-pointer shadow-2xs"
                    title="Download QR image"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>Save QR</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Back Footer / Security Barcode Strip */}
            <div className="relative z-10 pt-2 border-t border-slate-100 dark:border-[#23333d]/80 flex items-center justify-between text-[10px] text-slate-400 dark:text-[#8e9fa8]">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>NoticeIQ Campus Vault Verified</span>
              </div>
              <div className="font-mono text-[9px] tracking-widest">
                VERIFIED ID // {studentData.studentId}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dedicated Centralized Edit Profile Modal */}
      <EditProfileModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        initialData={{
          name: studentData.name,
          department: studentData.department,
          studentId: studentData.studentId,
          githubUrl: dbProfile?.github_url || profiles.find((p) => p.id === 'github')?.url || '',
          linkedinUrl: dbProfile?.linkedin_url || profiles.find((p) => p.id === 'linkedin')?.url || ''
        }}
        onProfileSaved={handleProfileSaved}
      />
    </div>
  );
}
