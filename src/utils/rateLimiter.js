/**
 * Client-side Rate Limiter for NoticeIQ
 * Prevents accidental overuse or rapid-fire abuse during demos/testing.
 * Limit: 10 requests per 60-second window.
 * Tracks total session requests for UI status display.
 */

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;
const SESSION_STORAGE_KEY_TIMESTAMPS = 'noticeiq_rate_timestamps_v1';
const SESSION_STORAGE_KEY_COUNT = 'noticeiq_session_req_count_v1';

/**
 * Gets timestamps of requests made in the current window.
 */
function getRecentTimestamps() {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY_TIMESTAMPS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const now = Date.now();
    // Keep only timestamps within the last 60 seconds
    return Array.isArray(parsed) ? parsed.filter((t) => now - t < RATE_LIMIT_WINDOW_MS) : [];
  } catch {
    return [];
  }
}

/**
 * Checks if a new request is allowed under the rate limit.
 * Returns: { allowed: boolean, remainingSeconds: number, sessionCount: number }
 */
export function checkRateLimit() {
  const timestamps = getRecentTimestamps();
  const sessionCount = getSessionRequestCount();

  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldest = timestamps[0];
    const now = Date.now();
    const elapsed = now - oldest;
    const remainingSeconds = Math.max(1, Math.ceil((RATE_LIMIT_WINDOW_MS - elapsed) / 1000));
    return {
      allowed: false,
      remainingSeconds,
      sessionCount
    };
  }

  return {
    allowed: true,
    remainingSeconds: 0,
    sessionCount
  };
}

/**
 * Records a new request timestamp and increments the session request count.
 * Returns the updated total session request count.
 */
export function recordSessionRequest() {
  const timestamps = getRecentTimestamps();
  timestamps.push(Date.now());
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY_TIMESTAMPS, JSON.stringify(timestamps));
  } catch {
    // ignore sessionStorage errors
  }

  const newSessionCount = getSessionRequestCount() + 1;
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY_COUNT, String(newSessionCount));
  } catch {
    // ignore
  }

  return newSessionCount;
}

/**
 * Gets total number of requests made in the active browser session.
 */
export function getSessionRequestCount() {
  try {
    const val = sessionStorage.getItem(SESSION_STORAGE_KEY_COUNT);
    return val ? parseInt(val, 10) || 0 : 0;
  } catch {
    return 0;
  }
}
