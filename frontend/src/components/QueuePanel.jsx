// components/QueuePanel.jsx
import React from 'react';
import { X, GripVertical } from 'lucide-react';
import { usePlayer } from '../contexts/PlayerContext';
import { thumbnailFor, handleThumbnailError, handleThumbnailLoad } from '../utils/thumbnails';

// Sizing and show/hide are the parent's job (Player.jsx animates the width
// of a wrapping flex column) — as a flex child stretched to that column's
// height, this always exactly matches the video/artwork area next to it
// instead of guessing a viewport-relative height that drifts out of sync
// with the controls below the video.
const QueuePanel = ({ onClose }) => {
  const { queue, currentIndex, currentSong, jumpToQueueIndex } = usePlayer();

  const upcoming = queue.map((song, index) => ({ song, index })).slice(currentIndex + 1);

  return (
    <div className="h-full w-80 bg-gray-900 border-l border-gray-800 flex flex-col">
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
              <img src={thumbnailFor(currentSong.thumbnailUrl, 'card')} alt={currentSong.title} onError={handleThumbnailError} onLoad={handleThumbnailLoad} className="w-10 h-10 rounded object-cover" loading="lazy" />
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
              onClick={() => jumpToQueueIndex(index)}
              className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-800/60 cursor-pointer group"
            >
              <GripVertical size={14} className="text-gray-600 flex-shrink-0" />
              <img src={thumbnailFor(song.thumbnailUrl, 'card')} alt={song.title} onError={handleThumbnailError} onLoad={handleThumbnailLoad} className="w-10 h-10 rounded object-cover flex-shrink-0" loading="lazy" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white truncate">{song.title}</p>
                <p className="text-xs text-gray-400 truncate">{song.artistsText}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default QueuePanel;
