import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PlayerProvider } from './contexts/PlayerContext';
import { fetchFromServer } from './utils/api';
import { Loader, X } from 'lucide-react';
import { supabase } from './supabase';
import { switchToUserDatabase } from './utils/databaseUtils';
import toast, { Toaster } from 'react-hot-toast';

import Header from './components/Header';
import Sidebar from './components/Sidebar';
import SongCard from './components/SongCard';
import Player from './components/Player';
import PlaylistCard from './components/PlaylistCard';
import SortFilter from './components/SortFilter';

const App = () => {
  const [songs, setSongs] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylistSongs, setSelectedPlaylistSongs] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('favorites');
  const [activePlaylistId, setActivePlaylistId] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentSort, setCurrentSort] = useState('addedOn');
  const [sortOrder, setSortOrder] = useState('desc');
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  // Sidebar closed on mobile by default
  useEffect(() => {
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, []);

  // Persist active tab
  useEffect(() => {
    const savedTab = localStorage.getItem('activeTab') || 'mostPlayed';
    setActiveTab(savedTab);
  }, []);

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  // Fetch functions with useCallback
  const fetchSongs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchFromServer('songs');
      setSongs(data.songs || []);
    } catch (error) {
      console.error('Error fetching songs:', error);
      toast.error('Failed to load songs');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFavorites = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchFromServer('favorites');
      setSongs(data.songs || []);
    } catch (error) {
      console.error('Error fetching favorites:', error);
      toast.error('Failed to load favorites');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSongsForPlaylist = useCallback(async (playlistId) => {
    setLoading(true);
    try {
      const data = await fetchFromServer(`playlists/${playlistId}/songs`);
      setSelectedPlaylistSongs(data.songs || []);
    } catch (error) {
      console.error('Error fetching playlist songs:', error);
      toast.error('Failed to load playlist songs');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPlaylists = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchFromServer('playlists');
      const imageMap = {
        'High': '/images/high.jpeg',
        'Low': '/images/low.jpeg',
        'Peace': '/images/peace.jpeg',
        'Kannada': '/images/kannada.jpg',
        'Beats': '/images/beats.jpeg',
      };
      
      const playlistsWithImages = (data.playlists || []).map((playlist) => ({
        ...playlist,
        thumbnailUrl: imageMap[playlist.name] || '/images/default.jpg',
      }));
      
      setPlaylists(playlistsWithImages);

      const highPlaylist = playlistsWithImages.find((p) => p.name === 'High');
      if (highPlaylist) {
        setActivePlaylistId(highPlaylist.id);
        fetchSongsForPlaylist(highPlaylist.id);
      }
    } catch (error) {
      console.error('Error fetching playlists:', error);
      toast.error('Failed to load playlists');
    } finally {
      setLoading(false);
    }
  }, [fetchSongsForPlaylist]);

  // Refresh current view
  const refreshCurrentView = useCallback(() => {
    if (activeTab === 'mostPlayed') {
      fetchSongs();
    } else if (activeTab === 'playlists') {
      fetchPlaylists();
    } else if (activeTab === 'favorites') {
      fetchFavorites();
    }
  }, [activeTab, fetchSongs, fetchPlaylists, fetchFavorites]);

  // Load data based on active tab
  useEffect(() => {
    refreshCurrentView();
  }, [refreshCurrentView]);

  // Auto-switch database when user logs in with Supabase
  useEffect(() => {
    let isProcessingAuth = false;

    // Get initial session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUser(session.user);
        console.log('📍 Existing session found for:', session.user.email);
        // Don't auto-switch on initial load - let user trigger actions
      }
    };

    checkSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔐 Auth event:', event, session?.user?.email);
      
      if (event === 'SIGNED_IN' && session?.user && !isProcessingAuth) {
        isProcessingAuth = true;
        const user = session.user;
        setCurrentUser(user);
        console.log('✅ User signed in:', user.email);
        
        const loadingToast = toast.loading('Setting up your account...');
        
        try {
          // Ensure database exists and switch to it
          const result = await switchToUserDatabase(user.email);
          
          toast.dismiss(loadingToast);
          
          if (result.isNew) {
            toast.success('Welcome! Your account is ready.', { duration: 4000 });
            // For new users, do a full page reload to ensure clean state
            setTimeout(() => window.location.reload(), 1500);
          } else {
            toast.success('Welcome back!');
            // For existing users, just refresh current view
            setTimeout(() => {
              if (activeTab === 'mostPlayed') {
                fetchSongs();
              } else if (activeTab === 'playlists') {
                fetchPlaylists();
              } else if (activeTab === 'favorites') {
                fetchFavorites();
              }
            }, 500);
          }
        } catch (error) {
          console.error('❌ Failed to switch database:', error);
          toast.dismiss(loadingToast);
          toast.error(`Failed to load your data: ${error.message}`);
        } finally {
          isProcessingAuth = false;
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('👋 User signed out');
        setCurrentUser(null);
        // Reset to guest mode - reload handled by AccountSettingsModal
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []); // Empty dependency - only runs once on mount

  // Search handler
  const handleSearch = useCallback(async (query) => {
    setIsSearching(true);
    setLoading(true);
    
    const searchToast = toast.loading('Searching...');
    
    try {
      const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=20&videoCategoryId=10&key=${apiKey}`
      );
      const data = await response.json();
      
      toast.dismiss(searchToast);
      
      if (data.items) {
        const formattedResults = data.items.map((item) => ({
          id: item.id.videoId,
          title: item.snippet.title,
          artistsText: item.snippet.channelTitle,
          thumbnailUrl: item.snippet.thumbnails.high.url,
          durationText: '',
        }));
        setSearchResults(formattedResults);
        toast.success(`Found ${formattedResults.length} results`);
      } else {
        toast.error('No results found');
      }
    } catch (error) {
      console.error('Error searching songs:', error);
      toast.dismiss(searchToast);
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleClearSearch = useCallback(() => {
    setIsSearching(false);
    setSearchResults([]);
  }, []);

  const handleViewPlaylists = useCallback(() => {
    setActiveTab('playlists');
    handleClearSearch();
    setCurrentSort('addedOn');
    setSortOrder('desc');
    setLocalSearchQuery('');
  }, [handleClearSearch]);

  const handleViewMostPlayed = useCallback(() => {
    setActiveTab('mostPlayed');
    handleClearSearch();
    setCurrentSort('addedOn');
    setSortOrder('desc');
    setLocalSearchQuery('');
  }, [handleClearSearch]);

  const handleViewFavorites = useCallback(() => {
    setActiveTab('favorites');
    handleClearSearch();
    setCurrentSort('addedOn');
    setSortOrder('desc');
    setLocalSearchQuery('');
  }, [handleClearSearch]);

  const handlePlaylistClick = useCallback((playlistId) => {
    fetchSongsForPlaylist(playlistId);
    setActivePlaylistId(playlistId);
    setLocalSearchQuery('');
  }, [fetchSongsForPlaylist]);

  const toggleFavorite = useCallback(() => {
    if (activeTab === 'favorites') {
      fetchFavorites();
    }
  }, [activeTab, fetchFavorites]);

  const handleSort = useCallback((sortValue) => {
    setCurrentSort(sortValue);
  }, []);

  const handleSortOrder = useCallback((order) => {
    setSortOrder(order);
  }, []);

  const handleLocalSearch = useCallback((query) => {
    setLocalSearchQuery(query);
  }, []);

  // Memoized sorted and filtered songs
  const displayedSongs = useMemo(() => {
    let result = isSearching 
      ? [...searchResults]
      : [...(activeTab === 'playlists' ? selectedPlaylistSongs : songs)];

    // Apply local search filter
    if (localSearchQuery.trim()) {
      const query = localSearchQuery.toLowerCase();
      result = result.filter(song => 
        song.title?.toLowerCase().includes(query) ||
        song.artistsText?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    switch (currentSort) {
      case 'title':
        result.sort((a, b) => {
          const titleA = (a.title || '').toLowerCase();
          const titleB = (b.title || '').toLowerCase();
          return sortOrder === 'asc' 
            ? titleA.localeCompare(titleB)
            : titleB.localeCompare(titleA);
        });
        break;
      case 'addedOn':
        result.sort((a, b) => {
          const timeA = a.likedAt || a.totalPlayTimeMs || 0;
          const timeB = b.likedAt || b.totalPlayTimeMs || 0;
          return sortOrder === 'asc' 
            ? timeA - timeB
            : timeB - timeA;
        });
        break;
      default:
        break;
    }

    return result;
  }, [isSearching, searchResults, activeTab, selectedPlaylistSongs, songs, localSearchQuery, currentSort, sortOrder]);

  // Memoized sort options
  const sortOptions = useMemo(() => [
    { label: 'Added On', value: 'addedOn' },
    { label: 'Title', value: 'title' },
  ], []);

  // Memoized active playlist name
  const activePlaylistName = useMemo(() => {
    return playlists.find((p) => p.id === activePlaylistId)?.name || 'Playlist';
  }, [playlists, activePlaylistId]);

  return (
    <PlayerProvider>
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3000,
        style: {
          background: '#1f2937',
          color: '#fff',
          border: '1px solid #374151',
          marginRight: '120px',
        },
        success: {
          iconTheme: {
            primary: '#10b981',
            secondary: '#fff',
          },
        },
        error: {
          iconTheme: {
            primary: '#ef4444',
            secondary: '#fff',
          },
        },
      }}
    />
      
      <div className="flex h-screen bg-gray-900 text-white overflow-hidden lg:-ml-3">
        <Header
          onSearch={handleSearch}
          onSidebarToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          sidebarOpen={isSidebarOpen}
        />
        
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onViewPlaylists={handleViewPlaylists}
          onViewMostPlayed={handleViewMostPlayed}
          onViewFavorites={handleViewFavorites}
          activeTab={activeTab}
        />

        <div className={`flex-1 flex flex-col overflow-hidden pt-16 transition-all duration-300 ${isSidebarOpen ? 'md:ml-56' : 'ml-0'}`}>
          <main className="flex-1 overflow-y-auto pb-32">
            <div className="px-4 md:px-6 py-4">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
                <div>
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                    {isSearching
                      ? 'Search Results'
                      : activeTab === 'mostPlayed'
                      ? 'Top 100 Most Played'
                      : activeTab === 'playlists'
                      ? `${activePlaylistName} Songs`
                      : 'Your Favorites'}
                  </h2>
                </div>
                
                <div className="flex items-center gap-3 w-full md:w-auto flex-1 md:flex-initial">
                  {!isSearching && (activeTab !== 'playlists' || selectedPlaylistSongs.length > 0) && (
                    <SortFilter
                      onSort={handleSort}
                      onSortOrder={handleSortOrder}
                      onSearch={handleLocalSearch}
                      sortOptions={sortOptions}
                    />
                  )}
                  
                  {isSearching && (
                    <button
                      onClick={handleClearSearch}
                      className="flex ml-auto items-center gap-2 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 rounded-xl transition-all duration-200 shadow-lg hover:shadow-red-500/25 border border-red-500/30 md:px-4 px-2"
                    >
                      <X size={18} className="text-white" />
                      <span className="font-medium text-white hidden md:inline">Clear Search</span>
                    </button>
                  )}
                </div>
              </div>

              {loading && (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader className="animate-spin text-green-400" size={48} />
                  <p className="mt-4 text-gray-400">Loading...</p>
                </div>
              )}

              {!loading && (
                <>
                  {isSearching || activeTab !== 'playlists' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {displayedSongs.map((song) => (
                        <SongCard
                          key={song.id}
                          song={song}
                          onToggleFavorite={toggleFavorite}
                          songs={displayedSongs}
                        />
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-hidden md:overflow-visible flex flex-nowrap gap-1 mb-8 md:grid md:grid-cols-2 md:gap-4 lg:grid-cols-5">
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
                        <div className="mt-8">
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {displayedSongs.map((song) => (
                              <SongCard
                                key={song.id}
                                song={song}
                                onToggleFavorite={toggleFavorite}
                                songs={displayedSongs}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {!loading && displayedSongs.length === 0 && !isSearching && (
                    <div className="text-center py-20">
                      <p className="text-gray-400 text-lg">
                        {localSearchQuery ? 'No songs match your search' : 'No songs found'}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </main>

          <Player />
        </div>
      </div>
    </PlayerProvider>
  );
};

export default App;