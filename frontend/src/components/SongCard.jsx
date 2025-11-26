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
  const playlistRef = useRef(null);
  
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
    };

    if (showPlaylists) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPlaylists]);

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

  const openInYouTubeMusic = (e) => {
    e.stopPropagation();
    window.open(`https://music.youtube.com/watch?v=${song.id}`, '_blank');
  };

  const isInPlaylist = (playlistId) => {
    return songPlaylists.some(p => p.id === playlistId);
  };

  return (
    <div 
      className="relative group bg-gradient-to-br from-gray-800 to-gray-900 p-4 rounded-xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-2xl hover:scale-105 cursor-pointer border border-gray-700 hover:border-gray-600"
      onClick={handlePlaySong}
    >
      <div className="relative">
        <img
          src={enhancedThumbnailUrl}
          alt={song.title}
          className="w-full h-32 sm:h-48 md:h-56 object-cover rounded transition-all duration-300 group-hover:brightness-75"
        />
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg" />

        {/* Play Button Overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button
            onClick={handlePlaySong}
            className="bg-green-500 rounded-full p-4 shadow-2xl hover:scale-110 transition-transform"
          >
            <Play size={32} fill="white" className="text-white" />
          </button>
        </div>

        {/* Top Controls */}
        <div className="absolute top-2 left-2 flex flex-col space-y-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
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
                className="absolute left-full ml-1 top-0 bg-gray-900 backdrop-blur-xl rounded-xl border border-gray-600 p-2 z-50 w-40 max-h-72 overflow-y-scroll"
                onClick={(e) => e.stopPropagation()}
              >
                {playlists.length > 0 ? (
                  <div className="space-y-1">
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
                          className={`flex items-center justify-between px-2.5 py-2 rounded-lg transition-all cursor-pointer ${
                            inPlaylist
                              ? 'bg-green-500/15 border border-green-500/40'
                              : 'hover:bg-gray-800 border border-transparent'
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
                              className="p-0.5 hover:bg-red-500/20 rounded transition-colors ml-1.5 flex-shrink-0"
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
                  <p className="text-xs text-gray-400 text-center py-3">No playlists</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* External Link */}
        <button
          onClick={openInYouTubeMusic}
          className="absolute top-2 right-2 p-2 bg-black/70 backdrop-blur-sm rounded-full opacity-0 group-hover:opacity-100 hover:scale-110 transition-all"
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
    </div>
  );
};

export default SongCard;