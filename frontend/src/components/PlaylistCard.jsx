import React, { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';

const PlaylistCard = ({ playlist, onClick, isActive, onEdit, onDelete }) => {
  const [showActions, setShowActions] = useState(false);

  const handleEdit = (e) => {
    e.stopPropagation();
    onEdit(playlist);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete(playlist);
  };

  return (
    <div 
      onClick={onClick}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      className={`
        cursor-pointer rounded-xl transition-all duration-300 transform
        flex-shrink-0 w-[calc(20%-3px)] md:w-auto
        p-1 md:p-4 relative
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
      
      <div className="flex items-center justify-between mt-1 md:mt-3 gap-2">
        <h3 className={`text-[9px] md:text-lg font-semibold truncate transition-colors ${isActive ? 'text-green-400' : 'text-white'}`}>
          {playlist.name}
        </h3>
        
        {/* Circular action buttons - hidden on mobile */}
        <div className={`hidden md:flex items-center gap-2 transition-opacity duration-200 ${showActions ? 'opacity-100' : 'opacity-0'}`}>
          <button
            onClick={handleEdit}
            className="w-7 h-7 rounded-full bg-blue-500/90 hover:bg-blue-500 transition-all duration-200 flex items-center justify-center shadow-lg hover:scale-110"
            title="Edit playlist"
          >
            <Pencil size={14} className="text-white" />
          </button>
          <button
            onClick={handleDelete}
            className="w-7 h-7 rounded-full bg-red-500/90 hover:bg-red-500 transition-all duration-200 flex items-center justify-center shadow-lg hover:scale-110"
            title="Delete playlist"
          >
            <Trash2 size={14} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlaylistCard;