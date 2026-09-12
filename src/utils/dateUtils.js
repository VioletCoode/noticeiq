import * as chrono from 'chrono-node';

const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const MONTH_MAP = {
  jan: 'JAN', january: 'JAN',
  feb: 'FEB', february: 'FEB',
  mar: 'MAR', march: 'MAR',
  apr: 'APR', april: 'APR',
  may: 'MAY',
  jun: 'JUN', june: 'JUN',
  jul: 'JUL', july: 'JUL',
  aug: 'AUG', august: 'AUG',
  sep: 'SEP', sept: 'SEP', september: 'SEP',
  oct: 'OCT', october: 'OCT',
  nov: 'NOV', november: 'NOV',
  dec: 'DEC', december: 'DEC'
};

/**
 * Helper utility to parse human-readable deadline strings or ISO dates into structured
 * date badge information (e.g. Day "10", Month "SEP") showing the actual task deadline.
 */
export function parseDeadlineToDateBadge(deadlineStr) {
  if (!deadlineStr || typeof deadlineStr !== 'string' || !deadlineStr.trim()) {
    return {
      day: '--',
      month: 'NO DUE',
      raw: 'No deadline'
    };
  }

  const clean = deadlineStr.trim();
  const lower = clean.toLowerCase();
  const now = new Date();

  // 1. ISO-8601 or YYYY-MM-DD format (e.g. "2026-09-10T17:00:00.000Z", "2026-09-10")
  const isoMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    if (clean.includes('T') || clean.includes(':')) {
      const d = new Date(clean);
      if (!isNaN(d.getTime())) {
        return {
          day: String(d.getDate()).padStart(2, '0'),
          month: MONTH_NAMES[d.getMonth()] || 'SEP',
          raw: clean
        };
      }
    }
    const monthNum = parseInt(isoMatch[2], 10);
    const dayStr = isoMatch[3];
    const month = MONTH_NAMES[monthNum - 1] || 'SEP';
    return {
      day: dayStr,
      month: month,
      raw: clean
    };
  }

  // 2. Relative keywords: "Tomorrow", "Today", "Tonight", "Immediate"
  if (lower.includes('tomorrow')) {
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    return {
      day: String(tomorrow.getDate()).padStart(2, '0'),
      month: tomorrow.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
      raw: clean
    };
  }

  if (lower.includes('today') || lower.includes('tonight') || lower.includes('immediate')) {
    return {
      day: String(now.getDate()).padStart(2, '0'),
      month: now.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
      raw: clean
    };
  }

  // 3. Pattern: Month then Day, e.g. "Sep 10", "September 10th", "Sep 10, 5:00 PM", "September 10, 2026"
  const monthNamesPattern = Object.keys(MONTH_MAP).join('|');
  const monthDayRegex = new RegExp(`\\b(${monthNamesPattern})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'i');
  const monthDayMatch = clean.match(monthDayRegex);
  if (monthDayMatch) {
    const monthKey = monthDayMatch[1].toLowerCase();
    const day = String(monthDayMatch[2]).padStart(2, '0');
    const month = MONTH_MAP[monthKey] || monthKey.slice(0, 3).toUpperCase();
    return { day, month, raw: clean };
  }

  // 4. Pattern: Day then Month, e.g. "10 Sep", "10th September", "10 Sep, 5:00 PM", "28 August"
  const dayMonthRegex = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthNamesPattern})\\.?\\b`, 'i');
  const dayMonthMatch = clean.match(dayMonthRegex);
  if (dayMonthMatch) {
    const day = String(dayMonthMatch[1]).padStart(2, '0');
    const monthKey = dayMonthMatch[2].toLowerCase();
    const month = MONTH_MAP[monthKey] || monthKey.slice(0, 3).toUpperCase();
    return { day, month, raw: clean };
  }

  // 5. General Date parse (e.g. "Sep 10 2026", "09/10/2026")
  const generalDate = new Date(clean);
  if (!isNaN(generalDate.getTime())) {
    return {
      day: String(generalDate.getDate()).padStart(2, '0'),
      month: generalDate.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
      raw: clean
    };
  }

  // 6. Day of week keywords: "Friday", "next Monday", etc.
  const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let i = 0; i < daysOfWeek.length; i++) {
    if (lower.includes(daysOfWeek[i])) {
      const currentDay = now.getDay();
      let diff = i - currentDay;
      if (diff <= 0) diff += 7; // Next occurrence
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() + diff);
      return {
        day: String(targetDate.getDate()).padStart(2, '0'),
        month: targetDate.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
        raw: clean
      };
    }
  }

  // Fallback for unparseable strings
  return {
    day: '--',
    month: 'DUE',
    raw: clean
  };
}

/**
 * Formats deadline strings cleanly for display in footers and subtitles.
 * e.g. "2026-09-10T17:00:00.000Z" -> "Sep 10, 5:00 PM"
 */
export function formatDisplayDeadline(deadlineStr) {
  if (!deadlineStr || typeof deadlineStr !== 'string') {
    return 'No deadline specified';
  }
  const clean = deadlineStr.trim();
  if (/^\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2})?/.test(clean)) {
    try {
      const d = new Date(clean);
      if (!isNaN(d.getTime())) {
        const month = d.toLocaleString('en-US', { month: 'short' });
        const day = d.getDate();
        if (clean.includes(':') || clean.includes('T')) {
          let hours = d.getHours();
          const minutes = String(d.getMinutes()).padStart(2, '0');
          const ampm = hours >= 12 ? 'PM' : 'AM';
          hours = hours % 12;
          hours = hours ? hours : 12;
          return `${month} ${day}, ${hours}:${minutes} ${ampm}`;
        }
        return `${month} ${day}`;
      }
    } catch {
      // fallback
    }
  }
  return clean;
}

/**
 * Helper to convert deadline strings into comparable timestamps for sorting.
 */
export function getDeadlineToComparableTimestamp(deadlineStr) {
  if (!deadlineStr || typeof deadlineStr !== 'string') {
    return Number.MAX_SAFE_INTEGER;
  }
  const clean = deadlineStr.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    const d = new Date(clean);
    if (!isNaN(d.getTime())) return d.getTime();
  }

  const badge = parseDeadlineToDateBadge(clean);
  if (badge.day === '--') return Number.MAX_SAFE_INTEGER;

  const monthIndices = {
    JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
    JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11
  };
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const monthIdx = monthIndices[badge.month] !== undefined ? monthIndices[badge.month] : currentMonth;
  const day = parseInt(badge.day, 10) || now.getDate();

  let year = currentYear;
  if (monthIdx < currentMonth - 2) {
    year += 1;
  }
  return new Date(year, monthIdx, day).getTime();
}

/**
 * Safely parses any date string, ISO string, datetime-local string,
 * or natural language deadline into a valid ISO-8601 string using chrono-node.
 * Handles both "[time] [date]" and "[date] [time]", ordinal dates ("11th Sept"),
 * and defaults to 11:59 PM only when no explicit time was specified.
 * Returns null if the input is empty or unparseable, NEVER throws RangeError.
 */
export function parseDeadlineToISO(deadlineStr) {
  if (!deadlineStr || typeof deadlineStr !== 'string' || !deadlineStr.trim()) {
    return null;
  }
  const clean = deadlineStr.trim();

  // If already standard ISO with complete date/time e.g. 2026-09-11T21:35:00.000Z
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(clean)) {
    const d = new Date(clean);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  const now = new Date();
  const currentYear = now.getFullYear();

  try {
    const results = chrono.parse(clean, now);
    if (!results || results.length === 0) return null;

    const parsed = results[0];
    const date = parsed.start.date();

    const year = date.getFullYear();
    // Guard against unrealistic years from random numeric strings
    if (year < 2020 || year > currentYear + 5) {
      return null;
    }

    // If time was not explicitly specified by user (e.g. "11th Sept", "Tomorrow"), default to 11:59 PM
    if (!parsed.start.isCertain('hour')) {
      date.setHours(23, 59, 0, 0);
    }

    return date.toISOString();
  } catch {
    return null;
  }
}

/**
 * Calculates dynamic effective priority for UI display purposes based on deadline urgency.
 * Pure display-layer helper that never alters tasks stored in the database.
 * 
 * Rules:
 * 1. If task is completed -> return original stored priority unchanged.
 * 2. If no deadline -> return original stored priority unchanged.
 * 3. Calculate hours remaining until deadline.
 * 4. If deadline is within 24 hours AND stored priority is "medium" or "low" -> return "high".
 * 5. If deadline is within 3 hours AND stored priority is "low" -> return "high" (extra safety).
 * 6. Otherwise -> return original stored priority unchanged.
 * 
 * @param {Object|string} taskOrPriority - Task object or stored priority string
 * @param {string|Date} [maybeDeadline] - Deadline if first param was priority string
 * @param {boolean} [maybeCompleted] - Completed status if first param was priority string
 * @returns {'high'|'medium'|'low'} Effective priority for UI rendering
 */
export function getEffectivePriority(taskOrPriority, maybeDeadline, maybeCompleted) {
  let storedPriority = 'medium';
  let deadline = null;
  let isCompleted = false;

  if (taskOrPriority && typeof taskOrPriority === 'object') {
    storedPriority = taskOrPriority.priority || 'medium';
    deadline = taskOrPriority.deadline;
    isCompleted = Boolean(taskOrPriority.completed || taskOrPriority.status === 'completed');
  } else {
    storedPriority = taskOrPriority || 'medium';
    deadline = maybeDeadline;
    isCompleted = Boolean(maybeCompleted);
  }

  const normalized = String(storedPriority).toLowerCase();

  // Completed tasks are never escalated
  if (isCompleted) {
    return normalized;
  }

  if (!deadline) {
    return normalized;
  }

  let deadlineMs = null;
  if (typeof deadline === 'number') {
    deadlineMs = deadline;
  } else if (deadline instanceof Date) {
    deadlineMs = deadline.getTime();
  } else if (typeof deadline === 'string') {
    const directParsed = new Date(deadline).getTime();
    if (!isNaN(directParsed)) {
      deadlineMs = directParsed;
    } else {
      deadlineMs = getDeadlineToComparableTimestamp(deadline);
    }
  }

  if (!deadlineMs || isNaN(deadlineMs) || deadlineMs === Number.MAX_SAFE_INTEGER) {
    return normalized;
  }

  const nowMs = Date.now();
  const diffMs = deadlineMs - nowMs;
  const hoursRemaining = diffMs / (1000 * 60 * 60);

  // If deadline is within 24 hours AND stored priority is "medium" or "low" → return "high"
  if (hoursRemaining <= 24 && (normalized === 'medium' || normalized === 'low')) {
    return 'high';
  }

  // If deadline is within 3 hours AND stored priority is "low" → return "high"
  if (hoursRemaining <= 3 && normalized === 'low') {
    return 'high';
  }

  return normalized;
}


