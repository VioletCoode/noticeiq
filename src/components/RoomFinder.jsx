import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  MapPin, 
  Sparkles, 
  RotateCcw, 
  Building2, 
  Layers, 
  Compass, 
  Loader2, 
  ArrowRight,
  Info,
  X,
  Map as MapIcon,
  Eye
} from 'lucide-react';
import { 
  fetchCampusLocations, 
  findRoom, 
  formatRoomAnswer 
} from '../lib/campusLocations';

const QUICK_CHIPS = [
  'Python Lab',
  'Library',
  'Admission Cell',
  'Cafeteria',
  'Auditorium',
  'Placement Cell'
];

export default function RoomFinder() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [lastSearchedQuery, setLastSearchedQuery] = useState('');
  const [matchedRoom, setMatchedRoom] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isBlueprintOpen, setIsBlueprintOpen] = useState(false);
  const inputRef = useRef(null);

  // Fetch campus locations once on mount
  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        setLoading(true);
        const data = await fetchCampusLocations();
        if (mounted) {
          setLocations(data || []);
        }
      } catch (err) {
        console.error('[NoticeIQ RoomFinder] Failed to load campus locations:', err);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  // Keyboard shortcut listener: Escape to close blueprint modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isBlueprintOpen) {
        setIsBlueprintOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isBlueprintOpen]);

  const handleSearch = (searchQuery) => {
    const q = (typeof searchQuery === 'string' ? searchQuery : query).trim();
    if (!q) return;

    setLastSearchedQuery(q);
    setHasSearched(true);
    const result = findRoom(q, locations);
    setMatchedRoom(result);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleSelectChip = (chipText) => {
    setQuery(chipText);
    handleSearch(chipText);
  };

  const handleReset = () => {
    setQuery('');
    setLastSearchedQuery('');
    setMatchedRoom(null);
    setHasSearched(false);
    setIsBlueprintOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className="bg-white dark:bg-[#1b262d] rounded-3xl p-5 sm:p-6 md:p-7 border border-slate-200/70 dark:border-[#23333d] shadow-2xs hover:shadow-subtle transition-all space-y-5 relative overflow-hidden">
      {/* Decorative subtle gradient in top right corner */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-[var(--accent-primary)]/10 via-transparent to-transparent rounded-tr-3xl pointer-events-none" />

      {/* Widget Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#18305A] via-[#493C62] to-[#BB81B5] text-white flex items-center justify-center shadow-2xs shrink-0">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-[#e6edf2] tracking-tight">
                Campus Room Finder
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--accent-badge-bg)] text-[var(--accent-badge-text)] border border-[var(--accent-light-border)]">
                AI Matcher
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-[#8e9fa8] font-medium">
              Ask natural questions like &ldquo;where is the python lab&rdquo; or &ldquo;which floor is the library&rdquo;
            </p>
          </div>
        </div>

        {hasSearched && (
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-[#e6edf2] hover:bg-slate-100 dark:hover:bg-[#141f26] transition-colors cursor-pointer self-start sm:self-auto"
            title="Reset search"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Search Input Box */}
      <div className="relative z-10 space-y-3">
        <div className="relative flex items-center">
          <div className="absolute left-3.5 sm:left-4 text-slate-400 dark:text-[#8e9fa8] pointer-events-none flex items-center justify-center">
            {loading ? (
              <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-[var(--accent-primary)]" />
            ) : (
              <Search className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--accent-primary)]" />
            )}
          </div>

          <input
            ref={inputRef}
            type="text"
            id="campus-room-finder-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder="Where is the Python Lab?"
            className="w-full pl-10 sm:pl-12 pr-24 sm:pr-28 py-3 sm:py-3.5 rounded-2xl bg-slate-100/80 dark:bg-[#141f26] border border-slate-200/80 dark:border-[#23333d] focus:bg-white dark:focus:bg-[#152026] focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-ring)] text-xs sm:text-sm text-slate-900 dark:text-[#e6edf2] placeholder-slate-400 dark:placeholder-[#8e9fa8] transition-all outline-none disabled:opacity-60"
          />

          <div className="absolute right-2 sm:right-2.5 flex items-center gap-1.5">
            <button
              type="button"
              id="campus-room-finder-submit-btn"
              disabled={loading || !query.trim()}
              onClick={() => handleSearch()}
              className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold text-white bg-[var(--accent-primary)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer active:scale-95"
            >
              <span>Find</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap text-xs">
          <span className="text-[11px] font-semibold text-slate-400 dark:text-[#8e9fa8] mr-0.5">
            Try:
          </span>
          {QUICK_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => handleSelectChip(chip)}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#141f26] hover:bg-slate-200/80 dark:hover:bg-[#23333d] text-slate-700 dark:text-[#8e9fa8] hover:text-slate-900 dark:hover:text-[#e6edf2] border border-slate-200/60 dark:border-[#23333d] text-[11px] font-medium transition-colors cursor-pointer active:scale-95"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Result Display Area */}
      <div className="relative z-10">
        {loading ? (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#141f26] border border-slate-200/60 dark:border-[#23333d] flex items-center justify-center gap-2.5 text-xs text-slate-500 dark:text-[#8e9fa8]">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-primary)]" />
            <span>Loading campus directory...</span>
          </div>
        ) : hasSearched ? (
          matchedRoom ? (
            /* MATCH FOUND CARD */
            <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/70 dark:bg-[#142922]/50 border border-emerald-200/80 dark:border-[#1c483a] space-y-3.5 animate-fade-in">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-2xs shrink-0 mt-0.5">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3" />
                      <span>Location Found</span>
                    </div>
                    {/* Primary Answer matching exact user requirement: "<Room name> is in Room <room_no>, <floor>." */}
                    <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-[#e6edf2] leading-snug">
                      {formatRoomAnswer(matchedRoom)}
                    </h4>
                  </div>
                </div>

                <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white dark:bg-[#1b262d] text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-[#1c483a] shadow-2xs shrink-0">
                  {matchedRoom.building} Bldg
                </span>
              </div>

              {/* Metadata Badges and Blueprint CTA */}
              <div className="pt-2 border-t border-emerald-200/50 dark:border-[#1c483a]/60 flex items-center justify-between gap-3 flex-wrap text-xs">
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/80 dark:bg-[#1b262d] border border-emerald-200/60 dark:border-[#1c483a] text-slate-700 dark:text-[#e6edf2] font-semibold text-[11px]">
                    <Building2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Room: <strong className="font-extrabold">{matchedRoom.room_no}</strong></span>
                  </div>

                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/80 dark:bg-[#1b262d] border border-emerald-200/60 dark:border-[#1c483a] text-slate-700 dark:text-[#e6edf2] font-semibold text-[11px]">
                    <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Floor: <strong className="font-extrabold">{matchedRoom.floor}</strong></span>
                  </div>
                </div>

                {/* VIEW ON BLUEPRINT BUTTON: Only visible if floor_plan_url exists */}
                {matchedRoom.floor_plan_url && (
                  <button
                    type="button"
                    id="view-blueprint-btn"
                    onClick={() => setIsBlueprintOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 min-h-[36px] rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-2xs transition-all cursor-pointer active:scale-95"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View on blueprint</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* NO MATCH FOUND CARD matching exact user requirement */
            <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/70 dark:bg-[#2b2214]/50 border border-amber-200/80 dark:border-[#4d3a1d] space-y-2 animate-fade-in">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Info className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs sm:text-sm font-bold text-amber-950 dark:text-amber-200">
                    Room not recognized
                  </h4>
                  <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                    I couldn&apos;t find that room. Try the full name, like &apos;Library&apos; or &apos;Computer Lab 1&apos;.
                  </p>
                </div>
              </div>
            </div>
          )
        ) : (
          /* INITIAL HELPER HINT */
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#141f26] border border-slate-200/60 dark:border-[#23333d] flex items-center gap-2.5 text-xs text-slate-500 dark:text-[#8e9fa8]">
            <Info className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
            <span>
              Type a room name or question above and press <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-[#1b262d] border border-slate-200 dark:border-[#23333d] text-[10px] font-bold">Enter</kbd> to locate rooms instantly.
            </span>
          </div>
        )}
      </div>

      {/* ========================================================== */}
      {/* FLOOR PLAN BLUEPRINT MODAL LIGHTBOX                       */}
      {/* Shows floor plan image with percentage-positioned marker   */}
      {/* ========================================================== */}
      {isBlueprintOpen && matchedRoom && matchedRoom.floor_plan_url && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsBlueprintOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-xs animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="blueprint-modal-title"
        >
          <div className="bg-[#0b1322] text-slate-100 rounded-3xl border border-sky-500/30 shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[92vh] animate-popover relative">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-sky-950/80 bg-[#0d182b] flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/40 shadow-2xs shrink-0">
                  <MapIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 id="blueprint-modal-title" className="text-sm sm:text-base font-extrabold text-white truncate flex items-center gap-2">
                    <span>{matchedRoom.room_name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold">
                      {matchedRoom.room_no}
                    </span>
                  </h3>
                  <p className="text-xs text-sky-300/70 truncate">
                    {matchedRoom.floor} • {matchedRoom.building} Building Blueprint
                  </p>
                </div>
              </div>

              <button
                type="button"
                id="close-blueprint-btn"
                onClick={() => setIsBlueprintOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                title="Close Blueprint (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Blueprint Canvas Container */}
            <div className="flex-1 overflow-auto p-3 sm:p-5 bg-[#070e1a] flex items-center justify-center">
              <div className="relative inline-block max-w-full rounded-2xl overflow-hidden border border-sky-900/60 shadow-2xl bg-[#0d1b2a]">
                {/* Blueprint Image */}
                <img
                  src={matchedRoom.floor_plan_url}
                  alt={`${matchedRoom.floor} Blueprint`}
                  className="block w-full h-auto max-h-[64vh] object-contain select-none"
                  loading="eager"
                />

                {/* Percentage Positioned Marker Pin (marker_x%, marker_y%) */}
                <div
                  id="blueprint-marker"
                  className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30 flex flex-col items-center select-none"
                  style={{
                    left: `${Math.min(98, Math.max(2, matchedRoom.marker_x ?? 50))}%`,
                    top: `${Math.min(98, Math.max(2, matchedRoom.marker_y ?? 50))}%`
                  }}
                >
                  {/* Radar pulse ripples */}
                  <span className="absolute -inset-2.5 rounded-full bg-rose-500/40 animate-ping pointer-events-none" />
                  <span className="absolute -inset-1 rounded-full bg-rose-400/30 animate-pulse pointer-events-none" />

                  {/* Pulsing Pin Badge */}
                  <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-tr from-rose-600 via-rose-500 to-amber-500 text-white shadow-2xl flex items-center justify-center border-2 border-white ring-4 ring-rose-500/40 shrink-0">
                    <MapPin className="w-4 h-4 sm:w-5 sm:h-5 drop-shadow-xs" />
                  </div>

                  {/* Room Tag Tooltip */}
                  <div className="mt-1 px-2.5 py-0.5 rounded-full bg-slate-950/95 border border-white/20 text-[10px] sm:text-[11px] font-extrabold text-white whitespace-nowrap shadow-xl flex items-center gap-1.5 backdrop-blur-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{matchedRoom.room_name} ({matchedRoom.room_no})</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-sky-950/80 bg-[#0d182b] flex items-center justify-between text-xs text-sky-300/80 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>
                  Coordinates: <strong>X: {matchedRoom.marker_x ?? 50}%, Y: {matchedRoom.marker_y ?? 50}%</strong>
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsBlueprintOpen(false)}
                className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
