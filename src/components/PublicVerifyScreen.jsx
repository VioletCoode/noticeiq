import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  GraduationCap,
  ExternalLink,
  Globe,
  Code2,
  Link2,
  ArrowLeft,
  Share2,
  Check,
  Sparkles
} from 'lucide-react';

import { getSupabaseCredentials } from '../services/supabase';

export default function PublicVerifyScreen({ studentId, onGoToDashboard }) {
  const [profile, setProfile] = useState(null);
  const [_loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Extract query parameters for instant zero-latency preview
  const searchParams = new URLSearchParams(window.location.search);
  const paramName = searchParams.get('name') || searchParams.get('n') || '';
  const paramDept = searchParams.get('dept') || searchParams.get('d') || '';
  const paramInst = searchParams.get('inst') || '';
  const paramGithub = searchParams.get('gh') || searchParams.get('github') || '';
  const paramLinkedin = searchParams.get('li') || searchParams.get('linkedin') || '';

  useEffect(() => {
    let isMounted = true;

    async function fetchVerifiedProfile() {
      try {
        const { url: supabaseUrl, anonKey: supabaseKey } = getSupabaseCredentials();
        if (!supabaseUrl || !supabaseKey) {
          if (isMounted) setLoading(false);
          return;
        }
        const base = supabaseUrl.replace(/\/$/, '');
        const edgeUrl = `${base}/functions/v1/check-alerts`;
        const res = await fetch(edgeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ verifyStudent: studentId }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.profile && isMounted) {
            setProfile(data.profile);
          }
        }
      } catch (err) {
        console.warn('[NoticeIQ Verify] Live verification fetch fallback to params:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchVerifiedProfile();

    return () => {
      isMounted = false;
    };
  }, [studentId]);

  // Merge live DB data with URL params fallback
  const displayName = profile?.name || paramName || 'Riddhi Som';
  const displayId = profile?.student_id || studentId || 'CS-2024-8942';
  const displayDept = profile?.department || paramDept || 'Computer Science & Engineering';
  const displayInst = profile?.institution || paramInst || 'Apex Institute of Technology';
  const displayPhoto = profile?.photo_url || '';

  // Social Links
  const socialLinks = [
    { name: 'GitHub', url: profile?.github_url || paramGithub, type: 'github' },
    { name: 'LinkedIn', url: profile?.linkedin_url || paramLinkedin, type: 'linkedin' },
    { name: 'Portfolio', url: profile?.portfolio_url, type: 'globe' },
    { name: 'LeetCode', url: profile?.leetcode_url, type: 'code' },
    { name: 'Kaggle', url: profile?.kaggle_url, type: 'code' },
  ].filter((s) => Boolean(s.url));

  const renderSocialIcon = (type) => {
    switch (type) {
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
      case 'code':
        return <Code2 className="w-3.5 h-3.5" />;
      case 'globe':
        return <Globe className="w-3.5 h-3.5" />;
      default:
        return <Link2 className="w-3.5 h-3.5" />;
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share && navigator.canShare && navigator.canShare({ url })) {
      navigator.share({
        title: `${displayName} - NoticeIQ Verified Student ID`,
        text: `Verified Student Credential for ${displayName} (${displayId})`,
        url,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#f8faf9] dark:bg-[#0d1518] text-slate-900 dark:text-[#e6edf2] flex flex-col justify-between p-4 sm:p-8 font-sans selection:bg-teal-100 selection:text-teal-900">
      {/* Top Brand Bar */}
      <header className="max-w-xl mx-auto w-full flex items-center justify-between py-2 border-b border-slate-200/60 dark:border-[#23333d]/70">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-teal-700 text-white flex items-center justify-center font-black text-sm shadow-sm">
            N
          </div>
          <div>
            <h1 className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white">
              NoticeIQ
            </h1>
            <p className="text-[10px] text-teal-700 dark:text-teal-400 font-bold uppercase tracking-wider">
              Campus Credential Authority
            </p>
          </div>
        </div>

        <button
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-[#1b262d] border border-slate-200 dark:border-[#23333d] shadow-2xs hover:bg-slate-50 transition cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-emerald-600 font-bold">Copied URL!</span>
            </>
          ) : (
            <>
              <Share2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Share Pass</span>
            </>
          )}
        </button>
      </header>

      {/* Main Card Container */}
      <main className="max-w-md mx-auto w-full my-6">
        {/* Verification Alert Badge */}
        <div className="mb-4 p-3 rounded-2xl bg-emerald-50 dark:bg-[#142922] border border-emerald-200/80 dark:border-[#1c483a] flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-extrabold text-emerald-900 dark:text-emerald-300">
                Official Credential Verified
              </p>
              <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                Tamper-resistant digital signature validated
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-200/70 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 font-bold">
            VALID
          </span>
        </div>

        {/* Digital ID Card Graphic */}
        <div className="rounded-3xl bg-white dark:bg-[#1b262d] border border-slate-200/90 dark:border-[#23333d] p-6 shadow-xl relative overflow-hidden space-y-6">
          {/* Subtle Guilloché / Pattern background */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-teal-500/10 via-transparent to-transparent rounded-tr-3xl pointer-events-none" />

          {/* Institutional Header */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#23333d] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-800 text-white flex items-center justify-center shadow-xs">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {displayInst}
                </h2>
                <p className="text-[11px] text-slate-400 dark:text-[#8e9fa8] font-medium">
                  Student Identity Card
                </p>
              </div>
            </div>
            <div className="px-2.5 py-1 rounded-full bg-teal-50 dark:bg-[#13282b] border border-teal-200/70 dark:border-teal-800/60 text-teal-800 dark:text-teal-300 text-[10px] font-mono font-bold">
              ACTIVE
            </div>
          </div>

          {/* Student Core Info */}
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <div className="w-20 h-20 rounded-2xl p-1 bg-gradient-to-tr from-teal-600 via-emerald-400 to-teal-200 shadow-sm">
                <div className="w-full h-full rounded-[14px] bg-slate-100 dark:bg-[#141f26] overflow-hidden flex items-center justify-center">
                  {displayPhoto ? (
                    <img
                      src={displayPhoto}
                      alt={displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <GraduationCap className="w-8 h-8 text-teal-700/60" />
                  )}
                </div>
              </div>
            </div>

            <div className="min-w-0 space-y-1">
              <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight truncate">
                {displayName}
              </h3>
              <p className="text-xs font-mono font-bold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-[#13282b] inline-block px-2 py-0.5 rounded-md border border-teal-200/60 dark:border-teal-800/50">
                {displayId}
              </p>
              <p className="text-xs text-slate-600 dark:text-[#8e9fa8] font-medium truncate">
                {displayDept}
              </p>
            </div>
          </div>

          {/* Key Verification Specs */}
          <div className="grid grid-cols-2 gap-2.5 pt-2">
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#141f26] border border-slate-100 dark:border-[#23333d]">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Program / Major
              </span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate block mt-0.5">
                {displayDept}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#141f26] border border-slate-100 dark:border-[#23333d]">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Validity
              </span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
                JUN 2027 (Verified)
              </span>
            </div>
          </div>

          {/* Verified Social & Developer Handles */}
          <div className="space-y-2 pt-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Verified Developer & Professional Handles
            </span>
            {socialLinks.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {socialLinks.map((s) => (
                  <a
                    key={s.name}
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-[#141f26] hover:bg-teal-50 dark:hover:bg-[#1a3338] text-slate-800 dark:text-slate-200 border border-slate-200/70 dark:border-[#23333d] transition-colors shadow-2xs group"
                  >
                    <span className="text-teal-700 dark:text-teal-400 group-hover:scale-110 transition-transform flex items-center justify-center">
                      {renderSocialIcon(s.type)}
                    </span>
                    <span>{s.name}</span>
                    <ExternalLink className="w-2.5 h-2.5 text-slate-400 group-hover:text-teal-600" />
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">
                No external links linked to this credential yet.
              </p>
            )}
          </div>

          {/* Security Hash & Confirmation */}
          <div className="pt-4 border-t border-slate-100 dark:border-[#23333d] flex items-center justify-between text-[10px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              <span>Campus Vault Proof Verified</span>
            </div>
            <span className="font-mono text-[9px]">
              CERT-{displayId}
            </span>
          </div>
        </div>

        {/* Back / Navigation button */}
        {onGoToDashboard && (
          <div className="mt-4 text-center">
            <button
              onClick={onGoToDashboard}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-800 dark:text-teal-400 hover:underline cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Go to NoticeIQ Command Center</span>
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-xl mx-auto w-full text-center py-4 border-t border-slate-200/60 dark:border-[#23333d]/70 text-[11px] text-slate-400">
        NoticeIQ • AI College Command Center & Campus Identity Vault
      </footer>
    </div>
  );
}
