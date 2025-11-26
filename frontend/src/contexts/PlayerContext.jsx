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
  
  const playerRef = useRef(null);
  const progressInterval = useRef(null);

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

  const playSong = (song) => {
    setCurrentSong(song);
    setIsPlaying(true);
    setProgress(0);
    setDuration(0);
    toast.success(`Now playing: ${song.title}`);
  };

  const playQueue = (songs, startIndex = 0) => {
    setQueue(songs);
    setCurrentIndex(startIndex);
    setCurrentSong(songs[startIndex]);
    setIsPlaying(true);
    setProgress(0);
    setDuration(0);
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
  };

  const playPrevious = () => {
    if (queue.length === 0) return;

    const prevIndex = currentIndex === 0 ? queue.length - 1 : currentIndex - 1;
    setCurrentIndex(prevIndex);
    setCurrentSong(queue[prevIndex]);
    setIsPlaying(true);
    setProgress(0);
    setDuration(0);
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
    addToQueue,
    removeFromQueue,
    closePlayer,
    setIsPlaying,
    setProgress,
    setDuration,
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
};