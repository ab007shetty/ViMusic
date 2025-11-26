// components/Player.jsx
import React, { useEffect, useRef, useState } from 'react';
import { usePlayer } from '../contexts/PlayerContext';
import { 
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, 
  Shuffle, Repeat, Repeat1, X
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
    playerRef,
    setIsPlaying,
    playNext,
    playPrevious,
    seekTo,
    changeVolume,
    toggleShuffle,
    toggleRepeat,
    closePlayer,
    setProgress,
    setDuration,
  } = usePlayer();

  const [isMuted, setIsMuted] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const ytPlayerRef = useRef(null);
  const isPlayerReady = useRef(false);
  const updateIntervalRef = useRef(null);

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
        height: '0',
        width: '0',
        videoId: currentSong.id,
        playerVars: {
          autoplay: 1,
          controls: 0,
          enablejsapi: 1,
          origin: window.location.origin,
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onReady: (event) => {
            console.log('Player ready!');
            isPlayerReady.current = true;
            playerRef.current = event.target;
            event.target.setVolume(volume * 100);
            
            // Start progress updates immediately
            startProgressUpdates();
            
            if (isPlaying) {
              event.target.playVideo();
            }
          },
          onStateChange: (event) => {
            console.log('Player state changed:', event.data);
            
            if (event.data === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              startProgressUpdates();
            } else if (event.data === window.YT.PlayerState.PAUSED) {
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
        playerRef.current.pauseVideo();
      } else {
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
      <div id="yt-player" style={{ display: 'none' }}></div>
      
      <div className={`fixed bottom-0 left-0 right-0 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-t border-gray-700 backdrop-blur-lg bg-opacity-95 z-50 transition-all duration-300 ${isMobile ? 'h-16' : 'h-20'}`}>
        {!isMobile && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-gray-700">
            <div
              className="h-full bg-gradient-to-r from-green-400 to-blue-500 transition-all duration-300"
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
        )}

        <div className="container mx-auto px-4 h-full flex items-center justify-between">
          {/* Song Info */}
          <div className="flex items-center space-x-4 flex-1 min-w-0">
            <img
              src={currentSong.thumbnailUrl?.replace(/w60-h60/, 'w120-h120') || '/images/default.jpg'}
              alt={currentSong.title}
              className={`rounded-lg shadow-lg transition-all ${isMobile ? 'w-12 h-12' : 'w-16 h-16'}`}
            />
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-semibold truncate text-sm md:text-base" title={currentSong.title}>
                {isMobile ? truncateText(currentSong.title, 30) : truncateText(currentSong.title, 50)}
              </h3>
              {!isMobile && (
                <p className="text-gray-400 text-xs md:text-sm truncate" title={currentSong.artistsText || 'Unknown Artist'}>
                  {truncateText(currentSong.artistsText || 'Unknown Artist', 40)}
                </p>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-2 md:space-x-4">
            {!isMobile && (
              <>
                <button
                  onClick={toggleShuffle}
                  className={`p-2 rounded-full transition-colors ${shuffle ? 'text-green-400' : 'text-gray-400 hover:text-white'}`}
                  title="Shuffle"
                >
                  <Shuffle size={18} />
                </button>
                <button
                  onClick={playPrevious}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                  title="Previous"
                >
                  <SkipBack size={20} />
                </button>
              </>
            )}
            
            <button
              onClick={handleTogglePlay}
              className="p-3 bg-white rounded-full text-gray-900 hover:scale-110 transition-transform shadow-lg"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            </button>

            {!isMobile && (
              <>
                <button
                  onClick={playNext}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                  title="Next"
                >
                  <SkipForward size={20} />
                </button>
                <button
                  onClick={toggleRepeat}
                  className={`p-2 rounded-full transition-colors ${repeat !== 'off' ? 'text-green-400' : 'text-gray-400 hover:text-white'}`}
                  title={`Repeat: ${repeat}`}
                >
                  {repeat === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
                </button>
              </>
            )}
          </div>

          {/* Right Controls */}
          <div className="flex items-center space-x-2 md:space-x-4 flex-1 justify-end">
            {/* Timer - show on both mobile and desktop */}
            <span className="text-xs text-gray-400">
              {formatTime(duration * (progress / 100))} / {formatTime(duration)}
            </span>

            {!isMobile && (
              <>
                <div className="items-center space-x-2 hidden md:flex">
                  <button
                    onClick={handleMuteToggle}
                    className="p-2 text-gray-400 hover:text-white transition-colors"
                    title="Volume"
                  >
                    {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={(e) => {
                      changeVolume(Number(e.target.value));
                      setIsMuted(false);
                    }}
                    className="w-20 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-400"
                    style={{
                      background: `linear-gradient(to right, #4ade80 0%, #4ade80 ${volume * 100}%, #374151 ${volume * 100}%, #374151 100%)`
                    }}
                  />
                </div>
              </>
            )}

            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-red-400 transition-colors"
              title="Close Player"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Player;