import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import SongCard from './components/SongCard';
import Player from './components/Player';
import PlaylistCard from './components/PlaylistCard';

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

  const fetchSongs = async () => {
    try {
// 	  const response = await fetch('http://localhost:5000/api/songs');
      const response = await fetch('https://vimusic-server.up.railway.app/api/songs');
      const data = await response.json();
      setSongs(data.songs);
    } catch (error) {
      console.error('Error fetching songs:', error);
    }
  };

  const fetchPlaylists = async () => {
    try {
//	  const response = await fetch('http://localhost:5000/api/playlists');
      const response = await fetch('https://vimusic-server.up.railway.app/api/playlists');
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      
      // Add local image URLs to playlists
      const playlistsWithImages = data.playlists.map(playlist => {
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
            imageUrl = '/images/default.jpg'; // Fallback image if needed
            break;
        }
        return { ...playlist, thumbnailUrl: imageUrl };
      });

      setPlaylists(playlistsWithImages);

      // Set "High" as the default active playlist if it exists
      const highPlaylist = playlistsWithImages.find(playlist => playlist.name === 'High');
      if (highPlaylist) {
        setActivePlaylistId(highPlaylist.id);
        fetchSongsForPlaylist(highPlaylist.id);
        setActiveTab('playlists');
      }
    } catch (error) {
      console.error('Error fetching playlists:', error);
    }
  };

  const fetchSongsForPlaylist = async (playlistId) => {
    try {
//	  const response = await fetch(`http://localhost:5000/api/playlists/${playlistId}/songs`);
      const response = await fetch(`https://vimusic-server.up.railway.app/api/playlists/${playlistId}/songs`);
      const data = await response.json();
      setSelectedPlaylistSongs(data.songs);
    } catch (error) {
      console.error('Error fetching songs for playlist:', error);
    }
  };

  useEffect(() => {
    fetchSongs();
  }, []);

  const handlePlayClick = (songId) => {
    setPlayingSongId(songId);
  };

  const handleClosePlayer = () => {
    setPlayingSongId(null);
  };

  const handleSearch = async (query) => {
    setIsSearching(true);
    try {
      const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&key=${process.env.REACT_APP_YOUTUBE_API_KEY}`);
      const data = await response.json();
      setSearchResults(data.items);
    } catch (error) {
      console.error('Error searching for songs:', error);
    }
  };

  const handleClearSearch = () => {
    setIsSearching(false);
    setSearchResults([]);
  };

  const handleSidebarToggle = () => {
    setIsSidebarOpen(prevState => !prevState);
  };

  const handleViewPlaylists = () => {
    setActiveTab('playlists');
    fetchPlaylists();
  };

  const handleViewMostPlayed = () => {
    setActiveTab('mostPlayed');
    fetchSongs(); // Fetch songs again to ensure the data is up-to-date
  };

  const handlePlaylistClick = (playlistId) => {
    fetchSongsForPlaylist(playlistId);
    setActivePlaylistId(playlistId); // Set the clicked playlist as active
  };

  const displayedSongs = isSearching ? searchResults.map(result => ({
    id: result.id.videoId,
    title: result.snippet.title,
    artistsText: result.snippet.channelTitle,
    thumbnailUrl: result.snippet.thumbnails.high.url
  })) : songs;

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={handleSidebarToggle} 
        onViewPlaylists={handleViewPlaylists}
        onViewMostPlayed={handleViewMostPlayed}
        activeTab={activeTab}
        activePlaylistId={activePlaylistId} // Pass activePlaylistId to Sidebar
      />
      <div className="flex-1 flex flex-col">
        <Header onSearch={handleSearch} onClearSearch={handleClearSearch} onSidebarToggle={handleSidebarToggle} />
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">{isSearching ? 'Search Results' : activeTab === 'mostPlayed' ? 'Most Played' : 'Playlists'}</h2>
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
                {displayedSongs.map(song => (
                  <SongCard key={song.id} song={song} onPlayClick={handlePlayClick} />
                ))}
              </div>
            ) : activeTab === 'playlists' ? (
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {playlists.length > 0 ? (
                    playlists.map(playlist => (
                      <PlaylistCard 
                        key={playlist.id} 
                        playlist={playlist} 
                        onClick={() => handlePlaylistClick(playlist.id)} 
                        isActive={playlist.id === activePlaylistId} // Pass active state
                      />
                    ))
                  ) : (
                    <p className="text-center text-white">No playlists available</p>
                  )}
                </div>
                {selectedPlaylistSongs.length > 0 && (
                  <div className="mt-4">
                    <h2 className="text-xl font-semibold">Songs in Selected Playlist</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mt-4">
                      {selectedPlaylistSongs.map(song => (
                        <SongCard key={song.id} song={song} onPlayClick={handlePlayClick} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mt-4">
                {displayedSongs.map(song => (
                  <SongCard key={song.id} song={song} onPlayClick={handlePlayClick} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <Player songId={playingSongId} onClose={handleClosePlayer} />
    </div>
  );
};

export default App;
