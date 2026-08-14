// components/Player.jsx
import React, { useEffect, useRef, useState } from 'react';
import { usePlayer } from '../contexts/PlayerContext';
import { 
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, 
  Shuffle, Repeat, Repeat1, X, Film, Music, ChevronDown, Maximize2, Subtitles
} from 'lucide-react';

const Player = () => {
  const {
    currentSong,
    isPlaying,
    volume,
    progress,
    duration,
    shuffle,
    repeat,
    isVideoMode,
    playerRef,
    setIsPlaying,
    playNext,
    playPrevious,
    seekTo,
    changeVolume,
    toggleShuffle,
    toggleRepeat,
    toggleVideoMode,
    closePlayer,
    setProgress,
    setDuration,
    isExpanded,
    setIsExpanded,
  } = usePlayer();

  const [isMuted, setIsMuted] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const ytPlayerRef = useRef(null);
  const isPlayerReady = useRef(false);
  const updateIntervalRef = useRef(null);
  const videoContainerRef = useRef(null);
  const touchStartY = useRef(0);
  const touchEndY = useRef(0);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const userInitiatedPause = useRef(false);

  // Background keepalive: resume if browser or YouTube iframe attempts to auto-pause when screen locks or tab hides
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (isPlaying && ytPlayerRef.current && isPlayerReady.current && !userInitiatedPause.current) {
          try {
            ytPlayerRef.current.playVideo();
          } catch (e) {}
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isPlaying]);

  const handleFullscreen = () => {
    if (!videoContainerRef.current) return;
    try {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoContainerRef.current.requestFullscreen();
      }
    } catch (error) {
      console.error('Error toggling fullscreen:', error);
    }
  };

  const toggleCaptions = () => {
    if (!playerRef.current) return;
    try {
      if (captionsEnabled) {
        playerRef.current.unloadModule('captions');
        setCaptionsEnabled(false);
        toast.success('Subtitles disabled');
      } else {
        playerRef.current.loadModule('captions');
        playerRef.current.setOption('captions', 'track', { languageCode: 'en' });
        setCaptionsEnabled(true);
        toast.success('Subtitles enabled');
      }
    } catch (error) {
      console.error('Error toggling captions:', error);
    }
  };

  const handleTouchStart = (e) => {
    if (e.target.tagName === 'INPUT' || e.target.closest('button')) return;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e) => {
    touchEndY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = () => {
    const diff = touchEndY.current - touchStartY.current;
    if (diff > 120) { // Require 120px swipe down to minimize
      setIsExpanded(false);
    }
    touchStartY.current = 0;
    touchEndY.current = 0;
  };

  const handleWheel = (e) => {
    if (e.deltaY > 60 && isExpanded) {
      setIsExpanded(false);
    }
  };

  // Handle window resize to detect mobile
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleClose = () => {
    try {
      userInitiatedPause.current = true;
      // Clear update interval
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }

      if (ytPlayerRef.current && isPlayerReady.current) {
        ytPlayerRef.current.stopVideo();
        ytPlayerRef.current.destroy();
      }
      ytPlayerRef.current = null;
      isPlayerReady.current = false;
      closePlayer();
    } catch (error) {
      console.error('Error closing player:', error);
      closePlayer();
    }
  };

  // Initialize YouTube Player
  useEffect(() => {
    if (currentSong && window.YT) {
      // Cleanup previous player
      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.destroy();
        } catch (e) {
          console.log('Error destroying previous player:', e);
        }
      }
      
      // Clear any existing interval
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
      
      isPlayerReady.current = false;

      // Create new player
      ytPlayerRef.current = new window.YT.Player('yt-player', {
        height: '100%',
        width: '100%',
        videoId: currentSong.id,
        playerVars: {
          autoplay: 1,
          controls: 0,
          enablejsapi: 1,
          origin: window.location.origin,
          rel: 0,
          modestbranding: 1,
          cc_load_policy: 0,
          iv_load_policy: 3,
          fs: 0,
        },
        events: {
          onReady: (event) => {
            isPlayerReady.current = true;
            playerRef.current = event.target;
            event.target.setVolume(volume * 100);
            startProgressUpdates();
            if (isPlaying) {
              event.target.playVideo();
            }
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              userInitiatedPause.current = false;
              startProgressUpdates();
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              // If page is hidden and user didn't intentionally pause, auto-resume
              if (document.visibilityState === 'hidden' && !userInitiatedPause.current) {
                setTimeout(() => {
                  try {
                    event.target.playVideo();
                  } catch (err) {}
                }, 100);
                return;
              }
              setIsPlaying(false);
              stopProgressUpdates();
            } else if (event.data === window.YT.PlayerState.ENDED) {
              if (repeat === 'one') {
                event.target.playVideo();
              } else {
                playNext();
              }
            }
          },
          onError: (event) => {
            console.error('YouTube player error:', event.data);
          }
        },
      });
    }

    return () => {
      // Cleanup on unmount or song change
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
      
      if (ytPlayerRef.current && isPlayerReady.current) {
        try {
          ytPlayerRef.current.stopVideo();
        } catch (e) {
          console.log('Error stopping video:', e);
        }
      }
    };
  }, [currentSong]);

  // Start progress updates
  const startProgressUpdates = () => {
    // Clear existing interval
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
    }

    // Update immediately
    updateProgress();

    // Then update every 500ms
    updateIntervalRef.current = setInterval(() => {
      updateProgress();
    }, 500);
  };

  // Stop progress updates
  const stopProgressUpdates = () => {
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }
  };

  // Update progress function
  const updateProgress = () => {
    try {
      if (playerRef.current && isPlayerReady.current && typeof playerRef.current.getCurrentTime === 'function') {
        const currentTime = playerRef.current.getCurrentTime();
        const totalDuration = playerRef.current.getDuration();
        
        if (totalDuration && totalDuration > 0 && currentTime !== undefined) {
          const progressPercentage = (currentTime / totalDuration) * 100;
          setProgress(progressPercentage);
          setDuration(totalDuration);
        }
      }
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };

  // Handle play state changes
  useEffect(() => {
    if (isPlaying && isPlayerReady.current) {
      startProgressUpdates();
    } else {
      stopProgressUpdates();
    }
  }, [isPlaying]);

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTogglePlay = () => {
    if (!playerRef.current || !isPlayerReady.current) return;
    
    try {
      if (isPlaying) {
        userInitiatedPause.current = true;
        playerRef.current.pauseVideo();
      } else {
        userInitiatedPause.current = false;
        playerRef.current.playVideo();
      }
    } catch (error) {
      console.error('Error toggling play:', error);
    }
  };

  const handleMuteToggle = () => {
    if (isMuted) {
      changeVolume(1);
      setIsMuted(false);
    } else {
      changeVolume(0);
      setIsMuted(true);
    }
  };

  const truncateText = (text, maxLength) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  if (!currentSong) return null;

  return (
    <>
      {/* EXPANDED PLAYER OVERLAY */}
      <div 
        className={`close-on-click absolute top-16 left-0 right-0 bottom-0 z-40 bg-gray-900 bg-opacity-95 backdrop-blur-3xl flex flex-col transition-all duration-500 ease-out transform ${isExpanded ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        onClick={(e) => {
          if (e.target.classList.contains('close-on-click')) {
            setIsExpanded(false);
          }
        }}
      >
        {/* No top header — maximize media space */}

        {/* Center: Artwork or Video — takes all remaining space */}
        <div className="close-on-click flex-1 relative min-h-0 overflow-hidden">
          {/* YouTube Video Wrapper — absolutely fills container */}
          <div className={`close-on-click absolute inset-0 flex items-center justify-center p-4 transition-all duration-500 ${
            isVideoMode ? 'opacity-100 scale-100 z-10' : 'opacity-0 scale-95 pointer-events-none'
          }`}>
            <div
              ref={videoContainerRef}
              className="bg-black rounded-2xl shadow-2xl overflow-hidden relative [&_iframe]:pointer-events-none"
              style={{
                height: '100%',
                aspectRatio: currentSong?.isShort ? '9/16' : '16/9',
                maxWidth: '100%',
              }}
            >
              <div 
                className="absolute inset-0 bg-transparent z-20 cursor-pointer" 
                onClick={handleTogglePlay}
              />
              <div id="yt-player" className="w-full h-full" />

              {/* Custom Overlay Controls */}
              <div className="absolute bottom-4 right-4 z-30 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={toggleCaptions}
                  className={`p-2 rounded-full text-white transition-all transform hover:scale-105 ${
                    captionsEnabled ? 'bg-green-600 hover:bg-green-700 shadow-md' : 'bg-black/60 hover:bg-black/80'
                  }`}
                  title="Toggle Subtitles"
                >
                  <Subtitles size={16} />
                </button>
                <button
                  onClick={handleFullscreen}
                  className="p-2 bg-black/60 hover:bg-black/80 rounded-full text-white transition-all transform hover:scale-105"
                  title="Fullscreen"
                >
                  <Maximize2 size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Album Artwork Wrapper — absolutely fills container, same size approach */}
          <div className={`close-on-click absolute inset-0 flex items-center justify-center p-4 transition-all duration-500 ${
            !isVideoMode ? 'opacity-100 scale-100 z-10' : 'opacity-0 scale-95 pointer-events-none'
          }`}>
            <div
              className="rounded-2xl shadow-2xl overflow-hidden"
              style={{
                height: '100%',
                aspectRatio: '1',
                maxWidth: '100%',
              }}
            >
              <img 
                src={currentSong.thumbnailUrl?.replace(/w60-h60|w120-h120/, 'w1000-h1000') || '/images/default.jpg'}
                alt={currentSong.title}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* Bottom Controls */}
        <div className="w-full px-4 md:px-6 pb-3 pt-2">
          {/* Song Info + Controls row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">

            {/* Song info row — on mobile also shows action buttons inline */}
            <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-lg md:text-xl font-bold text-white truncate mb-0.5">
                  {currentSong.title}
                </h2>
                <p className="text-sm text-gray-400 truncate">
                  {currentSong.artistsText || 'Unknown Artist'}
                </p>
              </div>

              {/* Mobile-only: song/video toggle + minimize + close next to title */}
              <div className="flex md:hidden items-center gap-1.5 flex-shrink-0 mt-0.5">
                {currentSong && (
                  <div className="flex items-center bg-gray-800 rounded-full p-0.5 border border-gray-700">
                    <button
                      onClick={() => isVideoMode && toggleVideoMode()}
                      className={`px-2 py-1 rounded-full text-xs font-semibold transition-all duration-200 ${
                        !isVideoMode ? 'bg-green-600 text-white shadow' : 'text-gray-400 hover:text-white'
                      }`}
                      title="Audio mode"
                    >
                      <Music size={11} />
                    </button>
                    <button
                      onClick={() => !isVideoMode && toggleVideoMode()}
                      className={`px-2 py-1 rounded-full text-xs font-semibold transition-all duration-200 ${
                        isVideoMode ? 'bg-green-600 text-white shadow' : 'text-gray-400 hover:text-white'
                      }`}
                      title="Video mode"
                    >
                      <Film size={11} />
                    </button>
                  </div>
                )}
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-1.5 bg-gray-800/70 hover:bg-gray-700 rounded-full text-gray-300 hover:text-white transition-colors"
                  title="Minimize"
                >
                  <ChevronDown size={15} />
                </button>
                <button
                  onClick={handleClose}
                  className="p-1.5 bg-gray-800/70 hover:bg-red-500/80 rounded-full text-gray-300 hover:text-white transition-colors"
                  title="Close Player"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Playback Controls (Center) */}
            <div className="flex-1 flex items-center justify-center gap-3 md:gap-4">
              <button
                onClick={toggleShuffle}
                className={`p-1.5 transition-colors ${shuffle ? 'text-green-400' : 'text-gray-400 hover:text-white'}`}
                title="Shuffle"
              >
                <Shuffle size={18} />
              </button>
              <button
                onClick={playPrevious}
                className="p-1.5 text-gray-400 hover:text-white transition-colors"
                title="Previous"
              >
                <SkipBack size={22} />
              </button>
              
              <button
                onClick={handleTogglePlay}
                className="w-12 h-12 flex items-center justify-center bg-white rounded-full text-gray-900 hover:scale-105 transition-transform shadow-[0_0_16px_rgba(255,255,255,0.15)]"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" className="ml-1" />}
              </button>

              <button
                onClick={playNext}
                className="p-1.5 text-gray-400 hover:text-white transition-colors"
                title="Next"
              >
                <SkipForward size={22} />
              </button>
              <button
                onClick={toggleRepeat}
                className={`p-1.5 transition-colors ${repeat !== 'off' ? 'text-green-400' : 'text-gray-400 hover:text-white'}`}
                title={`Repeat: ${repeat}`}
              >
                {repeat === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
              </button>
            </div>

            {/* Desktop-only Right Controls */}
            <div className="hidden md:flex flex-1 items-center justify-end gap-3 md:gap-4">
              {currentSong && (
                <div className="flex items-center bg-gray-800 rounded-full p-0.5 border border-gray-700">
                  <button
                    onClick={() => isVideoMode && toggleVideoMode()}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-200 ${
                      !isVideoMode ? 'bg-green-600 text-white shadow' : 'text-gray-400 hover:text-white'
                    }`}
                    title="Audio mode"
                  >
                    <Music size={12} />
                    <span>Song</span>
                  </button>
                  <button
                    onClick={() => !isVideoMode && toggleVideoMode()}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-200 ${
                      isVideoMode ? 'bg-green-600 text-white shadow' : 'text-gray-400 hover:text-white'
                    }`}
                    title="Video mode"
                  >
                    <Film size={12} />
                    <span>Video</span>
                  </button>
                </div>
              )}
              <button 
                onClick={() => setIsExpanded(false)}
                className="p-1.5 bg-gray-800/70 hover:bg-gray-700 rounded-full text-gray-300 hover:text-white transition-colors"
                title="Minimize"
              >
                <ChevronDown size={18} />
              </button>
              <button 
                onClick={handleClose}
                className="p-1.5 bg-gray-800/70 hover:bg-red-500/80 rounded-full text-gray-300 hover:text-white transition-colors"
                title="Close Player"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Progress Bar (At the absolute bottom) */}
          <div className="mb-2">
            <div className="relative h-1.5 bg-gray-700/50 rounded-full overflow-hidden group">
              <div
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-400 to-blue-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
              <input
                type="range"
                min="0"
                max="100"
                value={progress}
                onChange={(e) => seekTo(Number(e.target.value))}
                className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-2 font-medium">
              <span>{formatTime(duration * (progress / 100))}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* MINIMIZED BOTTOM BAR */}
      <div 
        className={`fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-xl border-t border-gray-800 z-50 transition-all duration-300 ${
          isMobile ? 'h-16' : 'h-20'
        } ${isExpanded ? 'translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100 cursor-pointer'}`}
        onClick={(e) => {
          if (e.target.closest('button')) return;
          setIsExpanded(true);
        }}
      >
        {!isMobile && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gray-800">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <div className="container mx-auto px-4 h-full flex items-center justify-between gap-4">
          {/* 1. Minimized Song Info (Left block) */}
          <div className="flex items-center space-x-4 min-w-0 md:w-1/4">
            <div className="relative group overflow-hidden rounded-md shadow-lg flex-shrink-0">
              <img
                src={currentSong.thumbnailUrl?.replace(/w60-h60/, 'w120-h120') || '/images/default.jpg'}
                alt={currentSong.title}
                className={`transition-all duration-300 group-hover:scale-110 ${isMobile ? 'w-12 h-12' : 'w-14 h-14'}`}
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Maximize2 size={18} className="text-white" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-white font-medium truncate text-sm md:text-base">
                {currentSong.title}
              </h3>
              <p className="text-gray-400 text-xs truncate mt-0.5">
                {currentSong.artistsText || 'Unknown Artist'}
              </p>
            </div>
          </div>

          {/* 2. Playback Controls (Center block) */}
          <div className="flex items-center justify-center space-x-2 md:space-x-4 flex-1">
            {!isMobile && (
              <button
                onClick={toggleShuffle}
                className={`p-1.5 transition-colors ${shuffle ? 'text-green-400' : 'text-gray-400 hover:text-white'}`}
                title="Shuffle"
              >
                <Shuffle size={16} />
              </button>
            )}
            
            {!isMobile && (
              <button onClick={playPrevious} className="p-2 text-gray-400 hover:text-white transition-colors">
                <SkipBack size={20} />
              </button>
            )}
            
            <button
              onClick={handleTogglePlay}
              className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors flex-shrink-0"
            >
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
            </button>

            {!isMobile && (
              <button onClick={playNext} className="p-2 text-gray-400 hover:text-white transition-colors">
                <SkipForward size={20} />
              </button>
            )}

            {!isMobile && (
              <button
                onClick={toggleRepeat}
                className={`p-1.5 transition-colors ${repeat !== 'off' ? 'text-green-400' : 'text-gray-400 hover:text-white'}`}
                title={`Repeat: ${repeat}`}
              >
                {repeat === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
              </button>
            )}
          </div>

          {/* 3. Duration, Toggle & Close/End (Right block) */}
          <div className="flex items-center justify-end space-x-3 md:space-x-5 md:w-1/4 flex-shrink-0">
            {/* Duration */}
            <span className="text-gray-400 text-xs font-semibold hidden sm:inline bg-gray-800/40 px-2.5 py-1.5 rounded-lg border border-gray-800">
              {formatTime(duration * (progress / 100))} / {formatTime(duration)}
            </span>

            {/* Song / Video toggle for minimized view */}
            {currentSong && (
              <div className="hidden sm:flex items-center bg-gray-800 rounded-full p-0.5 border border-gray-700">
                <button
                  onClick={() => {
                    if (isVideoMode) {
                      toggleVideoMode();
                    } else {
                      setIsExpanded(true); // Open max view when clicking Song
                    }
                  }}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                    !isVideoMode
                      ? 'bg-green-600 text-white shadow'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title="Audio mode"
                >
                  <Music size={12} />
                  <span className="hidden md:inline">Song</span>
                </button>
                <button
                  onClick={() => {
                    if (!isVideoMode) toggleVideoMode();
                    setIsExpanded(true); // Automatically open max view when switching to video
                  }}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                    isVideoMode
                      ? 'bg-green-600 text-white shadow'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title="Switch to Video and Expand"
                >
                  <Film size={12} />
                  <span className="hidden md:inline">Video</span>
                </button>
              </div>
            )}

            <button
              onClick={handleClose}
              className="p-2 text-gray-500 hover:text-red-400 transition-colors"
              title="Close Player"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Player;