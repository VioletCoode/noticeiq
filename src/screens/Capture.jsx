import React, { useState, useRef } from 'react';
import { 
  Sparkles, 
  Loader2, 
  FileText, 
  Image as ImageIcon, 
  X, 
  BookOpen, 
  AlertTriangle, 
  Plus, 
  RefreshCw, 
  ShieldCheck, 
  Award, 
  Briefcase 
} from 'lucide-react';
import { extractNoticeWithGemini, fileToBase64 } from '../services/gemini';
import { SAMPLE_NOTICES } from '../utils/sampleData';
import { sanitizeNoticeInput } from '../utils/securityUtils';
import { checkRateLimit, recordSessionRequest, getSessionRequestCount } from '../utils/rateLimiter';
import { parseDeadlineToISO, formatDisplayDeadline } from '../utils/dateUtils';

export default function Capture({ onTaskCreated, onCancel }) {
  // Input states
  const [noticeText, setNoticeText] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);

  // UI status
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showManualFallback, setShowManualFallback] = useState(false);
  const [sessionCount, setSessionCount] = useState(() => getSessionRequestCount());

  // Hidden file input refs
  const screenshotInputRef = useRef(null);
  const pdfInputRef = useRef(null);

  // Manual fallback form state
  const [manualForm, setManualForm] = useState({
    task_name: '',
    description: '',
    deadline: '',
    priority: 'medium',
    required_documents: '',
    source_label: 'Manual Notice'
  });

  const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.pdf'];
  const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'application/pdf'];
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const processSelectedFile = async (file) => {
    if (!file) return;

    setErrorMsg('');
    setShowManualFallback(false);

    const fileName = (file.name || '').toLowerCase();
    const fileExt = fileName.substring(fileName.lastIndexOf('.'));
    const isExtensionValid = ALLOWED_EXTENSIONS.includes(fileExt);
    const isMimeValid = ALLOWED_MIME_TYPES.includes(file.type);

    if (!isExtensionValid || !isMimeValid) {
      setErrorMsg("Unsupported file format. Only .png, .jpg, .jpeg images and .pdf documents are allowed.");
      if (screenshotInputRef.current) screenshotInputRef.current.value = '';
      if (pdfInputRef.current) pdfInputRef.current.value = '';
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrorMsg("File is too large (max 10MB) — please select a smaller file or paste text directly.");
      if (screenshotInputRef.current) screenshotInputRef.current.value = '';
      if (pdfInputRef.current) pdfInputRef.current.value = '';
      return;
    }

    try {
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf';

      const fileData = await fileToBase64(file);
      const previewUrl = isImage ? URL.createObjectURL(file) : null;

      setUploadedFile({
        ...fileData,
        rawFile: file,
        previewUrl,
        isImage,
        isPdf
      });
    } catch (err) {
      console.error('Error processing file:', err);
      setErrorMsg("Failed to process file — please try again or paste text.");
    }
  };

  const handleScreenshotChange = (e) => {
    const file = e.target.files?.[0];
    if (file) processSelectedFile(file);
  };

  const handlePdfChange = (e) => {
    const file = e.target.files?.[0];
    if (file) processSelectedFile(file);
  };

  const handleRemoveFile = () => {
    if (uploadedFile?.previewUrl) {
      URL.revokeObjectURL(uploadedFile.previewUrl);
    }
    setUploadedFile(null);
    if (screenshotInputRef.current) screenshotInputRef.current.value = '';
    if (pdfInputRef.current) pdfInputRef.current.value = '';
  };

  const handleAnalyze = async () => {
    if (isLoading) return;

    const rateCheck = checkRateLimit();
    if (!rateCheck.allowed) {
      setErrorMsg(`Too many requests — please wait ${rateCheck.remainingSeconds}s before trying again.`);
      return;
    }

    const sanitizedPastedText = sanitizeNoticeInput(noticeText.trim());

    if (!sanitizedPastedText && !uploadedFile) {
      setErrorMsg('Please paste notice text, upload a screenshot/PDF, or select a sample notice.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    setShowManualFallback(false);

    const newCount = recordSessionRequest();
    setSessionCount(newCount);

    let initialLoadingMsg = 'AI is reading your notice...';
    if (uploadedFile?.isImage) {
      initialLoadingMsg = 'AI is reading your screenshot...';
    } else if (uploadedFile?.isPdf) {
      initialLoadingMsg = 'AI is reading your document...';
    }
    setLoadingStep(initialLoadingMsg);

    const stepTimer = setTimeout(() => {
      setLoadingStep('Extracting deadlines, priorities & required documents...');
    }, 800);

    const sourceType = uploadedFile ? (uploadedFile.isPdf ? 'pdf' : 'image') : 'text';

    try {
      const extractedData = await extractNoticeWithGemini({
        noticeText: sanitizedPastedText,
        fileData: uploadedFile ? {
          base64Data: uploadedFile.base64Data,
          mimeType: uploadedFile.mimeType,
          name: uploadedFile.name
        } : null,
        source_type: sourceType
      });

      const title = sanitizeNoticeInput(extractedData.title || extractedData.task_name);
      const newTask = {
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        title: title,
        task_name: title,
        description: sanitizeNoticeInput(extractedData.description),
        deadline: extractedData.deadline ? sanitizeNoticeInput(extractedData.deadline) : null,
        priority: extractedData.priority,
        audience: sanitizeNoticeInput(extractedData.audience || 'All Students'),
        requirements: (extractedData.requirements || extractedData.required_documents || []).map(d => sanitizeNoticeInput(d)),
        required_documents: (extractedData.requirements || extractedData.required_documents || []).map(d => sanitizeNoticeInput(d)),
        confidence: extractedData.confidence || 0.95,
        source_label: sanitizeNoticeInput(extractedData.source_label || (uploadedFile ? (uploadedFile.isPdf ? 'PDF Circular' : 'Screenshot Notice') : 'College Circular')),
        created_at: new Date().toISOString(),
        status: 'pending',
        completed: false,
        rawNotice: {
          raw_text: sanitizedPastedText || (uploadedFile?.name ? `Uploaded file: ${uploadedFile.name}` : ''),
          source_type: uploadedFile ? (uploadedFile.isPdf ? 'pdf' : 'image') : 'text'
        }
      };

      onTaskCreated(newTask);
    } catch (err) {
      console.error('[NoticeIQ] Notice extraction error details:', {
        message: err.message,
        error: err
      });

      const isTimeout = err.message && err.message.includes('timed out');
      const isHighDemand = err.message && (err.message.includes('high demand') || err.message.includes('503'));
      const isQuotaOrKey = err.message && (err.message.includes('API_KEY') || err.message.includes('quota') || err.message.includes('429'));

      let specificError;
      if (isTimeout) {
        specificError = 'Request timed out — Gemini AI took too long to respond. Please try again or add the task manually.';
      } else if (isHighDemand) {
        specificError = 'Gemini Flash models are temporarily experiencing high demand. Please try again in a few moments or add manually.';
      } else if (isQuotaOrKey) {
        specificError = err.message;
      } else if (err.message && !err.message.includes('[object Object]') && !err.message.includes('undefined') && err.message !== 'Failed to fetch') {
        specificError = err.message.length > 200 ? err.message.slice(0, 197) + '...' : err.message;
      } else {
        specificError = uploadedFile
          ? "Couldn't read this file clearly — try pasting the text instead or upload a clearer image"
          : "Couldn't fully understand that notice — add it manually";
      }

      setErrorMsg(specificError);
      setShowManualFallback(true);

      const fallbackTitle = sanitizedPastedText
        ? sanitizedPastedText.split('\n')[0].slice(0, 80)
        : (uploadedFile?.name ? uploadedFile.name.replace(/\.[^/.]+$/, '') : '');

      setManualForm((prev) => ({
        ...prev,
        task_name: sanitizeNoticeInput(fallbackTitle),
        description: sanitizeNoticeInput(sanitizedPastedText.slice(0, 150))
      }));
    } finally {
      clearTimeout(stepTimer);
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualForm.task_name.trim()) return;

    console.log('[NoticeIQ ManualTask] 1. Form submitted with raw values:', { ...manualForm });

    const parsedDocs = manualForm.required_documents
      ? manualForm.required_documents.split(',').map((d) => sanitizeNoticeInput(d.trim())).filter(Boolean)
      : [];

    const title = sanitizeNoticeInput(manualForm.task_name.trim());
    const desc = sanitizeNoticeInput(manualForm.description.trim());
    const rawDeadline = manualForm.deadline.trim() ? sanitizeNoticeInput(manualForm.deadline.trim()) : null;
    let isoDeadline = null;
    if (rawDeadline) {
      isoDeadline = parseDeadlineToISO(rawDeadline);
      if (!isoDeadline) {
        setErrorMsg(`"${rawDeadline}" is not a recognized deadline format. Please enter a valid date/time (e.g. "Tomorrow, 11:59 PM", "28 August") or use one of the quick presets.`);
        return;
      }
    }

    const newTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      title: title,
      task_name: title,
      description: desc,
      deadline: isoDeadline,
      priority: manualForm.priority || 'medium',
      audience: 'All Students',
      requirements: parsedDocs,
      required_documents: parsedDocs,
      confidence: 1.0,
      source_label: sanitizeNoticeInput(manualForm.source_label.trim() || 'Manual Notice'),
      created_at: new Date().toISOString(),
      status: 'pending',
      completed: false,
      rawNotice: {
        raw_text: desc || title,
        source_type: 'manual'
      }
    };

    console.log('[NoticeIQ ManualTask] 2. Prepared newTask payload passed to onTaskCreated:', newTask);
    onTaskCreated(newTask);
  };

  const handleLoadSample = (sample) => {
    handleRemoveFile();
    setNoticeText(sample.text);
    setErrorMsg('');
    setShowManualFallback(false);
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getPresetIcon = (category) => {
    switch (category) {
      case 'Urgent Lab':
        return <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />;
      case 'Exam Circular':
        return <FileText className="w-3.5 h-3.5 text-[var(--accent-primary)]" />;
      case 'Placement Drive':
        return <Briefcase className="w-3.5 h-3.5 text-emerald-500" />;
      case 'Club Event':
        return <Award className="w-3.5 h-3.5 text-purple-500" />;
      default:
        return <BookOpen className="w-3.5 h-3.5 text-[var(--accent-primary)]" />;
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200/60 dark:border-[#23333d]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-[var(--accent-light)] text-[var(--accent-primary)] border border-[var(--accent-light-border)]">
              <Sparkles className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-[#e6edf2] tracking-tight">
              Capture & Extract Notice
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-[#8e9fa8] mt-1">
            Upload a screenshot, attach a PDF circular, or paste raw text. Gemini AI organizes everything automatically.
          </p>
        </div>

        <button
          onClick={onCancel}
          className="text-xs font-semibold text-slate-500 dark:text-[#8e9fa8] hover:text-slate-800 dark:hover:text-[#e6edf2] px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#141f26] transition-colors cursor-pointer"
        >
          Cancel & Back
        </button>
      </div>

      {/* Main Form & Presets Card */}
      <div className="bg-white dark:bg-[#1b262d] rounded-3xl p-6 border border-slate-200/60 dark:border-[#23333d]/70 shadow-2xs space-y-6">
        
        {/* Sample Notice Quick Pickers */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#8e9fa8] flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              Quick Sample Notices (1-Click Test Presets)
            </label>
            <span className="text-[11px] text-slate-400 dark:text-[#8e9fa8]">Click to fill</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
            {SAMPLE_NOTICES.map((sample, idx) => {
              const cleanTitle = sample.title.replace(/^[\s\p{Emoji}\u200d]+/gu, '').trim();
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleLoadSample(sample)}
                  className="p-3 rounded-2xl border border-slate-200/60 dark:border-[#23333d] hover:border-[var(--accent-primary)] bg-slate-50/70 dark:bg-[#141f26] hover:bg-[var(--accent-light)] text-left transition-all text-xs group space-y-1 cursor-pointer"
                >
                  <div className="flex items-center gap-1.5">
                    {getPresetIcon(sample.category)}
                    <span className="text-[10px] font-bold text-slate-500 dark:text-[#8e9fa8] uppercase tracking-wider block">
                      {sample.category}
                    </span>
                  </div>
                  <span className="font-bold text-slate-800 dark:text-[#e6edf2] block truncate group-hover:text-[var(--accent-text)]">
                    {cleanTitle}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Input Methods: Upload Buttons + Dropzone */}
        <div className="space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-[#e6edf2]">
            Notice Input (Upload Screenshot, PDF, or Paste Text)
          </label>

          <input
            ref={screenshotInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,image/png,image/jpeg"
            onChange={handleScreenshotChange}
            className="hidden"
          />
          <input
            ref={pdfInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handlePdfChange}
            className="hidden"
          />

          {/* Action Buttons for Screenshot and PDF */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => screenshotInputRef.current?.click()}
              className="p-4 rounded-2xl border-2 border-dashed border-slate-200/80 dark:border-[#23333d] hover:border-[var(--accent-primary)] bg-slate-50/60 dark:bg-[#141f26] hover:bg-[var(--accent-light)] text-slate-700 dark:text-[#e6edf2] transition-all flex items-center justify-center gap-3 group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-[var(--accent-light)] text-[var(--accent-primary)] flex items-center justify-center group-hover:scale-105 transition-transform border border-[var(--accent-light-border)]">
                <ImageIcon className="w-4 h-4" />
              </div>
              <div className="text-left">
                <span className="text-xs font-bold block">Upload Screenshot</span>
                <span className="text-[10px] text-slate-400 dark:text-[#8e9fa8] block">PNG, JPG, JPEG (Max 10MB)</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => pdfInputRef.current?.click()}
              className="p-4 rounded-2xl border-2 border-dashed border-slate-200/80 dark:border-[#23333d] hover:border-[var(--accent-primary)] bg-slate-50/60 dark:bg-[#141f26] hover:bg-[var(--accent-light)] text-slate-700 dark:text-[#e6edf2] transition-all flex items-center justify-center gap-3 group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-[#142922] text-emerald-700 dark:text-emerald-300 flex items-center justify-center group-hover:scale-105 transition-transform border border-emerald-200/60 dark:border-[#1c483a]">
                <FileText className="w-4 h-4" />
              </div>
              <div className="text-left">
                <span className="text-xs font-bold block">Upload PDF</span>
                <span className="text-[10px] text-slate-400 dark:text-[#8e9fa8] block">Official Circulars (.pdf, Max 10MB)</span>
              </div>
            </button>
          </div>

          {/* File Selected Preview Box */}
          {uploadedFile && (
            <div className="p-4 rounded-2xl bg-[var(--accent-light)] border border-[var(--accent-light-border)] flex items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-center gap-3 min-w-0">
                {uploadedFile.isImage ? (
                  <img
                    src={uploadedFile.previewUrl}
                    alt="Notice screenshot preview"
                    className="w-12 h-12 rounded-xl object-cover border border-[var(--accent-primary)] shadow-2xs shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-rose-100 dark:bg-[#2b191e] text-rose-700 dark:text-rose-300 flex items-center justify-center border border-rose-200 dark:border-rose-900/60 shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-[#e6edf2] truncate">
                      {uploadedFile.name}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--accent-badge-bg)] text-[var(--accent-badge-text)] uppercase">
                      {uploadedFile.isImage ? 'Screenshot' : 'PDF Document'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-[#8e9fa8] mt-0.5">
                    {formatFileSize(uploadedFile.size)} • Ready for Multimodal AI Analysis
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (uploadedFile.isImage) screenshotInputRef.current?.click();
                    else pdfInputRef.current?.click();
                  }}
                  className="p-1.5 text-xs text-slate-600 dark:text-slate-300 hover:text-[var(--accent-text)] hover:bg-white/50 dark:hover:bg-[#142229] rounded-lg transition-colors cursor-pointer"
                  title="Reselect file"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="p-1.5 text-xs text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-[#2b191e] rounded-lg transition-colors cursor-pointer"
                  title="Remove file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Textarea for pasted text */}
          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#8e9fa8]">
              <span>Or paste raw text / WhatsApp message:</span>
              <span className="text-[11px] text-slate-400 dark:text-[#8e9fa8]">XSS sanitized</span>
            </div>
            <div className="relative">
              <textarea
                rows={6}
                value={noticeText}
                onChange={(e) => {
                  setNoticeText(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder={`*DEPARTMENT CIRCULAR*\nDear Students, submit your assignments by tomorrow 5 PM. Bring College ID for verification...`}
                disabled={isLoading}
                className="w-full p-4 rounded-2xl border border-slate-200/80 dark:border-[#23333d] bg-white dark:bg-[#141f26] text-slate-800 dark:text-[#e6edf2] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)] focus:border-[var(--accent-primary)] font-mono transition-all resize-y disabled:bg-slate-50 dark:disabled:bg-[#141f26]/40"
              />
              {noticeText && !isLoading && (
                <button
                  onClick={() => setNoticeText('')}
                  className="absolute top-3 right-3 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-[#1b262d] px-2 py-1 rounded-md transition-colors cursor-pointer"
                >
                  Clear text
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Action Button & Rate Limit / Status Display */}
        <div className="space-y-3">
          {!isLoading ? (
            <div className="space-y-2">
              <button
                id="capture-analyze-button"
                onClick={handleAnalyze}
                disabled={isLoading}
                className="w-full py-3.5 rounded-2xl font-bold text-sm text-white bg-[var(--accent-primary)] hover:opacity-90 shadow-2xs transition-all flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Analyze Notice</span>
              </button>

              <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-[#8e9fa8] px-1">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-[var(--accent-primary)]" />
                  Client Rate Limiter Active (Max 10 req/min)
                </span>
                <span className="font-semibold text-slate-500 dark:text-[#8e9fa8]">
                  {sessionCount} {sessionCount === 1 ? 'request' : 'requests'} this session
                </span>
              </div>

              <div className="pt-1 flex justify-center">
                <button
                  type="button"
                  id="toggle-manual-form-button"
                  onClick={() => setShowManualFallback((prev) => !prev)}
                  className="text-xs font-semibold text-[var(--accent-primary)] hover:underline flex items-center gap-1 cursor-pointer py-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{showManualFallback ? 'Hide Manual Task Form' : 'Or add a task manually without AI'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-[var(--accent-light)] border border-[var(--accent-light-border)] flex flex-col items-center justify-center space-y-3 animate-pulse-subtle">
              <Loader2 className="w-8 h-8 text-[var(--accent-primary)] animate-spin" />
              <div className="text-center">
                <p className="text-sm font-bold text-slate-900 dark:text-[#e6edf2]">
                  {loadingStep || 'Processing notice with Gemini...'}
                </p>
                <p className="text-xs text-slate-500 dark:text-[#8e9fa8] mt-0.5">
                  Multimodal extraction: parsing visual text, deadline urgency, and document requirements (20s timeout safe)
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Error / Fallback Alert */}
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-[#2b2214] border border-amber-200/80 dark:border-[#4d3a1d] text-amber-900 dark:text-amber-200 text-xs flex items-start gap-3 animate-fade-in">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-sm">{errorMsg}</p>
              <p className="text-amber-700 dark:text-amber-300/80">
                You can fill in the task details using the manual form below.
              </p>
            </div>
          </div>
        )}

        {/* Manual Form Fallback */}
        {showManualFallback && (
          <form
            onSubmit={handleManualSubmit}
            className="p-5 rounded-3xl bg-slate-50 dark:bg-[#141f26] border border-slate-200/60 dark:border-[#23333d] space-y-4 animate-slide-up"
          >
            <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-[#e6edf2] text-sm pb-2 border-b border-slate-200/60 dark:border-[#23333d]">
              <Plus className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>Add Task Manually</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#e6edf2] mb-1">
                  Task Name *
                </label>
                <input
                  type="text"
                  required
                  value={manualForm.task_name}
                  onChange={(e) =>
                    setManualForm({ ...manualForm, task_name: e.target.value })
                  }
                  placeholder="e.g. Submit Python Lab Assignment"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200/80 dark:border-[#23333d] bg-white dark:bg-[#1b262d] text-slate-900 dark:text-[#e6edf2] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#e6edf2]">
                    Deadline
                  </label>
                  {manualForm.deadline && (
                    <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      {parseDeadlineToISO(manualForm.deadline) 
                        ? `✓ ${formatDisplayDeadline(parseDeadlineToISO(manualForm.deadline))}` 
                        : '⚠️ Unrecognized date'}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={manualForm.deadline}
                  onChange={(e) =>
                    setManualForm({ ...manualForm, deadline: e.target.value })
                  }
                  placeholder="e.g. Tomorrow, 11:59 PM or 28 August"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200/80 dark:border-[#23333d] bg-white dark:bg-[#1b262d] text-slate-900 dark:text-[#e6edf2] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <button
                    type="button"
                    onClick={() => setManualForm({ ...manualForm, deadline: 'Today, 11:59 PM' })}
                    className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-slate-200/70 hover:bg-slate-300 dark:bg-[#1b262d] dark:hover:bg-[#23333d] text-slate-700 dark:text-[#8e9fa8] transition-colors cursor-pointer"
                  >
                    Today 11:59 PM
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualForm({ ...manualForm, deadline: 'Tomorrow, 11:59 PM' })}
                    className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-slate-200/70 hover:bg-slate-300 dark:bg-[#1b262d] dark:hover:bg-[#23333d] text-slate-700 dark:text-[#8e9fa8] transition-colors cursor-pointer"
                  >
                    Tomorrow 11:59 PM
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 3);
                      setManualForm({ ...manualForm, deadline: `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}, 11:59 PM` });
                    }}
                    className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-slate-200/70 hover:bg-slate-300 dark:bg-[#1b262d] dark:hover:bg-[#23333d] text-slate-700 dark:text-[#8e9fa8] transition-colors cursor-pointer"
                  >
                    In 3 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 7);
                      setManualForm({ ...manualForm, deadline: `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}, 11:59 PM` });
                    }}
                    className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-slate-200/70 hover:bg-slate-300 dark:bg-[#1b262d] dark:hover:bg-[#23333d] text-slate-700 dark:text-[#8e9fa8] transition-colors cursor-pointer"
                  >
                    In 1 Week
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#e6edf2] mb-1">
                  Priority
                </label>
                <select
                  value={manualForm.priority}
                  onChange={(e) =>
                    setManualForm({ ...manualForm, priority: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200/80 dark:border-[#23333d] text-sm focus:outline-none focus:border-[var(--accent-primary)] bg-white dark:bg-[#1b262d] text-slate-900 dark:text-[#e6edf2]"
                >
                  <option value="high">High Priority (Within 24-48h)</option>
                  <option value="medium">Medium Priority (Within a week)</option>
                  <option value="low">Low Priority (Over a week / flexible)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#e6edf2] mb-1">
                  Source Label
                </label>
                <input
                  type="text"
                  value={manualForm.source_label}
                  onChange={(e) =>
                    setManualForm({ ...manualForm, source_label: e.target.value })
                  }
                  placeholder="e.g. Lab Circular, WhatsApp Group"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200/80 dark:border-[#23333d] bg-white dark:bg-[#1b262d] text-slate-900 dark:text-[#e6edf2] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#e6edf2] mb-1">
                  Required Documents (Comma separated)
                </label>
                <input
                  type="text"
                  value={manualForm.required_documents}
                  onChange={(e) =>
                    setManualForm({
                      ...manualForm,
                      required_documents: e.target.value
                    })
                  }
                  placeholder="e.g. College ID Card, Fee Receipt"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200/80 dark:border-[#23333d] bg-white dark:bg-[#1b262d] text-slate-900 dark:text-[#e6edf2] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#e6edf2] mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={manualForm.description}
                  onChange={(e) =>
                    setManualForm({
                      ...manualForm,
                      description: e.target.value
                    })
                  }
                  placeholder="Any extra instructions, room numbers, or guidelines..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200/80 dark:border-[#23333d] bg-white dark:bg-[#1b262d] text-slate-900 dark:text-[#e6edf2] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowManualFallback(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-[#8e9fa8] hover:bg-slate-200 dark:hover:bg-[#141f26] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[var(--accent-primary)] hover:opacity-90 transition-colors shadow-2xs cursor-pointer"
              >
                Save Task to Workspace
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
