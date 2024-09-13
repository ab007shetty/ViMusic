import React from 'react';

// Function to handle play button click
const openYouTubeMusicPlayer = (songId) => {
  const url = `https://music.youtube.com/watch?v=${songId}`;
  window.open(url, '_blank');
};

// Enhance the thumbnail URL by adjusting the width and height
const getEnhancedThumbnailUrl = (url) => {
  return url.replace(/w60-h60/, 'w544-h544');
};

const SongCard = ({ song, onPlayClick }) => {
  const enhancedThumbnailUrl = getEnhancedThumbnailUrl(song.thumbnailUrl);

  return (
    <div className="relative group bg-gray-800 p-4 rounded-lg shadow-lg overflow-hidden transition-transform transform hover:scale-105 hover:shadow-xl">
      <img 
        src={enhancedThumbnailUrl} 
        alt={song.title} 
        className="w-full h-32 sm:h-48 md:h-56 object-cover rounded transition-filter filter group-hover:brightness-75"
      />
      
      <div className="absolute top-3 right-3 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => openYouTubeMusicPlayer(song.id)}
          className="p-2 rounded-full text-white text-xs sm:text-sm md:text-base transition-transform transform hover:scale-110"
          title="Open in YouTube Music"
        >
          <span className="material-icons">open_in_new</span>
        </button>
      </div>

      <div className="absolute bottom-4 right-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="bg-black bg-opacity-40 p-2 sm:p-3 md:p-4 rounded-full transition-opacity opacity-100 group-hover:opacity-100">
          <button
            onClick={() => onPlayClick(song.id)}
            className="text-green-500 text-xl sm:text-2xl md:text-3xl flex items-center justify-center transition-transform transform hover:scale-110"
          >
            <span className="material-icons">play_arrow</span>
          </button>
        </div>
      </div>

      <div className="mt-2 text-white">
        <h3 className="text-lg font-semibold truncate">{song.title}</h3>
        <p className="text-gray-400 truncate">{song.artistsText}</p>
      </div>
    </div>
  );
};

export default SongCard;
