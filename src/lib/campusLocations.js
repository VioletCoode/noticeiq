import { supabase, isSupabaseConfigured } from '../services/supabase';

/**
 * Default fallback campus locations for offline usage or before migrations are run.
 */
export const DEFAULT_CAMPUS_LOCATIONS = [
  {
    id: 'loc-library',
    room_no: '1-01',
    room_name: 'Library',
    floor: 'First Floor',
    building: 'Main',
    keywords: ['library', 'central library', 'reading room', 'books', 'study hall', 'quiet area'],
    floor_plan_url: '/blueprints/first-floor.svg',
    marker_x: 52.0,
    marker_y: 38.0
  },
  {
    id: 'loc-computer-lab-1',
    room_no: '2-01',
    room_name: 'Computer Lab 1',
    floor: 'Second Floor',
    building: 'Main',
    keywords: ['computer lab 1', 'computer lab', 'python lab', 'programming lab', 'cse lab', 'coding lab', 'cs lab'],
    floor_plan_url: '/blueprints/second-floor.svg',
    marker_x: 74.5,
    marker_y: 62.0
  },
  {
    id: 'loc-admission-cell',
    room_no: 'G-01',
    room_name: 'Admission Cell',
    floor: 'Ground Floor',
    building: 'Main',
    keywords: ['admission cell', 'admission office', 'admissions', 'admin office', 'registration', 'accounts desk'],
    floor_plan_url: '/blueprints/ground-floor.svg',
    marker_x: 28.0,
    marker_y: 45.0
  },
  {
    id: 'loc-cafeteria',
    room_no: 'G-05',
    room_name: 'Cafeteria',
    floor: 'Ground Floor',
    building: 'Main',
    keywords: ['cafeteria', 'canteen', 'food court', 'mess', 'cafe', 'snacks', 'lunch'],
    floor_plan_url: '/blueprints/ground-floor.svg',
    marker_x: 80.0,
    marker_y: 75.0
  },
  {
    id: 'loc-auditorium',
    room_no: '3-01',
    room_name: 'Central Auditorium',
    floor: 'Third Floor',
    building: 'Main',
    keywords: ['auditorium', 'central auditorium', 'seminar hall', 'main hall', 'audi', 'event hall'],
    floor_plan_url: null, // Test case: missing blueprint fallback
    marker_x: 50.0,
    marker_y: 50.0
  },
  {
    id: 'loc-placement-cell',
    room_no: '2-04',
    room_name: 'Placement & Career Cell',
    floor: 'Second Floor',
    building: 'Main',
    keywords: ['placement cell', 'career cell', 'training and placement', 'tnp', 'placement office', 'interview room'],
    floor_plan_url: '/blueprints/second-floor.svg',
    marker_x: 42.0,
    marker_y: 58.0
  }
];

// In-memory cache for fetched locations
let cachedLocations = null;

/**
 * Fetches all campus locations from Supabase once and caches them in memory.
 * Falls back to offline sample locations if unconfigured or on query failure.
 *
 * @param {Object} options
 * @param {boolean} [options.forceRefresh=false] - Force re-fetch from database
 * @returns {Promise<Array>} List of campus location objects
 */
export async function fetchCampusLocations({ forceRefresh = false } = {}) {
  if (cachedLocations && !forceRefresh) {
    return cachedLocations;
  }

  if (!isSupabaseConfigured()) {
    cachedLocations = [...DEFAULT_CAMPUS_LOCATIONS];
    return cachedLocations;
  }

  try {
    const { data, error } = await supabase
      .from('campus_locations')
      .select('*')
      .order('room_name', { ascending: true });

    if (error) {
      console.warn('[NoticeIQ CampusLocations] Error querying campus_locations, using defaults:', error.message);
      cachedLocations = [...DEFAULT_CAMPUS_LOCATIONS];
      return cachedLocations;
    }

    if (!data || data.length === 0) {
      cachedLocations = [...DEFAULT_CAMPUS_LOCATIONS];
      return cachedLocations;
    }

    cachedLocations = data;
    return cachedLocations;
  } catch (err) {
    console.warn('[NoticeIQ CampusLocations] Fetch failed, using fallback:', err);
    cachedLocations = [...DEFAULT_CAMPUS_LOCATIONS];
    return cachedLocations;
  }
}

/**
 * Clears the in-memory locations cache.
 */
export function clearCampusLocationsCache() {
  cachedLocations = null;
}

/**
 * Computes Levenshtein edit distance between two strings.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function levenshteinDistance(a, b) {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix = Array.from({ length: bn + 1 }, () => new Array(an + 1).fill(0));
  for (let i = 0; i <= an; i++) matrix[0][i] = i;
  for (let j = 0; j <= bn; j++) matrix[j][0] = j;

  for (let j = 1; j <= bn; j++) {
    for (let i = 1; i <= an; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + cost
      );
    }
  }

  return matrix[bn][an];
}

/**
 * Computes normalized similarity between 0.0 and 1.0 based on Levenshtein distance.
 */
function stringSimilarity(s1, s2) {
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1;
  const dist = levenshteinDistance(s1, s2);
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Normalizes query string: lowercase, trims, strips punctuation and filler question words.
 *
 * @param {string} rawQuery
 * @returns {string}
 */
export function normalizeQuery(rawQuery) {
  if (!rawQuery || typeof rawQuery !== 'string') return '';

  let q = rawQuery.toLowerCase().trim();

  // Strip punctuation
  q = q.replace(/[?!.,;:'"()\[\]{}\/\\#@$%^&*_+~`]/g, ' ');

  // Strip common filler phrases (ordered longest to shortest)
  const fillerPhrases = [
    'what is the room number of the',
    'what is the room number of',
    'what is the location of the',
    'what is the location of',
    'what room is the',
    'what room is',
    'which floor is the',
    'which floor is',
    'which floor',
    'where can i find the',
    'where can i find',
    'how do i get to the',
    'how do i get to',
    'how can i reach the',
    'how can i reach',
    'how to reach the',
    'how to reach',
    'how to find the',
    'how to find',
    'tell me where is the',
    'tell me where is',
    'tell me the location of',
    'location of the',
    'location of',
    'where is the',
    'where is',
    'where are the',
    'where are',
    'where s',
    'wheres',
    'room no of',
    'room number of',
    'room for',
    'show me the',
    'show me',
    'find the',
    'find a',
    'find'
  ];

  for (const phrase of fillerPhrases) {
    const regex = new RegExp(`(^|\\s)${phrase}(\\s|$)`, 'gi');
    q = q.replace(regex, ' ');
  }

  // Remove trailing/leading spaces and collapse multiple spaces
  return q.replace(/\s+/g, ' ').trim();
}

/**
 * Finds the best matching campus location for a natural language user query.
 *
 * @param {string} query - User input, e.g. "where is the python lab"
 * @param {Array} locations - Array of campus location objects
 * @returns {Object|null} Best matching location or null if no confident match found
 */
export function findRoom(query, locations) {
  if (!query || typeof query !== 'string' || !Array.isArray(locations) || locations.length === 0) {
    return null;
  }

  const cleanedQuery = normalizeQuery(query);
  if (!cleanedQuery) return null;

  const queryWords = cleanedQuery.split(/\s+/).filter((w) => w.length > 1);

  let bestMatch = null;
  let highestScore = 0;
  const MATCH_THRESHOLD = 0.58;

  for (const loc of locations) {
    let locMaxScore = 0;

    // Candidates to compare against: room_name, room_no, keywords
    const candidates = [
      loc.room_name,
      loc.room_no,
      ...(Array.isArray(loc.keywords) ? loc.keywords : [])
    ].filter(Boolean);

    for (const rawCandidate of candidates) {
      const candidate = rawCandidate.toLowerCase().trim();
      if (!candidate) continue;

      let score = 0;

      // 1. Exact equality match
      if (cleanedQuery === candidate) {
        score = 1.0;
      }
      // 2. Exact substring match
      else if (candidate.includes(cleanedQuery) || cleanedQuery.includes(candidate)) {
        // Boost if query is very close in length to candidate
        const ratio = Math.min(cleanedQuery.length, candidate.length) / Math.max(cleanedQuery.length, candidate.length);
        score = Math.max(0.85, 0.85 + ratio * 0.12);
      }
      // 3. Token overlap match (e.g. "python lab" matches candidate "computer lab 1" / keywords)
      else if (queryWords.length > 0) {
        const candidateWords = candidate.split(/\s+/).filter((w) => w.length > 1);
        const matchingWordsCount = queryWords.filter((qw) =>
          candidateWords.some((cw) => cw === qw || cw.includes(qw) || qw.includes(cw))
        ).length;

        if (matchingWordsCount > 0) {
          const overlapRatio = matchingWordsCount / queryWords.length;
          score = Math.max(score, overlapRatio * 0.82);
        }
      }

      // 4. Fuzzy Levenshtein match for typos (e.g. "librari" vs "library", "pyton lab" vs "python lab")
      const sim = stringSimilarity(cleanedQuery, candidate);
      if (sim > 0.72) {
        score = Math.max(score, sim * 0.92);
      }

      // Check per-word fuzzy for multi-word queries against multi-word candidates
      if (queryWords.length > 0 && score < 0.75) {
        const candidateWords = candidate.split(/\s+/).filter((w) => w.length > 1);
        let wordFuzzyMatches = 0;
        for (const qw of queryWords) {
          if (candidateWords.some((cw) => stringSimilarity(qw, cw) >= 0.8)) {
            wordFuzzyMatches++;
          }
        }
        if (wordFuzzyMatches > 0) {
          const wordFuzzyScore = (wordFuzzyMatches / queryWords.length) * 0.8;
          score = Math.max(score, wordFuzzyScore);
        }
      }

      if (score > locMaxScore) {
        locMaxScore = score;
      }
    }

    if (locMaxScore > highestScore) {
      highestScore = locMaxScore;
      bestMatch = loc;
    }
  }

  if (highestScore >= MATCH_THRESHOLD) {
    return bestMatch;
  }

  return null;
}

/**
 * Formats the room answer string according to specification:
 * "<Room name> is in Room <room_no>, <floor>."
 *
 * @param {Object} location
 * @returns {string}
 */
export function formatRoomAnswer(location) {
  if (!location) return '';
  return `${location.room_name} is in Room ${location.room_no}, ${location.floor}.`;
}
