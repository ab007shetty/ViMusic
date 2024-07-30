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
      className="card fixed truncate  rounded bottom-0 left-0 bg-gray-900 shadow-lg"
      style={{
        width: '238px',   // Width to fit below the sidebar
        height: '350px',  // Height to fit below the sidebar
        zIndex: 1000,     // Ensure it appears on top of other content
        marginBottom: '70px', // Adjust based on sidebar width
      }}
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
