// contexts/PlayerContext.jsx
import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';

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
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState('off'); // 'off', 'one', 'all'
  const [isVideoMode, setIsVideoMode] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  
  const playerRef = useRef(null);
  const progressInterval = useRef(null);
  // Silent audio element — keeps Chrome Android audio session alive so
  // the YouTube iframe keeps playing when the screen locks.
  const silentAudioRef = useRef(null);

  // Silent audio loop — must exist so Chrome Android grants audio focus to
  // the page (YouTube iframe alone doesn't satisfy the browser's check).
  useEffect(() => {
    // 44-byte minimal silent WAV (base64)
    const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
    const audio = new Audio(SILENT_WAV);
    audio.loop = true;
    audio.volume = 0.001; // near-zero but not 0 (browsers may optimise 0 away)
    silentAudioRef.current = audio;
    return () => { audio.pause(); silentAudioRef.current = null; };
  }, []);

  // Keep silent audio in sync with player state
  useEffect(() => {
    const audio = silentAudioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.play().catch(() => {}); // ignore autoplay policy errors
    } else {
      audio.pause();
    }
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

  // Update progress - starts immediately when song starts
  useEffect(() => {
    // Clear any existing interval
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }

    if (isPlaying && playerRef.current) {
      // Start updating immediately
      const updateProgress = () => {
        try {
          if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
            const current = playerRef.current.getCurrentTime();
            const total = playerRef.current.getDuration();
            
            if (current !== undefined && total && total > 0) {
              const newProgress = (current / total) * 100;
              setProgress(newProgress);
              setDuration(total);
            }
          }
        } catch (error) {
          console.error('Error updating progress:', error);
        }
      };

      // Update immediately
      updateProgress();
      
      // Then update every 500ms for smoother progress
      progressInterval.current = setInterval(updateProgress, 500);
    }

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
    };
  }, [isPlaying, playerRef.current]);

  // Handle MediaSession API for mobile lock screen & background play
  const handlersRef = useRef({ togglePlay: null, playNext: null, playPrevious: null });

  // Keep handlers up to date without triggering effects
  useEffect(() => {
    handlersRef.current = { togglePlay, playNext, playPrevious };
  });

  useEffect(() => {
    if ('mediaSession' in navigator && currentSong) {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: currentSong.title,
        artist: currentSong.artistsText || 'Unknown Artist',
        album: 'ViMusic',
        artwork: [
          { src: currentSong.thumbnailUrl?.replace(/w60-h60/, 'w512-h512') || '', sizes: '512x512', type: 'image/jpeg' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => handlersRef.current.togglePlay?.());
      navigator.mediaSession.setActionHandler('pause', () => handlersRef.current.togglePlay?.());
      navigator.mediaSession.setActionHandler('previoustrack', () => handlersRef.current.playPrevious?.());
      navigator.mediaSession.setActionHandler('nexttrack', () => handlersRef.current.playNext?.());
    }
  }, [currentSong]);

  // Keep Media Session playback state in sync (controls lock screen play/pause icon)
  useEffect(() => {
    if ('mediaSession' in navigator && currentSong) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [isPlaying, currentSong]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  // Space = play/pause, ArrowLeft = previous, ArrowRight = next
  // Only fires when the user isn't typing in an input/textarea
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
      if (!currentSong) return;

      if (e.code === 'Space') {
        e.preventDefault(); // stop page scroll
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

  const playSong = (song) => {
    setCurrentSong(song);
    setIsPlaying(true);
    setProgress(0);
    setDuration(0);
    setIsVideoMode(false); // always start in audio mode
    setIsExpanded(true); // Auto-expand when a new song is clicked
    toast.success(`Now playing: ${song.title}`);
  };

  const playQueue = (songs, startIndex = 0) => {
    setQueue(songs);
    setCurrentIndex(startIndex);
    setCurrentSong(songs[startIndex]);
    setIsPlaying(true);
    setProgress(0);
    setDuration(0);
    setIsVideoMode(false);
  };

  const togglePlay = () => {
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
  };

  const playNext = () => {
    if (queue.length === 0) return;

    let nextIndex;
    if (shuffle) {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else {
      nextIndex = (currentIndex + 1) % queue.length;
    }

    setCurrentIndex(nextIndex);
    setCurrentSong(queue[nextIndex]);
    setIsPlaying(true);
    setProgress(0);
    setDuration(0);
    setIsVideoMode(false);
  };

  const playPrevious = () => {
    if (queue.length === 0) return;

    const prevIndex = currentIndex === 0 ? queue.length - 1 : currentIndex - 1;
    setCurrentIndex(prevIndex);
    setCurrentSong(queue[prevIndex]);
    setIsPlaying(true);
    setProgress(0);
    setDuration(0);
    setIsVideoMode(false);
  };

  const seekTo = (percent) => {
    if (!playerRef.current) return;
    
    try {
      const seekTime = (percent / 100) * duration;
      playerRef.current.seekTo(seekTime, true);
      setProgress(percent);
    } catch (error) {
      console.error('Error seeking:', error);
    }
  };

  const changeVolume = (vol) => {
    setVolume(vol);
    if (playerRef.current) {
      try {
        playerRef.current.setVolume(vol * 100);
      } catch (error) {
        console.error('Error changing volume:', error);
      }
    }
  };

  const toggleShuffle = () => {
    setShuffle(!shuffle);
    toast.success(shuffle ? 'Shuffle off' : 'Shuffle on');
  };

  const toggleRepeat = () => {
    const modes = ['off', 'all', 'one'];
    const currentMode = modes.indexOf(repeat);
    const nextMode = modes[(currentMode + 1) % modes.length];
    setRepeat(nextMode);
    toast.success(`Repeat: ${nextMode}`);
  };

  const toggleVideoMode = () => {
    setIsVideoMode(prev => !prev);
  };

  const addToQueue = (song) => {
    setQueue([...queue, song]);
    toast.success('Added to queue');
  };

  const removeFromQueue = (index) => {
    const newQueue = queue.filter((_, i) => i !== index);
    setQueue(newQueue);
    if (index < currentIndex) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const closePlayer = () => {
    // Stop the player
    if (playerRef.current) {
      try {
        playerRef.current.stopVideo();
      } catch (error) {
        console.error('Error stopping video:', error);
      }
    }
    
    // Clear interval
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }
    
    // Reset all state
    setCurrentSong(null);
    setIsPlaying(false);
    setProgress(0);
    setDuration(0);
    setQueue([]);
    setCurrentIndex(0);
    setIsVideoMode(false);
    setIsExpanded(false);
    playerRef.current = null;
  };

  const value = {
    currentSong,
    isPlaying,
    volume,
    progress,
    duration,
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
    setProgress,
    setDuration,
    setIsExpanded,
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
};