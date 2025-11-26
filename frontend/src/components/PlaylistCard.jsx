// components/PlaylistCard.jsx
import React from 'react';

const PlaylistCard = ({ playlist, onClick, isActive }) => {
  return (
    <div 
      onClick={onClick}
      className={`
        cursor-pointer rounded-xl transition-all duration-300 transform
        flex-shrink-0 w-[calc(20%-3px)] md:w-auto
        p-1 md:p-4
        ${isActive 
          ? 'border-2 border-green-500 bg-gray-800/80 shadow-lg shadow-green-500/20 md:scale-105' 
          : 'border-2 border-gray-700 bg-gray-800/50 hover:border-green-500 hover:shadow-lg hover:shadow-green-500/10 md:hover:scale-105'
        }
      `}
    >
      <div className="relative overflow-hidden rounded-lg md:rounded-xl">
        <img 
          src={playlist.thumbnailUrl} 
          alt={playlist.name} 
          className="w-full aspect-square md:h-32 md:aspect-auto object-cover transition-transform duration-300 md:hover:scale-110" 
        />
      </div>
      <h3 className={`mt-1 md:mt-3 text-[9px] md:text-lg font-semibold truncate transition-colors ${isActive ? 'text-green-400' : 'text-white'}`}>
        {playlist.name}
      </h3>
    </div>
  );
};

export default PlaylistCard;