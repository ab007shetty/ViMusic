// components/LyricsPanel.jsx
import React, { useEffect, useRef, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { fetchFromServer } from '../utils/api';

/**
 * Lyrics overlay for the maximized player, opened by clicking the artwork.
 *
 * Matching and caching both happen server-side (see backend lib/song-lyrics.js)
 * against the same `lyrics` table the Android app writes to, so a track whose
 * lyrics were fetched on the phone opens instantly here.
 *
 * Position comes from polling the YouTube player directly rather than from
 * PlaybackTimeContext: that context ticks every 500ms and stores a percentage,
 * which is too coarse and too lossy for line highlighting.
 */

const POLL_MS = 200;

// How long to leave auto-scroll alone after the user scrolls themselves, so
// reading ahead doesn't get yanked back on the next line change.
const USER_SCROLL_GRACE_MS = 3500;

const LIST_FADE =
  'linear-gradient(to bottom, transparent 0%, #000 13%, #000 87%, transparent 100%)';

// "3:45" / "1:02:33" -> seconds. Only a fallback hint for choosing between
// multiple takes of a song, so a bad parse is worse than none at all.
const toSeconds = (text) => {
  if (!text) return null;
  const parts = String(text).split(':').map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
};

const LyricsPanel = ({ song, open, playerRef, onClose }) => {
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [plain, setPlain] = useState(null);
  const [synced, setSynced] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  const listRef = useRef(null);
  const lineRefs = useRef([]);
  const lastUserScrollRef = useRef(0);

  const songId = song?.id;
  const title = song?.title || '';
  const artist = song?.artistsText || '';
  const durationText = song?.durationText || '';

  // ── Fetch ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open || !songId) return;

    let cancelled = false;
    setStatus('loading');
    setPlain(null);
    setSynced([]);
    setActiveIndex(-1);
    lineRefs.current = [];

    // The player's own duration is authoritative; durationText is the fallback
    // for songs that have not started playing yet.
    const seconds =
      Math.round(playerRef?.current?.getDuration?.() || 0) || toSeconds(durationText) || 0;

    const params = new URLSearchParams({ title, artist });
    if (seconds > 0) params.set('duration', String(seconds));

    fetchFromServer(`songs/${encodeURIComponent(songId)}/lyrics?${params}`)
      .then((data) => {
        if (cancelled) return;
        setPlain(data?.plain || null);
        setSynced(Array.isArray(data?.synced) ? data.synced : []);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [open, songId, title, artist, durationText, playerRef]);

  // ── Track the active line ────────────────────────────────────────────────
  useEffect(() => {
    if (!open || synced.length === 0) return;

    const tick = () => {
      const seconds = playerRef?.current?.getCurrentTime?.();
      if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return;

      const ms = seconds * 1000;
      let index = -1;
      for (let i = 0; i < synced.length; i += 1) {
        if (synced[i].timeMs <= ms) index = i;
        else break;
      }
      setActiveIndex((prev) => (prev === index ? prev : index));
    };

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
  }, [open, synced, playerRef]);

  // ── Follow the active line ───────────────────────────────────────────────
  useEffect(() => {
    if (activeIndex < 0) return;
    if (Date.now() - lastUserScrollRef.current < USER_SCROLL_GRACE_MS) return;

    const container = listRef.current;
    const line = lineRefs.current[activeIndex];
    if (!container || !line) return;

    container.scrollTo({
      top: line.offsetTop - container.clientHeight / 2 + line.offsetHeight / 2,
      behavior: 'smooth',
    });
  }, [activeIndex]);

  if (!open) return null;

  // Smooth scrolling above fires 'scroll' events too, so watch the input
  // events instead — otherwise auto-scroll would keep switching itself off.
  const markUserScroll = () => {
    lastUserScrollRef.current = Date.now();
  };

  const hasLyrics = status === 'ready' && (synced.length > 0 || plain);

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col"
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      {/* The artwork stays behind, blurred, so every song's lyrics take on the
          colour of its own cover — light enough a scrim to let that through,
          dark enough to keep the text readable over a bright cover. */}
      <div className="absolute inset-0 bg-gray-950/60 backdrop-blur-2xl" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/50" />

      <div className="relative flex items-center justify-between px-5 pt-4 pb-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green-400/90">
          Lyrics
        </span>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Close lyrics"
        >
          <X size={16} />
        </button>
      </div>

      {status === 'loading' && (
        <div className="relative flex-1 flex items-center justify-center">
          <Loader2 size={22} className="text-green-400 animate-spin" />
        </div>
      )}

      {status === 'error' && (
        <div className="relative flex-1 flex items-center justify-center px-8">
          <p className="text-sm text-gray-400 text-center">Lyrics could not be loaded right now.</p>
        </div>
      )}

      {status === 'ready' && !hasLyrics && (
        <div className="relative flex-1 flex items-center justify-center px-8">
          <p className="text-sm text-gray-400 text-center">No lyrics found for this track</p>
        </div>
      )}

      {status === 'ready' && synced.length > 0 && (
        <div
          ref={listRef}
          onWheel={markUserScroll}
          onTouchMove={markUserScroll}
          className="relative flex-1 overflow-y-auto px-6 md:px-10 lyrics-scroll"
          // Lines dissolve at the top and bottom edges instead of being sliced
          // off mid-word as they scroll past.
          style={{
            maskImage: LIST_FADE,
            WebkitMaskImage: LIST_FADE,
          }}
        >
          {/* Half-height padding top and bottom so the first and last lines can
              still settle in the middle of the panel. */}
          <div className="py-[45%]">
            {synced.map((line, index) => {
              const isActive = index === activeIndex;
              return (
                <p
                  key={`${line.timeMs}-${index}`}
                  ref={(el) => {
                    lineRefs.current[index] = el;
                  }}
                  className={`py-1.5 text-center leading-snug transition-all duration-300 ${
                    isActive
                      ? 'text-white font-semibold text-lg md:text-2xl drop-shadow-[0_0_18px_rgba(34,197,94,0.35)]'
                      : index < activeIndex
                      ? 'text-white/25 text-base md:text-xl'
                      : 'text-white/45 text-base md:text-xl'
                  }`}
                >
                  {line.text}
                </p>
              );
            })}
          </div>
        </div>
      )}

      {status === 'ready' && synced.length === 0 && plain && (
        <div
          onWheel={markUserScroll}
          className="relative flex-1 overflow-y-auto px-6 md:px-10 py-4 lyrics-scroll"
        >
          <p className="text-center text-base md:text-lg leading-relaxed text-white/70 whitespace-pre-line">
            {plain}
          </p>
        </div>
      )}
    </div>
  );
};

export default LyricsPanel;
