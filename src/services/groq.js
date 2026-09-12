import { devLog, devWarn, sanitizeNoticeInput } from '../utils/securityUtils.js';
import { cleanAndParseJSON, sanitizeParsedTask } from './gemini.js';

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const GROQ_TIMEOUT_MS = 15000;

// Preferred model hierarchy: llama-3.3-70b-versatile / llama-3.1-8b-instant, with automatic fallback
const GROQ_TEXT_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'openai/gpt-oss-120b',
  'qwen/qwen3.8-27b',
  'groq/compound-mini'
];

/**
 * Resolves Groq API key from Vite environment or localStorage override
 */
export const getGroqApiKey = () => {
  try {
    const envKey = (
      import.meta.env?.VITE_GROQ_API_KEY ||
      import.meta.env?.GROQ_API_KEY ||
      (typeof process !== 'undefined' && (process.env?.VITE_GROQ_API_KEY || process.env?.GROQ_API_KEY)) ||
      ''
    ).trim();

    const localKey = (typeof localStorage !== 'undefined' ? localStorage.getItem('groq_api_key') : '') || '';
    return envKey || localKey.trim() || '';
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
 * Extracts actionable notice data using Groq OpenAI-compatible API
 * Used exclusively for plain text notices to conserve Gemini multimodal quota.
 */
export async function extractNoticeWithGroq({ noticeText, prompt }, customApiKey = null) {
  const apiKey = (customApiKey || getGroqApiKey() || '').trim();

  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured.');
  }

  const cleanInputText = sanitizeNoticeInput(noticeText);
  let lastError = null;

  for (let i = 0; i < GROQ_TEXT_MODELS.length; i++) {
    const model = GROQ_TEXT_MODELS[i];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);
    const callStart = Date.now();

    try {
      devLog(`[NoticeIQ Groq] [Attempt ${i + 1}/${GROQ_TEXT_MODELS.length}] Calling model: ${model} via ${GROQ_BASE_URL}`);

      const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
          max_tokens: 1024
        })
      });

      clearTimeout(timeoutId);
      const durationMs = Date.now() - callStart;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const rawMsg = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
        devWarn(`[NoticeIQ Groq] Model ${model} returned error (${response.status}): ${rawMsg}`);

        // If model doesn't exist or is not supported in current tier, try next candidate model
        if (
          response.status === 404 ||
          rawMsg.includes('does not exist') ||
          rawMsg.includes('decommissioned') ||
          rawMsg.includes('access')
        ) {
          lastError = new Error(rawMsg);
          continue;
        }

        throw new Error(`Groq API error (${response.status}): ${rawMsg}`);
      }

      const data = await response.json();
      const generatedText = data.choices?.[0]?.message?.content;

      if (!generatedText) {
        throw new Error('No content returned in Groq completion');
      }

      devLog(`[NoticeIQ Groq] Successfully generated text in ${durationMs}ms with ${model}`);
      const parsed = cleanAndParseJSON(generatedText);
      const sanitized = sanitizeParsedTask(parsed);

      return {
        ...sanitized,
        _provider: 'groq',
        _model: model,
        _durationMs: durationMs
      };
    } catch (err) {
      clearTimeout(timeoutId);
      const isAbort = err.name === 'AbortError' || err.message?.includes('aborted');
      if (isAbort) {
        lastError = new Error(`Groq request timed out on model ${model} after ${GROQ_TIMEOUT_MS}ms`);
      } else {
        lastError = err;
      }

      // If it's a model-specific error, continue loop; if fatal network/auth, try next or throw
      if (i === GROQ_TEXT_MODELS.length - 1) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error('All Groq candidate models failed');
}
