import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PlayerProvider } from './contexts/PlayerContext';
import { usePlayer } from './contexts/PlayerContext';
import { PlaybackTimeProvider } from './contexts/PlaybackTimeContext';
import { fetchFromServer, setUserEmail, getUserEmail } from './utils/api';
import { fetchVideoMetadata } from './utils/youtubeUtils';
import { X, Plus } from 'lucide-react';
import { supabase } from './supabase';
import { switchToUserDatabase } from './utils/databaseUtils';
import toast, { Toaster } from 'react-hot-toast';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useSmoothScroll } from './hooks/useSmoothScroll';

import Header from './components/Header';
import Sidebar from './components/Sidebar';
import SongCard from './components/SongCard';
import Player from './components/Player';
import PlaylistCard from './components/PlaylistCard';
import SortFilter from './components/SortFilter';
import SkeletonGrid from './components/SkeletonGrid';
import { CreatePlaylistModal, EditPlaylistModal, DeletePlaylistModal } from './components/PlaylistModals';

gsap.registerPlugin(ScrollTrigger);

const AppInner = () => {
  const [songs, setSongs] = useState([]);
  const { playSong, setIsExpanded } = usePlayer();
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylistSongs, setSelectedPlaylistSongs] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [nextPageToken, setNextPageToken] = useState(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastSearchQuery, setLastSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    const email = getUserEmail();
    const savedTab = localStorage.getItem('activeTab');
    if (email) {
      return savedTab || 'favorites';
    }
    return (savedTab === 'favorites' || !savedTab) ? 'mostPlayed' : savedTab;
  });
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const mainScrollRef = useRef(null);
  const { scrollToTop } = useSmoothScroll(mainScrollRef);

  const [activePlaylistId, setActivePlaylistId] = useState(null);

  // Scroll back to the top on genuine navigation (switching tabs, a fresh
  // search, picking a different playlist) — otherwise the scroll container
  // keeps whatever position it was left at from the previous view. This
  // deliberately excludes "Load more" and silent background refreshes,
  // which shouldn't disturb where the user currently is.
  useEffect(() => {
    scrollToTop();
  }, [activeTab, isSearching, activePlaylistId, lastSearchQuery, scrollToTop]);

  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentSort, setCurrentSort] = useState('addedOn');
  const [sortOrder, setSortOrder] = useState('desc');
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  // Playlist modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);

  // Sidebar closed on mobile by default
  useEffect(() => {
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, []);

  // Persist active tab
  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  // Fetch functions with useCallback
  // Every fetch function below takes an optional `{ silent: true }` — used
  // for background syncs (realtime updates, post-mutation refreshes) so
  // they update data without swapping the whole grid out for the loading
  // skeleton first. A real tab switch (the default, silent omitted) still
  // shows the skeleton since there's genuinely nothing to show yet.
  const fetchSongs = useCallback(async (opts = {}) => {
    if (!opts.silent) setLoading(true);
    try {
      // Logged-in users get their own real Most Played (by totalPlayTimeMs).
      // Guests keep seeing the curated "Master's Mix" (site owner's
      // favorites), matching the README's documented guest experience.
      const email = getUserEmail();
      const data = email
        ? await fetchFromServer('songs')
        : await fetchFromServer('favorites', { headers: { 'X-User-Email': 'ab007shetty@gmail.com' } });
      if (activeTabRef.current === 'mostPlayed') {
        setSongs(data.songs || []);
      }
    } catch (error) {
      console.error('Error fetching Most Played:', error);
      toast.error('Failed to load Most Played');
    } finally {
      if (!opts.silent) setLoading(false);
    }
  }, []);

  const fetchRecentlyPlayed = useCallback(async (opts = {}) => {
    if (!opts.silent) setLoading(true);
    try {
      const data = await fetchFromServer('songs?orderBy=lastPlayedAt');
      if (activeTabRef.current === 'recentlyPlayed') {
        setSongs(data.songs || []);
      }
    } catch (error) {
      console.error('Error fetching Recently Played:', error);
      toast.error('Failed to load Recently Played');
    } finally {
      if (!opts.silent) setLoading(false);
    }
  }, []);

  const fetchFavorites = useCallback(async (opts = {}) => {
    if (!opts.silent) setLoading(true);
    try {
      const data = await fetchFromServer('favorites');
      if (activeTabRef.current === 'favorites') {
        setSongs(data.songs || []);
      }
    } catch (error) {
      console.error('Error fetching favorites:', error);
      toast.error('Failed to load favorites');
    } finally {
      if (!opts.silent) setLoading(false);
    }
  }, []);

  const fetchSongsForPlaylist = useCallback(async (playlistId, opts = {}) => {
    if (!opts.silent) setLoading(true);
    try {
      const email = getUserEmail();
      const headers = !email ? { 'X-User-Email': 'ab007shetty@gmail.com' } : {};
      const data = await fetchFromServer(`playlists/${playlistId}/songs`, { headers });
      setSelectedPlaylistSongs(data.songs || []);
    } catch (error) {
      console.error('Error fetching playlist songs:', error);
      toast.error('Failed to load playlist songs');
    } finally {
      if (!opts.silent) setLoading(false);
    }
  }, []);

  const fetchPlaylists = useCallback(async (opts = {}) => {
    if (!opts.silent) setLoading(true);
    try {
      const email = getUserEmail();
      const headers = !email ? { 'X-User-Email': 'ab007shetty@gmail.com' } : {};
      const data = await fetchFromServer('playlists', { headers });
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

      // Always auto-select the first playlist on initial load
      if (playlistsWithImages.length > 0 && !opts.skipAutoSelect) {
        setActivePlaylistId((current) => {
          const targetId = current || playlistsWithImages[0].id;
          fetchSongsForPlaylist(targetId, opts);
          return targetId;
        });
      }
    } catch (error) {
      console.error('Error fetching playlists:', error);
      toast.error('Failed to load playlists');
    } finally {
      if (!opts.silent) setLoading(false);
    }
  }, [fetchSongsForPlaylist]);

  // Playlist Management Functions
  const handleCreatePlaylist = async (playlistName) => {
    try {
      
      const response = await fetchFromServer('playlists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: playlistName }),
      });
      
      toast.success(`Playlist "${playlistName}" created!`);
      await fetchPlaylists({ silent: true }); // Refresh playlists without a loading flash
      
      return response;
    } catch (error) {
      console.error('Error creating playlist:', error);
      toast.error(error.message || 'Failed to create playlist');
      throw error;
    }
  };

  const handleEditPlaylist = async (playlistId, newName) => {
    try {
      await fetchFromServer(`playlists/${playlistId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: newName }),
      });
      
      toast.success('Playlist updated!');
      await fetchPlaylists({ silent: true }); // Refresh playlists without a loading flash
    } catch (error) {
      console.error('Error updating playlist:', error);
      toast.error('Failed to update playlist');
      throw error;
    }
  };

  const handleDeletePlaylist = async (playlistId) => {
    try {
      await fetchFromServer(`playlists/${playlistId}`, {
        method: 'DELETE',
      });
      
      toast.success('Playlist deleted!');

      // If deleted playlist was active, clear selection
      if (activePlaylistId === playlistId) {
        setActivePlaylistId(null);
        setSelectedPlaylistSongs([]);
      }

      await fetchPlaylists({ silent: true }); // Refresh playlists without a loading flash
    } catch (error) {
      console.error('Error deleting playlist:', error);
      toast.error('Failed to delete playlist');
      throw error;
    }
  };

  // Modal handlers
  const openEditModal = (playlist) => {
    setSelectedPlaylist(playlist);
    setShowEditModal(true);
  };

  const openDeleteModal = (playlist) => {
    setSelectedPlaylist(playlist);
    setShowDeleteModal(true);
  };

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

  // Initialize: Check for existing session and restore user email
  useEffect(() => {
    const initializeApp = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUser(session.user);
        setUserEmail(session.user.email);
        setActiveTab((curr) => (curr === 'mostPlayed' ? 'favorites' : curr));
      } else {
        setCurrentUser(null);
        setActiveTab((curr) => (curr === 'favorites' ? 'mostPlayed' : curr));
      }
    };

    initializeApp();
  }, []);

  // Handle auth state changes
  useEffect(() => {
    let isProcessingAuth = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user && !isProcessingAuth) {
        // Fix: If user is already signed in (e.g., from another tab or refresh), skip the reload process
        if (getUserEmail() === session.user.email) {
          return;
        }

        isProcessingAuth = true;
        const user = session.user;
        setCurrentUser(user);
        setUserEmail(user.email);
        
        const loadingToast = toast.loading('Setting up your account...');
        
        try {
          const result = await switchToUserDatabase(user);
          toast.dismiss(loadingToast);
          
          if (result.isNew) {
            toast.success('Welcome! Your account is ready.', { duration: 4000 });
            setTimeout(() => window.location.reload(), 1500);
          } else {
            setActiveTab('favorites');
            toast.success('Welcome back!');
            setTimeout(() => refreshCurrentView(), 500);
          }
        } catch (error) {
          console.error('❌ Failed to switch database:', error);
          toast.dismiss(loadingToast);
          toast.error(`Failed to load your data: ${error.message}`);
        } finally {
          isProcessingAuth = false;
        }
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setUserEmail(null);
        setActiveTab('mostPlayed');
      }
    });

    return () => subscription.unsubscribe();
  }, [refreshCurrentView]);

  // ── Supabase Realtime: keep data in sync instantly ─────────────────────
  // Guests have no favorites/playlists of their own to sync, and the RLS
  // policy only grants them the shared '' bucket anyway, so skip entirely
  // when logged out.
  useEffect(() => {
    if (!currentUser?.email) return;

    const scopedUserId = currentUser.email.toLowerCase().trim();
    const userFilter = `user_id=eq.${scopedUserId}`;

    // All of these pass { silent: true } — this is a background sync of
    // data the user is already looking at, not a navigation, so it should
    // never swap the grid out for the loading skeleton.
    const channel = supabase
      .channel(`db-changes-${scopedUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'song', filter: userFilter }, () => {
        // Refresh whichever tab is active
        if (activeTab === 'favorites') fetchFavorites({ silent: true });
        else if (activeTab === 'mostPlayed') fetchSongs({ silent: true });
        else if (activeTab === 'recentlyPlayed') fetchRecentlyPlayed({ silent: true });
        else if (activeTab === 'playlists' && activePlaylistId) fetchSongsForPlaylist(activePlaylistId, { silent: true });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'song_playlist_map', filter: userFilter }, () => {
        if (activeTab === 'playlists' && activePlaylistId) fetchSongsForPlaylist(activePlaylistId, { silent: true });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'playlist', filter: userFilter }, () => {
        fetchPlaylists({ skipAutoSelect: true, silent: true });
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [currentUser, activeTab, activePlaylistId, fetchFavorites, fetchSongs, fetchRecentlyPlayed, fetchSongsForPlaylist, fetchPlaylists]);

  // Search a song directly from a YouTube/YouTube Music URL (strip ID → fetch metadata → show as result)
  const handleUrlSearch = useCallback(async (videoId, source, isShort = false) => {
    setIsSearching(true);
    setLoading(true);
    setIsExpanded(false);
    // A pasted URL is a single-result "search" — clear any pagination state
    // left over from a prior keyword search so a stale "Load more" button
    // can't reappear and fetch more results for the wrong query.
    setNextPageToken(null);
    setLastSearchQuery('');
    const loadingToast = toast.loading('Fetching video details...');
    try {
      const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
      const song = await fetchVideoMetadata(videoId, apiKey, source, isShort);
      toast.dismiss(loadingToast);
      setSearchResults([song]);
    } catch (error) {
      console.error('Error loading video from URL:', error);
      toast.dismiss(loadingToast);
      toast.error('Could not load that video. Check the URL and try again.');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Search handler — searches all YouTube videos (not just music category)
  const handleSearch = useCallback(async (query) => {
    setIsSearching(true);
    setLoading(true);
    setIsExpanded(false);
    setLastSearchQuery(query);
    setNextPageToken(null);

    const searchToast = toast.loading('Searching...');

    try {
      const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=20&key=${apiKey}`
      );
      const data = await response.json();

      toast.dismiss(searchToast);

      if (data.items) {
        const formattedResults = data.items.map((item) => ({
          id: item.id.videoId,
          title: item.snippet.title,
          artistsText: item.snippet.channelTitle,
          channelId: item.snippet.channelId,
          // "medium" (320x180) instead of "high" (480x360) — grid cards
          // never render larger than ~224px tall, so the extra resolution
          // was pure wasted transfer weight across dozens of results.
          thumbnailUrl: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.high.url,
          durationText: '',
          source: 'youtube',
          isVideo: true,
        }));
        setSearchResults(formattedResults);
        setNextPageToken(data.nextPageToken || null);
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

  const handleLoadMoreResults = useCallback(async () => {
    if (!nextPageToken || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(lastSearchQuery)}&type=video&maxResults=20&pageToken=${nextPageToken}&key=${apiKey}`
      );
      const data = await response.json();

      if (data.items) {
        const formattedResults = data.items.map((item) => ({
          id: item.id.videoId,
          title: item.snippet.title,
          artistsText: item.snippet.channelTitle,
          channelId: item.snippet.channelId,
          // "medium" (320x180) instead of "high" (480x360) — grid cards
          // never render larger than ~224px tall, so the extra resolution
          // was pure wasted transfer weight across dozens of results.
          thumbnailUrl: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.high.url,
          durationText: '',
          source: 'youtube',
          isVideo: true,
        }));
        setSearchResults((prev) => {
          const seen = new Set(prev.map((s) => s.id));
          return [...prev, ...formattedResults.filter((s) => !seen.has(s.id))];
        });
        setNextPageToken(data.nextPageToken || null);
      }
    } catch (error) {
      console.error('Error loading more results:', error);
      toast.error('Failed to load more results');
    } finally {
      setIsLoadingMore(false);
    }
  }, [nextPageToken, isLoadingMore, lastSearchQuery]);

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
    setIsExpanded(false);
  }, [handleClearSearch]);

  const handleViewMostPlayed = useCallback(() => {
    setActiveTab('mostPlayed');
    handleClearSearch();
    setCurrentSort('addedOn');
    setSortOrder('desc');
    setLocalSearchQuery('');
    setIsExpanded(false);
  }, [handleClearSearch]);

  const handleViewRecentlyPlayed = useCallback(() => {
    setActiveTab('recentlyPlayed');
    handleClearSearch();
    setCurrentSort('addedOn');
    setSortOrder('desc');
    setLocalSearchQuery('');
    setIsExpanded(false);
    fetchRecentlyPlayed();
  }, [handleClearSearch, fetchRecentlyPlayed]);

  const handleViewFavorites = useCallback(() => {
    setActiveTab('favorites');
    handleClearSearch();
    setCurrentSort('addedOn');
    setSortOrder('desc');
    setLocalSearchQuery('');
    setIsExpanded(false);
  }, [handleClearSearch]);

  const handlePlaylistClick = useCallback((playlistId) => {
    fetchSongsForPlaylist(playlistId);
    setActivePlaylistId(playlistId);
    setLocalSearchQuery('');
  }, [fetchSongsForPlaylist]);

  // Only reachable from the Favorites tab as "un-favorite" — every song
  // visible there is already favorited, so there's nothing to add. Removing
  // it locally (instead of re-fetching the whole list) means no loading
  // flash: the card just disappears immediately.
  const toggleFavorite = useCallback((songId) => {
    if (activeTab === 'favorites') {
      setSongs((prev) => prev.filter((s) => s.id !== songId));
    }
  }, [activeTab]);

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

    if (localSearchQuery.trim()) {
      const query = localSearchQuery.toLowerCase();
      result = result.filter(song => 
        song.title?.toLowerCase().includes(query) ||
        song.artistsText?.toLowerCase().includes(query)
      );
    }

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

  const resultsGridRef = useRef(null);
  const prevDisplayedSongIdsRef = useRef([]);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const grid = resultsGridRef.current;
    if (!grid || prefersReducedMotion) return;

    const cards = Array.from(grid.children);
    if (!cards.length) return;

    // Only animate cards that are actually new. Without this, appending
    // ("Load more"), removing (un-favoriting, or a silent background sync
    // re-delivering the same list), or any other re-render of this same
    // list would re-trigger the fade-in on every already-visible card too
    // — the whole grid flashing to invisible and back, which looks exactly
    // like a page reload. Only a genuinely fresh view (new search, tab
    // switch, sort/filter change) should animate everything.
    const currentIds = displayedSongs.map((s) => s.id);
    const prevIds = prevDisplayedSongIdsRef.current;

    const isUnchanged =
      currentIds.length === prevIds.length &&
      currentIds.every((id, i) => id === prevIds[i]);

    const isAppend =
      !isUnchanged &&
      prevIds.length > 0 &&
      currentIds.length > prevIds.length &&
      prevIds.every((id, i) => currentIds[i] === id);

    const isRemoval =
      !isUnchanged &&
      prevIds.length > 0 &&
      currentIds.length < prevIds.length &&
      currentIds.every((id) => prevIds.includes(id));

    prevDisplayedSongIdsRef.current = currentIds;

    if (isUnchanged || isRemoval) return;

    const cardsToAnimate = isAppend ? cards.slice(prevIds.length) : cards;
    if (!cardsToAnimate.length) return;

    const tween = gsap.fromTo(
      cardsToAnimate,
      { opacity: 0, y: 24 },
      {
        opacity: 1,
        y: 0,
        duration: 0.5,
        ease: 'power2.out',
        stagger: { each: 0.04, from: 'start' },
        scrollTrigger: {
          scroller: mainScrollRef.current,
          trigger: grid,
          start: 'top bottom',
        },
      }
    );

    // Without this, switching tabs/loading more repeatedly piles up one
    // ScrollTrigger instance per run, all watching the same grid element.
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [displayedSongs]);

  const sortOptions = useMemo(() => [
    { label: 'Added On', value: 'addedOn' },
    { label: 'Title', value: 'title' },
  ], []);

  const activePlaylistName = useMemo(() => {
    return playlists.find((p) => p.id === activePlaylistId)?.name || 'Playlist';
  }, [playlists, activePlaylistId]);

  return (
    <>
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

      {/* Playlist Modals */}
      <CreatePlaylistModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreatePlaylist}
      />

      <EditPlaylistModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedPlaylist(null);
        }}
        playlist={selectedPlaylist}
        onUpdate={handleEditPlaylist}
      />

      <DeletePlaylistModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedPlaylist(null);
        }}
        playlist={selectedPlaylist}
        onConfirm={handleDeletePlaylist}
      />
      
      <div className="flex h-dvh bg-gray-900 text-white overflow-hidden">
        <Header
          onSearch={handleSearch}
          onUrlSearch={handleUrlSearch}
          onSidebarToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          sidebarOpen={isSidebarOpen}
        />
        
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onViewPlaylists={handleViewPlaylists}
          onViewMostPlayed={handleViewMostPlayed}
          onViewFavorites={handleViewFavorites}
          onViewRecentlyPlayed={handleViewRecentlyPlayed}
          activeTab={activeTab}
          isGuest={!currentUser}
        />

        <div className={`flex-1 flex flex-col relative overflow-hidden pt-16 transition-all duration-300 ${isSidebarOpen ? 'md:ml-56' : 'ml-0'}`}>
          <main ref={mainScrollRef} className="flex-1 overflow-y-auto pb-32">
            <div className="px-4 md:px-6 py-4">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent pb-1">
                    {isSearching
                      ? 'Search Results'
                      : activeTab === 'mostPlayed'
                      ? (currentUser ? 'Most Played' : "Master's Mix")
                      : activeTab === 'recentlyPlayed'
                      ? 'Recently Played'
                      : activeTab === 'playlists'
                      ? `${activePlaylistName} Songs`
                      : 'My Favorites'}
                  </h2>
                  
                  {/* Circular Plus Button - Only visible in playlist tab on desktop for logged-in users */}
                  {activeTab === 'playlists' && currentUser && (
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="hidden md:flex items-center justify-center w-10 h-10 bg-green-600 hover:bg-green-700 rounded-full transition-all duration-200 shadow-lg hover:scale-110 hover:shadow-green-500/30"
                      title="Create new playlist"
                    >
                      <Plus size={18} className="text-white" />
                    </button>
                  )}
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

              {loading && <SkeletonGrid count={10} />}

              {!loading && (
                <>
                  {isSearching || activeTab !== 'playlists' ? (
                    <>
                      <div ref={resultsGridRef} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {displayedSongs.map((song, index) => (
                          <SongCard
                            key={song.id}
                            song={song}
                            onToggleFavorite={toggleFavorite}
                            songs={displayedSongs}
                            priority={index < 6}
                          />
                        ))}
                      </div>
                      {isSearching && nextPageToken && (
                        <div className="flex justify-center mt-6">
                          <button
                            onClick={handleLoadMoreResults}
                            disabled={isLoadingMore}
                            className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-full text-white font-medium transition-colors border border-gray-700"
                          >
                            {isLoadingMore ? 'Loading…' : 'Load more results'}
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="overflow-x-auto md:overflow-visible flex flex-nowrap gap-1 mb-8 md:grid md:grid-cols-2 md:gap-4 lg:grid-cols-5">
                        {playlists.map((playlist) => (
                          <PlaylistCard
                            key={playlist.id}
                            playlist={playlist}
                            onClick={() => handlePlaylistClick(playlist.id)}
                            isActive={playlist.id === activePlaylistId}
                            onEdit={openEditModal}
                            onDelete={openDeleteModal}
                            isReadOnly={!currentUser}
                          />
                        ))}
                      </div>

                      {selectedPlaylistSongs.length > 0 && (
                        <div className="mt-8">
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {displayedSongs.map((song, index) => (
                              <SongCard
                                key={song.id}
                                song={song}
                                onToggleFavorite={toggleFavorite}
                                songs={displayedSongs}
                                priority={index < 6}
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
    </>
  );
};

const App = () => (
  <PlaybackTimeProvider>
    <PlayerProvider>
      <AppInner />
    </PlayerProvider>
  </PlaybackTimeProvider>
);

export default App;