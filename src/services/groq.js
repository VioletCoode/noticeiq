import { devLog, devWarn, sanitizeNoticeInput } from '../utils/securityUtils.js';
import { sanitizeParsedTask } from './gemini.js';
import { supabase } from './supabase.js';

/**
 * Resolves Groq API key from localStorage override (if user set a personal key)
 */
export const getGroqApiKey = () => {
  try {
    const localKey = (typeof localStorage !== 'undefined' ? localStorage.getItem('groq_api_key') : '') || '';
    return localKey.trim();
  } catch (err) {
    devWarn('[NoticeIQ Groq] Storage access error:', err);
    return '';
  }
};

/**
 * Persists Groq API key to localStorage
 */
export const setGroqApiKey = (key) => {
  try {
    if (typeof localStorage === 'undefined') return;
    if (key && key.trim()) {
      localStorage.setItem('groq_api_key', key.trim());
    } else {
      localStorage.removeItem('groq_api_key');
    }
  } catch (err) {
    devWarn('[NoticeIQ Groq] Storage write error:', err);
  }
};

export const isGroqConfigured = () => {
  const key = getGroqApiKey();
  return Boolean(key && key.startsWith('gsk_') && key.length > 20);
};

/**
 * Extracts actionable notice data via Supabase Edge Function (server-side Groq execution)
 * Protects GROQ_API_KEY from being bundled or exposed in client browser.
 */
export async function extractNoticeWithGroq({ noticeText }, customApiKey = null) {
  const apiKey = (customApiKey || getGroqApiKey() || '').trim();
  const cleanInputText = sanitizeNoticeInput(noticeText);

  devLog('[NoticeIQ Groq] ⚡ Routing text notice to Supabase Edge Function (extract-notice)...');

  const { data, error } = await supabase.functions.invoke('extract-notice', {
    body: {
      noticeText: cleanInputText,
      source_type: 'text',
      groqApiKey: apiKey || undefined
    }
  });

  if (!error && data?.success && data?.data) {
    devLog(`[NoticeIQ Groq] ✅ Extracted via Edge Function (${data.model || 'groq'})`);
    return {
      ...sanitizeParsedTask(data.data),
      _provider: data.provider || 'groq',
      _model: data.model || 'llama-3.3-70b-versatile'
    };
  }

  if (error) {
    devWarn('[NoticeIQ Groq] Edge Function error:', error.message);
    throw new Error(error.message || 'Groq extraction via Edge Function failed');
  }

  throw new Error(data?.error || 'Failed to extract notice information');
}
