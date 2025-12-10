import React, { useState, useEffect, useRef } from 'react';
import { Heart, Plus, ExternalLink, Play, X } from 'lucide-react';
import { fetchFromServer } from '../utils/api';
import { usePlayer } from '../contexts/PlayerContext';
import toast from 'react-hot-toast';

const SongCard = ({ song, onToggleFavorite, songs = [] }) => {
  const { playSong, playQueue, addToQueue } = usePlayer();
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [songPlaylists, setSongPlaylists] = useState([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const playlistRef = useRef(null);
  const cardRef = useRef(null);
  
  const enhancedThumbnailUrl = song.thumbnailUrl?.replace(/w60-h60/, 'w544-h544') || '/images/default.jpg';

  useEffect(() => {
    setIsFavorite(song.likedAt !== null && song.likedAt !== undefined);
  }, [song]);

  // Close playlist dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (playlistRef.current && !playlistRef.current.contains(event.target)) {
        setShowPlaylists(false);
      }
      if (cardRef.current && !cardRef.current.contains(event.target)) {
        setShowControls(false);
      }
    };

    if (showPlaylists || showControls) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showPlaylists, showControls]);

  const fetchPlaylists = async () => {
    try {
      // Fetch all playlists
      const playlistData = await fetchFromServer('playlists');
      setPlaylists(playlistData.playlists || []);

      // Fetch playlists this song belongs to
      const songPlaylistData = await fetchFromServer(`songs/${song.id}/playlists`);
      setSongPlaylists(songPlaylistData.playlists || []);
      
      setShowPlaylists(!showPlaylists);
    } catch (error) {
      console.error('Error fetching playlists:', error);
      toast.error('Failed to load playlists');
    }
  };

  const handleFavoriteToggle = async (e) => {
    e.stopPropagation();
    const songData = {
      songId: song.id,
      title: song.title,
      artistsText: song.artistsText,
      durationText: song.durationText,
      thumbnailUrl: song.thumbnailUrl,
      totalPlayTimeMs: 0,
    };

    try {
      await fetchFromServer(`songs/${song.id}/favorite`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(songData),
      });

      setIsFavorite(!isFavorite);
      if (typeof onToggleFavorite === 'function') {
        onToggleFavorite(song.id);
      }
      toast.success(isFavorite ? 'Removed from favorites' : 'Added to favorites');
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorites');
    }
  };

  const handleAddToPlaylist = async (playlistId) => {
    const songData = {
      songId: song.id,
      title: song.title,
      artistsText: song.artistsText,
      durationText: song.durationText,
      thumbnailUrl: song.thumbnailUrl,
      totalPlayTimeMs: 0,
    };

    try {
      await fetchFromServer(`playlists/${playlistId}/songs/${song.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(songData),
      });
      toast.success('Added to playlist');
      
      // Refresh the playlists to show updated state
      const songPlaylistData = await fetchFromServer(`songs/${song.id}/playlists`);
      setSongPlaylists(songPlaylistData.playlists || []);
    } catch (error) {
      console.error('Error adding to playlist:', error);
      if (error.message.includes('already in playlist')) {
        toast.error('Song already in this playlist');
      } else {
        toast.error('Failed to add to playlist');
      }
    }
  };

  const handleRemoveFromPlaylist = async (playlistId, e) => {
    e.stopPropagation();
    
    try {
      await fetchFromServer(`playlists/${playlistId}/songs/${song.id}`, {
        method: 'DELETE',
      });
      toast.success('Removed from playlist');
      
      // Refresh the playlists to show updated state
      const songPlaylistData = await fetchFromServer(`songs/${song.id}/playlists`);
      setSongPlaylists(songPlaylistData.playlists || []);
    } catch (error) {
      console.error('Error removing from playlist:', error);
      toast.error('Failed to remove from playlist');
    }
  };

  const handlePlaySong = (e) => {
    e.stopPropagation();
    if (songs.length > 0) {
      const songIndex = songs.findIndex(s => s.id === song.id);
      playQueue(songs, songIndex >= 0 ? songIndex : 0);
    } else {
      playSong(song);
    }
  };

  const handleCardClick = (e) => {
    // On mobile, toggle controls; on desktop, play song
    if (window.innerWidth < 768) {
      e.stopPropagation();
      setShowControls(!showControls);
    } else {
      handlePlaySong(e);
    }
  };

  const openInYouTubeMusic = (e) => {
    e.stopPropagation();
    window.open(`https://music.youtube.com/watch?v=${song.id}`, '_blank');
  };

  const isInPlaylist = (playlistId) => {
    return songPlaylists.some(p => p.id === playlistId);
  };

  return (
    <div 
      ref={cardRef}
      className="relative group bg-gradient-to-br from-gray-800 to-gray-900 p-4 rounded-xl shadow-lg overflow-visible transition-all duration-300 hover:shadow-2xl hover:scale-105 cursor-pointer border border-gray-700 hover:border-gray-600"
      onClick={handleCardClick}
    >
      <div className="relative">
        <img
          src={enhancedThumbnailUrl}
          alt={song.title}
          className="w-full h-32 sm:h-48 md:h-56 object-cover rounded transition-all duration-300 group-hover:brightness-75"
        />
        
        {/* Gradient Overlay */}
        <div className={`absolute inset-0 bg-gradient-to-t from-black/60 to-transparent transition-opacity duration-300 rounded-lg ${showControls ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />

        {/* Play Button Overlay */}
        <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <button
            onClick={handlePlaySong}
            className="bg-green-500 rounded-full p-4 shadow-2xl hover:scale-110 transition-transform"
          >
            <Play size={32} fill="white" className="text-white" />
          </button>
        </div>

        {/* Top Controls */}
        <div className={`absolute top-2 left-2 flex flex-col space-y-2 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <button
            onClick={handleFavoriteToggle}
            className="p-2 bg-black/70 backdrop-blur-sm rounded-full hover:scale-110 transition-transform"
            title={isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
          >
            <Heart
              size={20}
              className={isFavorite ? 'fill-red-500 text-red-500' : 'text-white'}
            />
          </button>

          <div className="relative" ref={playlistRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                fetchPlaylists();
              }}
              className="p-2 bg-black/70 backdrop-blur-sm rounded-full hover:scale-110 transition-transform"
              title="Manage Playlists"
            >
              <Plus size={20} className="text-white" />
            </button>

            {showPlaylists && (
              <div 
                className="absolute left-full ml-2 top-0 bg-gray-900/95 backdrop-blur-xl rounded-xl border border-gray-600 shadow-2xl z-[9999] w-40 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="px-2.5 py-2 border-b border-gray-700 bg-gray-800/50">
                  <h4 className="text-xs font-semibold text-white">Add to Playlist</h4>
                </div>

                {/* Scrollable Playlist List - Always show scrollbar */}
                <div className="h-48 overflow-y-scroll custom-scrollbar">
                  {playlists.length > 0 ? (
                    <div className="p-2 space-y-1">
                      {playlists.map((playlist) => {
                        const inPlaylist = isInPlaylist(playlist.id);
                        return (
                          <div
                            key={playlist.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!inPlaylist) {
                                handleAddToPlaylist(playlist.id);
                              }
                            }}
                            className={`flex items-center justify-between px-2.5 py-2 rounded-lg transition-all ${
                              inPlaylist
                                ? 'bg-green-500/20 border border-green-500/50 cursor-default'
                                : 'hover:bg-gray-800 border border-transparent cursor-pointer hover:border-gray-600'
                            }`}
                          >
                            <span className={`flex-1 text-xs font-medium truncate ${
                              inPlaylist ? 'text-green-400' : 'text-white'
                            }`}>
                              {playlist.name}
                            </span>
                            {inPlaylist && (
                              <button
                                onClick={(e) => handleRemoveFromPlaylist(playlist.id, e)}
                                className="ml-1.5 p-0.5 hover:bg-red-500/30 rounded-full transition-colors flex-shrink-0"
                                title="Remove from playlist"
                              >
                                <X size={14} className="text-red-400" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-3 text-center">
                      <p className="text-xs text-gray-400">No playlists available</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* External Link */}
        <button
          onClick={openInYouTubeMusic}
          className={`absolute top-2 right-2 p-2 bg-black/70 backdrop-blur-sm rounded-full hover:scale-110 transition-all ${showControls ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
          title="Open in YouTube Music"
        >
          <ExternalLink size={18} className="text-white" />
        </button>
      </div>

      {/* Song Info */}
      <div className="mt-3 space-y-1">
        <h3 className="text-white font-semibold truncate text-lg group-hover:text-green-400 transition-colors">
          {song.title}
        </h3>
        <div className="flex items-center justify-between text-sm">
          <p className="text-gray-400 truncate flex-1">
            {song.artistsText || 'Unknown Artist'}
          </p>
          {song.durationText && (
            <span className="text-gray-500 ml-2">{song.durationText}</span>
          )}
        </div>
      </div>

      {/* Custom Scrollbar Styles */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(55, 65, 81, 0.3);
          border-radius: 10px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(156, 163, 175, 0.5);
          border-radius: 10px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(156, 163, 175, 0.7);
        }
      `}</style>
    </div>
  );
};

export default SongCard;