import React, { useEffect, useRef } from 'react';

const Player = ({ songId, onClose }) => {
  const playerRef = useRef(null);

  useEffect(() => {
    if (songId) {
      // Initialize YouTube Player
      playerRef.current = new window.YT.Player('player', {
        height: '200', // Adjust height as needed
        width: '300',  // Adjust width as needed
        videoId: songId,
        playerVars: { 'autoplay': 1, 'controls': 1 },
        events: {
          'onReady': () => {
            playerRef.current.playVideo();
          },
        },
      });
    }

    return () => {
      // Cleanup player instance
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, [songId]);

  if (!songId) return null;

  return (
    <div
      className="fixed bottom-0 left-0 bg-gray-900 shadow-lg rounded z-50 p-2 md:w-[238px] md:h-[350px] md:mb-[70px] w-full h-32 mb-0"
      style={{ marginBottom: '0' }} // Ensure no margin on mobile
    >
      <div id="player" className="w-full h-full"></div>
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-white bg-red-500 w-8 h-8 flex items-center justify-center rounded"
      >
        <span className="material-icons">close</span>
      </button>
    </div>
  );
};

export default Player;
