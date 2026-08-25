// contexts/PlayerContext.jsx
import React, { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { usePlaybackTime } from './PlaybackTimeContext';

const PlayerContext = createContext();

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within PlayerProvider');
  }
  return context;
};

export const PlayerProvider = ({ children }) => {
  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState('off'); // 'off', 'one', 'all'
  const [isVideoMode, setIsVideoMode] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // This subscribes PlayerProvider to progress/duration ticks (re-renders it
  // ~2x/sec), which is fine — a single component re-rendering is cheap. What
  // matters is that the *value object below* stays referentially stable
  // across those re-renders (via useMemo/useCallback) so it doesn't cascade
  // into every usePlayer() consumer (SongCard, App.jsx, etc).
  const { duration, setProgress, setDuration } = usePlaybackTime();
  const durationRef = useRef(duration);
  useEffect(() => { durationRef.current = duration; }, [duration]);

  const playerRef = useRef(null);
  // Silent audio element — keeps Chrome Android audio session alive so
  // the YouTube iframe keeps playing when the screen locks.
  const silentAudioRef = useRef(null);

  // Silent audio loop — keeps Chrome Android audio session alive so
  // the YouTube iframe keeps playing when the screen locks.
  useEffect(() => {
    const audio = new Audio('/silence.wav');
    audio.loop = true;
    audio.volume = 0.01;
    silentAudioRef.current = audio;
    return () => {
      audio.pause();
      silentAudioRef.current = null;
    };
  }, []);

  // Keep silent audio in sync with player state
  useEffect(() => {
    const audio = silentAudioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  // Screen Wake Lock — while a song is playing and this tab is the visible,
  // foreground tab, keep the screen from auto-dimming/locking due to
  // inactivity (no touches/mouse movement while just listening). This does
  // NOT keep playback going once the screen is already locked or the tab is
  // backgrounded — the spec mandates the lock is released the instant the
  // tab becomes hidden, and it never overrides an explicit lid-close or
  // manual lock. It only delays the inactivity timer that would otherwise
  // lock/sleep the device in the first place while you're actively on this
  // tab listening.
  const wakeLockRef = useRef(null);

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator && document.visibilityState === 'visible') {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (isPlaying) {
      requestWakeLock();
    } else if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  }, [isPlaying]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && isPlaying && !wakeLockRef.current) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [isPlaying]);

  // Initialize YouTube Player
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
  }, []);

  // Handle MediaSession API for mobile lock screen & background play
  const handlersRef = useRef({ togglePlay: null, playNext: null, playPrevious: null });

  // Keep handlers up to date without triggering effects
  useEffect(() => {
    handlersRef.current = { togglePlay, playNext, playPrevious };
  });

  // Registers a MediaSession action handler defensively — some browsers
  // (older WebViews, some Brave builds) throw for action types they don't
  // support (e.g. 'stop'/'seekto'). Without a try/catch per-call, one
  // unsupported action throwing would abort the whole block and silently
  // skip registering every handler after it, which is enough to make lock
  // screen / notification-shade controls appear completely dead.
  const setSessionHandler = (action, handler) => {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch (e) {}
  };

  useEffect(() => {
    if ('mediaSession' in navigator && currentSong) {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: currentSong.title,
        artist: currentSong.artistsText || 'Unknown Artist',
        album: 'ViMusic',
        artwork: [
          { src: currentSong.thumbnailUrl?.replace(/w\d+-h\d+/, 'w512-h512') || '', sizes: '512x512', type: 'image/jpeg' }
        ]
      });

      setSessionHandler('play', () => handlersRef.current.togglePlay?.());
      setSessionHandler('pause', () => handlersRef.current.togglePlay?.());
      setSessionHandler('previoustrack', () => handlersRef.current.playPrevious?.());
      setSessionHandler('nexttrack', () => handlersRef.current.playNext?.());
      setSessionHandler('stop', () => handlersRef.current.togglePlay?.());
      setSessionHandler('seekto', (details) => {
        if (playerRef.current && typeof details.seekTime === 'number') {
          try { playerRef.current.seekTo(details.seekTime, true); } catch (e) {}
        }
      });
      setSessionHandler('seekbackward', (details) => {
        if (playerRef.current) {
          try {
            const t = playerRef.current.getCurrentTime() - (details.seekOffset || 10);
            playerRef.current.seekTo(Math.max(0, t), true);
          } catch (e) {}
        }
      });
      setSessionHandler('seekforward', (details) => {
        if (playerRef.current) {
          try {
            const t = playerRef.current.getCurrentTime() + (details.seekOffset || 10);
            playerRef.current.seekTo(t, true);
          } catch (e) {}
        }
      });
    }
  }, [currentSong]);

  // Keep Media Session playback state in sync (controls lock screen play/pause icon)
  useEffect(() => {
    if ('mediaSession' in navigator && currentSong) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [isPlaying, currentSong]);

  // Report position/duration so Android's lock screen & notification-shade
  // media widgets can render their scrubber — several Android versions hide
  // or disable the control buttons entirely when position state is missing.
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentSong) return;
    if (typeof navigator.mediaSession.setPositionState !== 'function') return;
    if (!duration || !isFinite(duration) || duration <= 0) return;

    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: 1,
        position: Math.min(Math.max(0, playerRef.current?.getCurrentTime?.() ?? 0), duration),
      });
    } catch (e) {}
  }, [duration, currentSong]);

  // Re-assert the media session (metadata, handlers, playback state) whenever
  // the tab regains visibility — recovers from Android suspending/dropping
  // the session while the screen was locked.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !('mediaSession' in navigator) || !currentSong) return;
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
      ensureAudioSession();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [currentSong, isPlaying]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  // Space = play/pause, ArrowLeft = previous, ArrowRight = next
  // Only fires when the user isn't typing in an input/textarea
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
      if (!currentSong) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handlersRef.current.togglePlay?.();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handlersRef.current.playNext?.();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handlersRef.current.playPrevious?.();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentSong]);

  const ensureAudioSession = () => {
    try {
      if (silentAudioRef.current) {
        silentAudioRef.current.play().catch(() => {});
      }
    } catch (e) {}
  };

  const playSong = useCallback((song) => {
    ensureAudioSession();
    setCurrentSong(song);
    setIsPlaying(true);
    setProgress(0);
    setDuration(0);
    setIsVideoMode(false);
    setIsExpanded(true);
    toast.success(`Now playing: ${song.title}`);
  }, [setProgress, setDuration]);

  const playQueue = useCallback((songs, startIndex = 0) => {
    ensureAudioSession();
    setQueue(songs);
    setCurrentIndex(startIndex);
    setCurrentSong(songs[startIndex]);
    setIsPlaying(true);
    setProgress(0);
    setDuration(0);
    setIsVideoMode(false);
  }, [setProgress, setDuration]);

  const togglePlay = useCallback(() => {
    ensureAudioSession();
    if (!playerRef.current) return;
    try {
      if (isPlaying) {
        playerRef.current.pauseVideo();
        setIsPlaying(false);
      } else {
        playerRef.current.playVideo();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error toggling play:', error);
    }
  }, [isPlaying]);

  const playNext = useCallback(() => {
    if (queue.length === 0) return;
    let nextIndex;
    if (shuffle) {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else {
      // (currentIndex + 1) % queue.length always wraps back to the start —
      // that made "repeat off" silently behave exactly like "repeat all"
      // once the queue reached its last track. "Off" should mean the
      // queue actually stops there instead of looping.
      if (currentIndex === queue.length - 1 && repeat === 'off') {
        setIsPlaying(false);
        return;
      }
      nextIndex = (currentIndex + 1) % queue.length;
    }
    setCurrentIndex(nextIndex);
    setCurrentSong(queue[nextIndex]);
    setIsPlaying(true);
    setProgress(0);
    setDuration(0);
    // Deliberately no setIsVideoMode(false) here — skipping within an
    // active session should keep whichever mode (audio/video) you were
    // already watching in, unlike playSong/playQueue which start fresh.
  }, [queue, shuffle, currentIndex, repeat, setProgress, setDuration]);

  const playPrevious = useCallback(() => {
    if (queue.length === 0) return;
    const prevIndex = currentIndex === 0 ? queue.length - 1 : currentIndex - 1;
    setCurrentIndex(prevIndex);
    setCurrentSong(queue[prevIndex]);
    setIsPlaying(true);
    setProgress(0);
    setDuration(0);
    // See playNext — preserve video/audio mode across skips.
  }, [queue, currentIndex, setProgress, setDuration]);

  const seekTo = useCallback((percent) => {
    if (!playerRef.current) return;
    try {
      const seekTime = (percent / 100) * durationRef.current;
      playerRef.current.seekTo(seekTime, true);
      setProgress(percent);
    } catch (error) {
      console.error('Error seeking:', error);
    }
  }, [setProgress]);

  const changeVolume = useCallback((vol) => {
    setVolume(vol);
    if (playerRef.current) {
      try {
        playerRef.current.setVolume(vol * 100);
      } catch (error) {
        console.error('Error changing volume:', error);
      }
    }
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffle((prev) => {
      toast.success(prev ? 'Shuffle off' : 'Shuffle on');
      return !prev;
    });
  }, []);

  const toggleRepeat = useCallback(() => {
    setRepeat((prev) => {
      const modes = ['off', 'all', 'one'];
      const nextMode = modes[(modes.indexOf(prev) + 1) % modes.length];
      toast.success(`Repeat: ${nextMode}`);
      return nextMode;
    });
  }, []);

  const toggleVideoMode = useCallback(() => {
    setIsVideoMode((prev) => !prev);
  }, []);

  const addToQueue = useCallback((song) => {
    setQueue((prev) => [...prev, song]);
    toast.success('Added to queue');
  }, []);

  const removeFromQueue = useCallback((index) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
    setCurrentIndex((prev) => (index < prev ? prev - 1 : prev));
  }, []);

  const closePlayer = useCallback(() => {
    if (playerRef.current) {
      try {
        playerRef.current.stopVideo();
      } catch (error) {
        console.error('Error stopping video:', error);
      }
    }
    setCurrentSong(null);
    setIsPlaying(false);
    setProgress(0);
    setDuration(0);
    setQueue([]);
    setCurrentIndex(0);
    setIsVideoMode(false);
    setIsExpanded(false);
    playerRef.current = null;
  }, [setProgress, setDuration]);

  const value = useMemo(() => ({
    currentSong,
    isPlaying,
    volume,
    queue,
    currentIndex,
    shuffle,
    repeat,
    isVideoMode,
    isExpanded,
    playerRef,
    playSong,
    playQueue,
    togglePlay,
    playNext,
    playPrevious,
    seekTo,
    changeVolume,
    toggleShuffle,
    toggleRepeat,
    toggleVideoMode,
    addToQueue,
    removeFromQueue,
    closePlayer,
    setIsPlaying,
    setIsExpanded,
  }), [
    currentSong, isPlaying, volume, queue, currentIndex, shuffle, repeat, isVideoMode, isExpanded,
    playSong, playQueue, togglePlay, playNext, playPrevious, seekTo, changeVolume,
    toggleShuffle, toggleRepeat, toggleVideoMode, addToQueue, removeFromQueue, closePlayer,
  ]);

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
};
