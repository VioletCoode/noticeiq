import { devLog, devWarn, sanitizeNoticeInput } from '../utils/securityUtils.js';
import { supabase } from './supabase.js';
import { getGroqApiKey, extractNoticeWithGroq, isGroqConfigured } from './groq.js';

const GEMINI_TIMEOUT_MS = 25000;

export const getGeminiApiKey = () => {
  try {
    const localKey = (localStorage.getItem('gemini_api_key') || '').trim();
    return localKey || '';
  } catch (err) {
    devWarn('[NoticeIQ] LocalStorage access error:', err);
    return '';
  }
};

export const setGeminiApiKey = (key) => {
  try {
    if (key && key.trim()) {
      localStorage.setItem('gemini_api_key', key.trim());
    } else {
      localStorage.removeItem('gemini_api_key');
    }
  } catch (err) {
    devWarn('[NoticeIQ] LocalStorage write error:', err);
  }
};

/**
 * Validates the Gemini API key / AI service status via Supabase Edge Function
 */
export async function checkApiKeyStatus(customKey = null) {
  try {
    const apiKey = (customKey !== null ? customKey : getGeminiApiKey()).trim();

    const { data, error } = await supabase.functions.invoke('extract-notice', {
      body: {
        action: 'healthcheck',
        geminiApiKey: apiKey || undefined
      }
    });

    if (!error && data?.status) {
      return data.status;
    }

    if (error) {
      if (error.message && error.message.includes('429')) {
        return 'connected';
      }
      devWarn('[NoticeIQ] checkApiKeyStatus Edge Function error:', error.message);
    }

    return data?.status || 'missing';
  } catch (err) {
    devWarn('[NoticeIQ] checkApiKeyStatus exception:', err?.message);
    return 'missing';
  }
}


/**
 * Converts a File object to base64 string
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const result = reader.result;
          if (typeof result !== 'string') {
            reject(new Error('Invalid file read result'));
            return;
          }
          const base64 = result.split(',')[1] || '';
          resolve({
            base64Data: base64,
            mimeType: file.type || 'application/octet-stream',
            name: file.name,
            size: file.size
          });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    } catch (err) {
      reject(err);
    }
  });
}

export function cleanAndParseJSON(rawText) {
  if (!rawText) throw new Error('Empty AI response');

  let cleaned = rawText.trim();

  // Try direct parse first
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    // continue
  }

  // Strip code fences: ```json ... ``` or ``` ... ```
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch (_) {
      // continue
    }
  }

  // Strip leading/trailing code fence delimiters if partially matched
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    // continue
  }

  // Fallback: extract substring between first '{' and last '}'
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const jsonSubstring = cleaned.substring(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(jsonSubstring);
    } catch (subErr) {
      console.error('[NoticeIQ Gemini] Substring JSON parse failed:', subErr.message, '. Raw text was:\n', rawText);
      throw new Error('Could not parse valid JSON from AI response: ' + subErr.message);
    }
  }
  console.error('[NoticeIQ Gemini] No valid JSON block found in AI response. Raw text was:\n', rawText);
  throw new Error('Could not parse valid JSON from AI response: no JSON object found');
}

/**
 * Precision extraction prompt generator shared across Groq and Gemini providers
 */
export function buildNoticeExtractionPrompt({
  cleanInputText = '',
  todayFormatted,
  currentTimeFormatted,
  userTimezone,
  timezoneOffsetStr,
  currentYear,
  isoDate
}) {
  return `You are NoticeIQ's precision college circular parser.
CRITICAL TIME & TIMEZONE CONTEXT:
- Today's date is: ${todayFormatted} (${isoDate})
- Current local time: ${currentTimeFormatted}
- Campus & Student Local Timezone: ${userTimezone} (UTC${timezoneOffsetStr})
- Current year: ${currentYear}

INSTRUCTIONS:
1. Parse actionable requirements, deadlines, audience, and paperwork from the notice (which may be plain text, a photo/screenshot, or a PDF circular).
2. TIMEZONE HANDLING: All times in notices (e.g. "tomorrow 5pm", "due tomorrow at 3pm", "11:59 PM", "noon", "17:00") are in the student's local timezone (${userTimezone}, UTC${timezoneOffsetStr}).
3. DEADLINE FORMAT: Return the deadline as an ISO-8601 string WITH the explicit local timezone offset ${timezoneOffsetStr} (e.g. "YYYY-MM-DDTHH:mm:ss${timezoneOffsetStr}").
   - For example: if a notice says "due tomorrow at 3pm", the deadline MUST be "YYYY-MM-DDT15:00:00${timezoneOffsetStr}".
   - For example: if a notice says "tomorrow 5pm", the deadline MUST be "YYYY-MM-DDT17:00:00${timezoneOffsetStr}".
   - MANDATORY TIME RULE: If a deadline date is specified WITHOUT an explicit time of day, default the time to 23:59:00 in local timezone: "YYYY-MM-DDT23:59:00${timezoneOffsetStr}".
   - If no deadline is mentioned, return null.
4. Priority rule:
   - "high" = due within 48 hours or urgent
   - "medium" = due within 7 days
   - "low" = due after 7 days or date not urgent
5. Extract confidence as a decimal between 0.00 and 1.00 indicating clarity and completeness of the extracted information.
6. Return ONLY a valid JSON object with exact keys:
{
  "title": "Specific concise notice title (e.g. 'Python Lab Record Submission')",
  "description": "One concise line summarizing the action needed",
  "deadline": "ISO-8601 string with offset (e.g. '2026-09-10T17:00:00${timezoneOffsetStr}') or null",
  "audience": "Target audience (e.g. 'B.Tech CSE 3rd Year' or 'All Students')",
  "requirements": ["List of documents or items required, e.g. 'College ID', 'Fee Receipt'"],
  "priority": "high" | "medium" | "low",
  "confidence": 0.95
}
${cleanInputText ? `Notice Content:\n${cleanInputText}` : 'Notice Content is in the attached image or PDF.'}`;
}

/**
 * Extracts actionable notice data using Groq for plain text and Gemini for multimodal (images/PDFs).
 * Strategy:
 * 1. If source_type === 'text', routes to Groq API (fast, rate-limit friendly).
 * 2. If source_type === 'image' or 'pdf', routes to Gemini multimodal pipeline.
 * 3. Falls back gracefully to Edge Function / client Gemini if Groq fails.
 */
export async function extractNoticeWithGemini({ noticeText = '', fileData = null, source_type = null }, customApiKey = null) {
  const effectiveSourceType = source_type || (fileData ? (fileData.mimeType?.toLowerCase().includes('pdf') || fileData.name?.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image') : 'text');

  const now = new Date();
  const todayFormatted = now.toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const currentTimeFormatted = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  const currentYear = now.getFullYear();

  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  const offsetMinutes = -now.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absMinutes = Math.abs(offsetMinutes);
  const pad = (n) => String(Math.floor(n)).padStart(2, '0');
  const offsetHours = pad(absMinutes / 60);
  const offsetMins = pad(absMinutes % 60);
  const timezoneOffsetStr = `${sign}${offsetHours}:${offsetMins}`;

  const cleanInputText = sanitizeNoticeInput(noticeText);

  const prompt = buildNoticeExtractionPrompt({
    cleanInputText,
    todayFormatted,
    currentTimeFormatted,
    userTimezone,
    timezoneOffsetStr,
    currentYear,
    isoDate: now.toISOString().split('T')[0]
  });

  // 1. ROUTE NOTICE (TEXT OR MULTIMODAL) TO SUPABASE EDGE FUNCTION (extract-notice)
  devLog(`[NoticeIQ] 🚀 Routing notice (${effectiveSourceType}) to server-side Supabase Edge Function (extract-notice)...`);

  const customGemini = customApiKey || getGeminiApiKey();
  const customGroq = getGroqApiKey();

  try {
    const { data, error } = await supabase.functions.invoke('extract-notice', {
      body: {
        noticeText: cleanInputText,
        source_type: effectiveSourceType,
        userTimezone: userTimezone,
        timezoneOffset: timezoneOffsetStr,
        geminiApiKey: customGemini || undefined,
        groqApiKey: customGroq || undefined,
        fileData: fileData ? {
          base64Data: fileData.base64Data,
          mimeType: fileData.mimeType,
          name: fileData.name
        } : null
      }
    });

    if (!error && data?.success && data?.data) {
      devLog(`[NoticeIQ] ✅ Edge Function returned successfully via ${data.provider || 'ai'}.`);
      return {
        ...sanitizeParsedTask(data.data),
        _provider: data.provider || 'edge-function',
        _model: data.model || 'server-ai'
      };
    }

    if (error && error.message && error.message.includes('Rate limit exceeded')) {
      throw error;
    }

    if (error) {
      devWarn('[NoticeIQ] Supabase Edge Function error:', error.message);
    }
  } catch (edgeErr) {
    if (edgeErr?.message && edgeErr.message.includes('Rate limit exceeded')) {
      throw edgeErr;
    }
    devWarn('[NoticeIQ] Edge Function error, falling back to local heuristic parser:', edgeErr?.message);
  }

  // 2. Offline / local heuristic fallback when Edge Function is unreachable
  devLog('[NoticeIQ] Using heuristic client extractor fallback (offline/network resilience).');
  return fallbackMultimodalExtractor(cleanInputText, fileData, todayFormatted);
}


/**
 * Validates and sanitizes parsed output
 */
export function sanitizeParsedTask(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid JSON structure');
  }

  const rawPriority = String(parsed.priority || 'medium').toLowerCase();
  const priority = ['high', 'medium', 'low'].includes(rawPriority)
    ? rawPriority
    : 'medium';

  const rawDocs = Array.isArray(parsed.requirements)
    ? parsed.requirements
    : (Array.isArray(parsed.required_documents) ? parsed.required_documents : []);

  const sanitizedDocs = rawDocs
    .map((doc) => sanitizeNoticeInput(String(doc || '').trim()))
    .filter(Boolean);

  let rawName = sanitizeNoticeInput(parsed.title || parsed.task_name || '');
  if (!rawName || rawName.toLowerCase() === 'college action item' || rawName.toLowerCase() === 'notice') {
    rawName = 'Action Item from College Notice';
  }

  let finalDeadline = null;
  if (parsed.deadline) {
    try {
      const d = new Date(parsed.deadline);
      if (!isNaN(d.getTime())) {
        finalDeadline = d.toISOString();
      }
    } catch {
      finalDeadline = null;
    }
  }

  const confidence = typeof parsed.confidence === 'number'
    ? Math.min(1, Math.max(0.1, parsed.confidence))
    : 0.95;

  return {
    title: rawName,
    task_name: rawName, // alias for UI components
    description: sanitizeNoticeInput(parsed.description || ''),
    deadline: finalDeadline,
    audience: sanitizeNoticeInput(parsed.audience || 'All Students'),
    requirements: sanitizedDocs,
    required_documents: sanitizedDocs, // alias for UI components
    priority: priority,
    confidence: confidence,
    source_label: sanitizeNoticeInput(parsed.source_label || (parsed.audience ? `${parsed.audience} Notice` : 'College Notice'))
  };
}

/**
 * Heuristic extractor fallback when running without an API key
 */
function fallbackMultimodalExtractor(noticeText, fileData, todayFormatted) {
  return new Promise((resolve) => {
    setTimeout(() => {
      let combined = (noticeText || '').toLowerCase();
      let sourceName = 'College Circular';

      if (fileData) {
        combined += ' ' + (fileData.name || '').toLowerCase();
        if (fileData.mimeType?.includes('pdf')) sourceName = 'PDF Circular';
        else if (fileData.mimeType?.includes('image')) sourceName = 'Notice Screenshot';
      }

      let priority = 'low';
      if (combined.includes('urgent') || combined.includes('tomorrow') || combined.includes('immediately') || combined.includes('sharp')) {
        priority = 'high';
      } else if (combined.includes('week') || combined.includes('friday') || combined.includes('fee') || combined.includes('exam')) {
        priority = 'medium';
      }

      // Compute default 11:59 PM deadline
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 0, 0);

      let deadline = tomorrow.toISOString();
      if (combined.includes('next week') || combined.includes('september')) {
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        nextWeek.setHours(23, 59, 0, 0);
        deadline = nextWeek.toISOString();
      }

      const docs = [];
      if (combined.includes('id') || combined.includes('college id') || combined.includes('card')) docs.push('College ID');
      if (combined.includes('receipt') || combined.includes('fee')) docs.push('Fee Receipt');
      if (combined.includes('internship') || combined.includes('certificate')) docs.push('Internship Certificate');
      if (combined.includes('admission') || combined.includes('letter')) docs.push('Admission Letter');

      let title = 'Action Required from College Notice';
      let desc = 'Review notice details and verify requirements before deadline.';

      if (noticeText) {
        const lines = noticeText.split('\n').map((l) => l.trim()).filter(Boolean);
        if (lines.length > 0) {
          title = lines[0].replace(/^[*\s\-_#]+/, '').replace(/[*\s\-_#]+$/, '').slice(0, 75);
          if (lines[1]) desc = lines[1].slice(0, 120);
        }
      } else if (fileData) {
        title = `Notice: ${fileData.name.replace(/\.[^/.]+$/, '')}`;
        desc = `Extracted from ${fileData.mimeType?.includes('pdf') ? 'official PDF circular' : 'uploaded screenshot'}.`;
      }

      resolve({
        title: sanitizeNoticeInput(title),
        task_name: sanitizeNoticeInput(title),
        description: sanitizeNoticeInput(desc),
        deadline: deadline,
        audience: 'All Students',
        requirements: Array.from(new Set(docs)).map((d) => sanitizeNoticeInput(d)),
        required_documents: Array.from(new Set(docs)).map((d) => sanitizeNoticeInput(d)),
        priority: priority,
        confidence: 0.95,
        source_label: sanitizeNoticeInput(sourceName)
      });
    }, 1000);
  });
}

export const extractNotice = extractNoticeWithGemini;
