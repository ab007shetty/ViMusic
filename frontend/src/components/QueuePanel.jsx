// components/QueuePanel.jsx
import React from 'react';
import { X, GripVertical, Trash2 } from 'lucide-react';
import { usePlayer } from '../contexts/PlayerContext';

const QueuePanel = ({ isOpen, onClose }) => {
  const { queue, currentIndex, currentSong, playQueue, removeFromQueue } = usePlayer();

  const upcoming = queue.map((song, index) => ({ song, index })).slice(currentIndex + 1);

  return (
    <div
      className={`fixed top-16 right-0 bottom-20 md:bottom-24 w-full sm:w-80 bg-gray-900 border-l border-gray-800 z-50 transform transition-transform duration-300 ease-out flex flex-col ${
        isOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
      }`}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h3 className="text-white font-semibold">Up Next</h3>
        <button onClick={onClose} className="p-1.5 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {currentSong && (
          <div className="px-2 py-2 mb-2">
            <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Now playing</p>
            <div className="flex items-center gap-3 bg-gray-800/60 rounded-lg p-2">
              <img src={currentSong.thumbnailUrl} alt={currentSong.title} className="w-10 h-10 rounded object-cover" loading="lazy" />
              <div className="min-w-0">
                <p className="text-sm text-white truncate">{currentSong.title}</p>
                <p className="text-xs text-gray-400 truncate">{currentSong.artistsText}</p>
              </div>
            </div>
          </div>
        )}

        {upcoming.length === 0 ? (
          <p className="text-sm text-gray-500 px-2 py-4">Nothing queued next.</p>
        ) : (
          upcoming.map(({ song, index }) => (
            <div
              key={`${song.id}-${index}`}
              onClick={() => playQueue(queue, index)}
              className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-800/60 cursor-pointer group"
            >
              <GripVertical size={14} className="text-gray-600 flex-shrink-0" />
              <img src={song.thumbnailUrl} alt={song.title} className="w-10 h-10 rounded object-cover flex-shrink-0" loading="lazy" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white truncate">{song.title}</p>
                <p className="text-xs text-gray-400 truncate">{song.artistsText}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeFromQueue(index); }}
                className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-500 hover:text-red-400 transition-all flex-shrink-0"
                title="Remove from queue"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default QueuePanel;
