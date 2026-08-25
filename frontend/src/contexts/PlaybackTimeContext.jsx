// contexts/PlaybackTimeContext.jsx
import React, { createContext, useContext, useState, useMemo } from 'react';

const PlaybackTimeContext = createContext();

export const usePlaybackTime = () => {
  const context = useContext(PlaybackTimeContext);
  if (!context) {
    throw new Error('usePlaybackTime must be used within PlaybackTimeProvider');
  }
  return context;
};

export const PlaybackTimeProvider = ({ children }) => {
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  // setProgress/setDuration are stable forever (useState guarantee), so this
  // memo only produces a new object when progress or duration actually change.
  const value = useMemo(
    () => ({ progress, duration, setProgress, setDuration }),
    [progress, duration]
  );

  return <PlaybackTimeContext.Provider value={value}>{children}</PlaybackTimeContext.Provider>;
};
