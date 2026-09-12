/**
 * Security and Data Sanitization Utilities for NoticeIQ
 */

/**
 * Masks an API key so that only the first 4 and last 4 characters are visible.
 * Example: "AIzaSyD-1234567890abcdef" -> "AIza••••••••cdef"
 */
export function maskApiKey(key) {
  if (!key || typeof key !== 'string') return '';
  const trimmed = key.trim();
  if (trimmed.length <= 8) {
    return '••••••••';
  }
  const firstFour = trimmed.slice(0, 4);
  const lastFour = trimmed.slice(-4);
  return `${firstFour}••••••••${lastFour}`;
}

/**
 * Sanitizes input text before rendering or saving to prevent XSS.
 * Strips script tags, javascript: pseudo-protocols, and inline event handlers.
 */
export function sanitizeNoticeInput(text) {
  if (!text || typeof text !== 'string') return '';

  let sanitized = text;

  // Strip <script> ... </script> tags and contents
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Strip self-closing script tags or unclosed tags
  sanitized = sanitized.replace(/<script\b[^>]*>/gi, '');
  sanitized = sanitized.replace(/<\/script>/gi, '');

  // Strip dangerous HTML tags (iframe, object, embed, applet, form)
  sanitized = sanitized.replace(/<\/?(?:iframe|object|embed|applet|form|meta|link)\b[^>]*>/gi, '');

  // Strip inline javascript: and data: javascript execution
  sanitized = sanitized.replace(/javascript\s*:/gi, '');
  sanitized = sanitized.replace(/vbscript\s*:/gi, '');

  // Strip dangerous inline event handlers (onload, onerror, onclick, onmouseover, etc.)
  sanitized = sanitized.replace(/\bon\w+\s*=\s*(['"]).*?\1/gi, '');
  sanitized = sanitized.replace(/\bon\w+\s*=\s*[^>\s]+/gi, '');

  return sanitized;
}

/**
 * Strips API keys from any strings or error objects before logging
 */
export function scrubSensitiveData(data) {
  if (!data) return data;
  if (typeof data === 'string') {
    // Match common Gemini / Google API key patterns (AIzaSy...)
    return data.replace(/AIza[0-9A-Za-z-_]{35}/g, '[MASKED_API_KEY]');
  }
  if (typeof data === 'object') {
    try {
      const json = JSON.stringify(data);
      const scrubbed = json.replace(/AIza[0-9A-Za-z-_]{35}/g, '[MASKED_API_KEY]');
      return JSON.parse(scrubbed);
    } catch {
      return data;
    }
  }
  return data;
}

/**
 * Dev-only console logger that automatically scrubs sensitive API keys.
 * Will not output anything in production builds.
 */
export function devLog(...args) {
  if (import.meta.env && import.meta.env.DEV) {
    const scrubbedArgs = args.map((arg) => {
      if (typeof arg === 'string') return scrubSensitiveData(arg);
      if (arg instanceof Error) {
        const clonedErr = new Error(scrubSensitiveData(arg.message));
        clonedErr.stack = scrubSensitiveData(arg.stack);
        return clonedErr;
      }
      return scrubSensitiveData(arg);
    });
    console.log(...scrubbedArgs);
  }
}

/**
 * Dev-only console warning logger that scrubs sensitive keys.
 */
export function devWarn(...args) {
  if (import.meta.env && import.meta.env.DEV) {
    const scrubbedArgs = args.map((arg) => {
      if (typeof arg === 'string') return scrubSensitiveData(arg);
      return scrubSensitiveData(arg);
    });
    console.warn(...scrubbedArgs);
  }
}
