import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import SongCard from './components/SongCard';
import Player from './components/Player';
import PlaylistCard from './components/PlaylistCard';
import { fetchFromServer } from './utils/api';

const App = () => {
  const [songs, setSongs] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylistSongs, setSelectedPlaylistSongs] = useState([]);
  const [playingSongId, setPlayingSongId] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('mostPlayed');
  const [activePlaylistId, setActivePlaylistId] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [favorites, setFavorites] = useState(new Set());

  // Retrieve the saved active tab from local storage
  useEffect(() => {
    const savedTab = localStorage.getItem('activeTab');
    if (savedTab) {
      setActiveTab(savedTab);
    }
  }, []);

  // Save the active tab to local storage whenever it changes
  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  // Fetch songs function wrapped in useCallback
  const fetchSongs = useCallback(async () => {
    try {
      const data = await fetchFromServer('songs');
      setSongs(data.songs);
    } catch (error) {
      console.error('Error fetching songs:', error);
    }
  }, []);

  // Fetch favorite songs function wrapped in useCallback
  const fetchFavorites = useCallback(async () => {
    try {
      const data = await fetchFromServer('favorites');
      setSongs(data.songs);
    } catch (error) {
      console.error('Error fetching favorites:', error);
    }
  }, []);

  // Fetch songs for a specific playlist
  const fetchSongsForPlaylist = useCallback(async (playlistId) => {
    try {
      const data = await fetchFromServer(`playlists/${playlistId}/songs`);
      setSelectedPlaylistSongs(data.songs);
    } catch (error) {
      console.error('Error fetching songs for playlist:', error);
    }
  }, []);

  // Fetch playlists from the API
  const fetchPlaylists = useCallback(async () => {
    try {
      const data = await fetchFromServer('playlists');

      const playlistsWithImages = data.playlists.map((playlist) => {
        let imageUrl;
        switch (playlist.name) {
          case 'High':
            imageUrl = '/images/high.jpeg';
            break;
          case 'Low':
            imageUrl = '/images/low.jpeg';
            break;
          case 'Peace':
            imageUrl = '/images/peace.jpeg';
            break;
          case 'Kannada':
            imageUrl = '/images/kannada.jpg';
            break;
          case 'Beats':
            imageUrl = '/images/beats.jpeg';
            break;
          default:
            imageUrl = '/images/default.jpg';
            break;
        }
        return { ...playlist, thumbnailUrl: imageUrl };
      });

      setPlaylists(playlistsWithImages);

      const highPlaylist = playlistsWithImages.find(
        (playlist) => playlist.name === 'High'
      );
      if (highPlaylist) {
        setActivePlaylistId(highPlaylist.id);
        fetchSongsForPlaylist(highPlaylist.id);
        setActiveTab('playlists');
      }
    } catch (error) {
      console.error('Error fetching playlists:', error);
    }
  }, [fetchSongsForPlaylist]);

  // useEffect to trigger fetchPlaylists based on activeTab
  useEffect(() => {
    if (activeTab === 'mostPlayed') {
      fetchSongs(); // Call fetchSongs when mostPlayed tab is active
    } else if (activeTab === 'playlists') {
      fetchPlaylists(); // Call fetchPlaylists when playlists tab is active
    } else if (activeTab === 'favorites') {
      fetchFavorites(); // Call fetchFavorites when favorites tab is active
    }
  }, [activeTab, fetchPlaylists, fetchFavorites, fetchSongs]);


//===============================================================================================================================================================

 // Handle play button click
  const handlePlayClick = (songId) => {
    setPlayingSongId(songId);
  };

  // Handle closing the player
  const handleClosePlayer = () => {
    setPlayingSongId(null);
  };

  // Clear search results
  const handleClearSearch = () => {
    setIsSearching(false);
    setSearchResults([]);
  };

  // Handle sidebar toggle
  const handleSidebarToggle = () => {
    setIsSidebarOpen((prevState) => !prevState);
  };

  // Handle view playlists
  const handleViewPlaylists = () => {
    setActiveTab('playlists');
  };

  // Handle view most played songs
  const handleViewMostPlayed = () => {
    setActiveTab('mostPlayed');
  };

  // Handle view favorite songs
  const handleViewFavorites = () => {
    setActiveTab('favorites');
  };

  // Handle playlist click
  const handlePlaylistClick = (playlistId) => {
    fetchSongsForPlaylist(playlistId);
    setActivePlaylistId(playlistId);
  };
  
    // Handle search
  const handleSearch = async (query) => {
    setIsSearching(true);
    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&maxResults=10&videoCategoryId=10&key=${process.env.REACT_APP_YOUTUBE_API_KEY}`
      );
      const data = await response.json();
      setSearchResults(data.items);
    } catch (error) {
      console.error('Error searching for songs:', error);
    }
  };

  // Toggle favorite songs
  const toggleFavorite = (songId) => {
    const updatedFavorites = new Set(favorites);
    if (updatedFavorites.has(songId)) {
      updatedFavorites.delete(songId);
    } else {
      updatedFavorites.add(songId);
    }
    setFavorites(updatedFavorites);
  };

  // Determine displayed songs based on search or current tab
  const displayedSongs = isSearching
    ? searchResults.map((result) => ({
        id: result.id.videoId,
        title: result.snippet.title,
        artistsText: result.snippet.channelTitle,
        thumbnailUrl: result.snippet.thumbnails.high.url,
      }))
    : songs;

  //======================================================================================================

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={handleSidebarToggle}
        onViewPlaylists={handleViewPlaylists}
        onViewMostPlayed={handleViewMostPlayed}
        onViewFavorites={handleViewFavorites}
        activeTab={activeTab}
      />
      <div className="flex-1 flex flex-col">
        <Header
          onSearch={handleSearch}
          onClearSearch={handleClearSearch}
          onSidebarToggle={handleSidebarToggle}
        />
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">
              {isSearching
                ? 'Search Results'
                : activeTab === 'mostPlayed'
                ? 'Top 100 Most Played Tracks'
                : activeTab === 'playlists'
                ? 'Playlists'
                : 'Favorites'}
            </h2>
            {isSearching && (
              <button
                onClick={handleClearSearch}
                className="text-white bg-red-500 hover:bg-red-700 rounded-lg p-2 w-8 h-8 flex items-center justify-center"
              >
                <span className="material-icons">close</span>
              </button>
            )}
          </div>
          <div className="mt-4">
            {isSearching ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {displayedSongs.map((song) => (
                  <SongCard
                    key={song.id}
                    song={song}
                    onPlayClick={handlePlayClick}
                    isFavorite={favorites.has(song.id)}
                    onToggleFavorite={toggleFavorite}
                  />
                ))}
              </div>
            ) : activeTab === 'playlists' ? (
              <div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {playlists.map((playlist) => (
                    <PlaylistCard
                      key={playlist.id}
                      playlist={playlist}
                      onClick={() => handlePlaylistClick(playlist.id)}
                      isActive={playlist.id === activePlaylistId}
                    />
                  ))}
                </div>
                {selectedPlaylistSongs.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold mt-4">
                      Songs in {playlists.find((p) => p.id === activePlaylistId)?.name}
                    </h3>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {selectedPlaylistSongs.map((song) => (
                        <SongCard
                          key={song.id}
                          song={song}
                          onPlayClick={handlePlayClick}
                          isFavorite={favorites.has(song.id)}
                          onToggleFavorite={toggleFavorite}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {displayedSongs.map((song) => (
                  <SongCard
                    key={song.id}
                    song={song}
                    onPlayClick={handlePlayClick}
                    isFavorite={favorites.has(song.id)}
                    onToggleFavorite={toggleFavorite}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        {playingSongId && <Player songId={playingSongId} onClose={handleClosePlayer} />}
      </div>
    </div>
  );
};

export default App;
