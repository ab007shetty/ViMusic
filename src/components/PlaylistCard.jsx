import React from 'react';

const PlaylistCard = ({ playlist, onClick, isActive }) => {
  return (
    <div 
      onClick={onClick}
      className={`cursor-pointer p-4 rounded-lg border-2 ${isActive ? 'border-blue-500 bg-gray-800' : 'border-gray-700'} hover:border-blue-400 transition-all duration-300`}
    >
      <img 
        src={playlist.thumbnailUrl} 
        alt={playlist.name} 
        className="w-full h-32 object-cover rounded-lg" 
      />
      <h3 className="mt-2 text-lg font-semibold">{playlist.name}</h3>
    </div>
  );
};

export default PlaylistCard;
