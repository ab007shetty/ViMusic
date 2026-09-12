import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PlayerProvider } from './contexts/PlayerContext';
import { usePlayer } from './contexts/PlayerContext';
import { PlaybackTimeProvider } from './contexts/PlaybackTimeContext';
import { fetchFromServer, setUserEmail, getUserEmail } from './utils/api';
import { fetchVideoMetadata, fetchDurations } from './utils/youtubeUtils';
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

  // Read inside the realtime channel callback below so a silent background
  // refresh re-requests exactly as many songs as are currently on screen
  // instead of collapsing a "Load more"-expanded list back down to one page.
  const songsRef = useRef([]);
  songsRef.current = songs;
  const selectedPlaylistSongsRef = useRef([]);
  selectedPlaylistSongsRef.current = selectedPlaylistSongs;
  const activePlaylistIdRef = useRef(null);

  const mainScrollRef = useRef(null);
  const { scrollToTop } = useSmoothScroll(mainScrollRef);

  const [activePlaylistId, setActivePlaylistId] = useState(null);
  activePlaylistIdRef.current = activePlaylistId;

  // Scroll back to the top on genuine navigation (switching tabs, a fresh
  // search, picking a different playlist) — otherwise the scroll container
  // keeps whatever position it was left at from the previous view. This
  // deliberately excludes "Load more" and silent background refreshes,
  // which shouldn't disturb where the user currently is.
  useEffect(() => {
    scrollToTop();
  }, [activeTab, isSearching, activePlaylistId, lastSearchQuery, scrollToTop]);

  // Reveal-on-scroll-up for the playlist row: once you're deep in a long
  // playlist, switching to another one shouldn't mean scrolling all the way
  // back to the top. It slides away while reading downward and comes back
  // as soon as you scroll up. Desktop only — the mobile row is a horizontal
  // strip that would eat too much of a small screen.
  const [playlistBarHidden, setPlaylistBarHidden] = useState(false);
  const lastScrollTopRef = useRef(0);

  useEffect(() => {
    const el = mainScrollRef.current;
    if (!el) return;

    const onScroll = () => {
      const y = el.scrollTop;
      const prev = lastScrollTopRef.current;

      // Near the top the row is in its natural place, so never hide it there.
      if (y < 120) setPlaylistBarHidden(false);
      else if (y > prev + 4) setPlaylistBarHidden(true);
      else if (y < prev - 4) setPlaylistBarHidden(false);

      lastScrollTopRef.current = y;
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

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
  // Every library list is paged 20 at a time instead of fetched whole —
  // loadMoreLibrary() below fetches subsequent pages with { append: true }.
  const LIBRARY_PAGE_SIZE = 20;
  const [hasMoreSongs, setHasMoreSongs] = useState(false);
  const [isLoadingMoreSongs, setIsLoadingMoreSongs] = useState(false);

  const fetchSongs = useCallback(async (opts = {}) => {
    if (!opts.silent && !opts.append) setLoading(true);
    try {
      // Logged-in users get their own real Most Played (by totalPlayTimeMs).
      // Guests keep seeing the curated "Master's Mix" (site owner's
      // favorites), matching the README's documented guest experience.
      const email = getUserEmail();
      const offset = opts.append ? opts.offset || 0 : 0;
      const pageParams = `limit=${opts.limit || LIBRARY_PAGE_SIZE}&offset=${offset}`;
      const data = email
        ? await fetchFromServer(`songs?${pageParams}`)
        : await fetchFromServer(`favorites?${pageParams}`, { headers: { 'X-User-Email': 'ab007shetty@gmail.com' } });
      if (activeTabRef.current === 'mostPlayed') {
        setSongs((prev) => (opts.append ? [...prev, ...(data.songs || [])] : (data.songs || [])));
        setHasMoreSongs(!!data.hasMore);
      }
    } catch (error) {
      console.error('Error fetching Most Played:', error);
      toast.error('Failed to load Most Played');
    } finally {
      if (!opts.silent && !opts.append) setLoading(false);
    }
  }, []);

  const fetchRecentlyPlayed = useCallback(async (opts = {}) => {
    if (!opts.silent && !opts.append) setLoading(true);
    try {
      const offset = opts.append ? opts.offset || 0 : 0;
      const data = await fetchFromServer(`songs?orderBy=lastPlayedAt&limit=${opts.limit || LIBRARY_PAGE_SIZE}&offset=${offset}`);
      if (activeTabRef.current === 'recentlyPlayed') {
        setSongs((prev) => (opts.append ? [...prev, ...(data.songs || [])] : (data.songs || [])));
        setHasMoreSongs(!!data.hasMore);
      }
    } catch (error) {
      console.error('Error fetching Recently Played:', error);
      toast.error('Failed to load Recently Played');
    } finally {
      if (!opts.silent && !opts.append) setLoading(false);
    }
  }, []);

  const fetchFavorites = useCallback(async (opts = {}) => {
    if (!opts.silent && !opts.append) setLoading(true);
    try {
      const offset = opts.append ? opts.offset || 0 : 0;
      const data = await fetchFromServer(`favorites?limit=${opts.limit || LIBRARY_PAGE_SIZE}&offset=${offset}`);
      if (activeTabRef.current === 'favorites') {
        setSongs((prev) => (opts.append ? [...prev, ...(data.songs || [])] : (data.songs || [])));
        setHasMoreSongs(!!data.hasMore);
      }
    } catch (error) {
      console.error('Error fetching favorites:', error);
      toast.error('Failed to load favorites');
    } finally {
      if (!opts.silent && !opts.append) setLoading(false);
    }
  }, []);

  // Every song id the user has favorited. Library rows carry likedAt and
  // could answer this themselves, but YouTube search results don't — without
  // this set, a song already in Favorites shows an empty heart when it turns
  // up in search.
  const [favoriteIds, setFavoriteIds] = useState(() => new Set());

  const fetchFavoriteIds = useCallback(async () => {
    if (!getUserEmail()) {
      setFavoriteIds(new Set());
      return;
    }
    try {
      const data = await fetchFromServer('favorites?idsOnly=1');
      setFavoriteIds(new Set(data.ids || []));
    } catch (error) {
      console.error('Error fetching favorite ids:', error);
    }
  }, []);

  const [searchHistory, setSearchHistory] = useState([]);

  // Guests have no personal history to sync (matches the realtime effect's
  // guest skip below), so this is only ever called for a signed-in user.
  const fetchSearchHistory = useCallback(async () => {
    try {
      const data = await fetchFromServer('search-history');
      setSearchHistory(data.history || []);
    } catch (error) {
      console.error('Error fetching search history:', error);
    }
  }, []);

  const fetchSongsForPlaylist = useCallback(async (playlistId, opts = {}) => {
    if (!opts.silent && !opts.append) setLoading(true);
    try {
      const email = getUserEmail();
      const headers = !email ? { 'X-User-Email': 'ab007shetty@gmail.com' } : {};
      const offset = opts.append ? opts.offset || 0 : 0;
      const data = await fetchFromServer(`playlists/${playlistId}/songs?limit=${opts.limit || LIBRARY_PAGE_SIZE}&offset=${offset}`, { headers });
      setSelectedPlaylistSongs((prev) => (opts.append ? [...prev, ...(data.songs || [])] : (data.songs || [])));
      setHasMoreSongs(!!data.hasMore);
    } catch (error) {
      console.error('Error fetching playlist songs:', error);
      toast.error('Failed to load playlist songs');
    } finally {
      if (!opts.silent && !opts.append) setLoading(false);
    }
  }, []);

  const fetchPlaylists = useCallback(async (opts = {}) => {
    if (!opts.silent) setLoading(true);
    try {
      const email = getUserEmail();
      const headers = !email ? { 'X-User-Email': 'ab007shetty@gmail.com' } : {};
      const data = await fetchFromServer('playlists', { headers });

      // coverUrl is either the cover explicitly picked for the playlist or,
      // failing that, the first song's artwork (filled in by the backend).
      // No stock-image fallback — PlaylistCard draws its own tile when a
      // playlist genuinely has no artwork to show yet.
      // Playlists are always listed alphabetically. The sort/order controls
      // on this screen apply to the songs inside the selected playlist, not
      // to the playlist row itself — otherwise the row would reshuffle
      // underneath you every time you re-sorted the songs.
      const playlistsWithImages = (data.playlists || [])
        .map((playlist) => ({
          ...playlist,
          thumbnailUrl: playlist.coverUrl || '',
        }))
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));

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

  // Refetches whatever is currently on screen, without the loading skeleton.
  // Reads the active view from refs rather than props/state so it stays
  // referentially stable — the realtime channel below depends on it, and a
  // changing identity there would tear the subscription down and rebuild it
  // on every tab switch.
  const lastResyncRef = useRef(0);

  const resyncCurrentView = useCallback(() => {
    // focus/visibilitychange/online routinely fire together when a tab comes
    // back, and a re-subscribe can land in the same instant. Collapse those
    // into one refetch.
    const now = Date.now();
    if (now - lastResyncRef.current < 1500) return;
    lastResyncRef.current = now;

    const tab = activeTabRef.current;
    const keepLimit = Math.max(songsRef.current.length, LIBRARY_PAGE_SIZE);

    if (tab === 'favorites') fetchFavorites({ silent: true, limit: keepLimit });
    else if (tab === 'mostPlayed') fetchSongs({ silent: true, limit: keepLimit });
    else if (tab === 'recentlyPlayed') fetchRecentlyPlayed({ silent: true, limit: keepLimit });
    else if (tab === 'playlists') {
      fetchPlaylists({ skipAutoSelect: true, silent: true });
      if (activePlaylistIdRef.current) {
        fetchSongsForPlaylist(activePlaylistIdRef.current, {
          silent: true,
          limit: Math.max(selectedPlaylistSongsRef.current.length, LIBRARY_PAGE_SIZE),
        });
      }
    }

    fetchFavoriteIds();
    fetchSearchHistory();
  }, [fetchFavorites, fetchSongs, fetchRecentlyPlayed, fetchPlaylists, fetchSongsForPlaylist, fetchFavoriteIds, fetchSearchHistory]);

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

  const handleSetPlaylistCover = async (playlistId, coverUrl) => {
    try {
      await fetchFromServer(`playlists/${playlistId}`, {
        method: 'PUT',
        body: JSON.stringify({ coverUrl }),
      });
      toast.success('Playlist cover updated!');
      await fetchPlaylists({ silent: true, skipAutoSelect: true });
    } catch (error) {
      console.error('Error setting playlist cover:', error);
      toast.error('Failed to set playlist cover');
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
  //
  // Subscribed once per signed-in user and then left alone. This used to
  // depend on activeTab and activePlaylistId as well, so every navigation
  // tore the websocket down and built a new one -- and anything the phone
  // changed during that round trip arrived at a channel that no longer
  // existed and was simply lost. That is the whole story behind favourites
  // showing up here "sometimes". What the handlers need to know about the
  // current view is read from refs, which are assigned on every render and
  // are therefore always current without being dependencies.
  useEffect(() => {
    const email = currentUser?.email;
    if (!email) return;

    const scopedUserId = email.toLowerCase().trim();
    const userFilter = `user_id=eq.${scopedUserId}`;

    // All of these pass { silent: true } — this is a background sync of
    // data the user is already looking at, not a navigation, so it should
    // never swap the grid out for the loading skeleton.
    const refreshVisibleSongs = () => {
      const tab = activeTabRef.current;
      const playlistId = activePlaylistIdRef.current;
      // Re-request as many songs as are already on screen (at least one
      // page) so a background sync can't collapse a "Load more"-expanded
      // list back down to the first page.
      const keepLimit = Math.max(songsRef.current.length, LIBRARY_PAGE_SIZE);

      if (tab === 'favorites') fetchFavorites({ silent: true, limit: keepLimit });
      else if (tab === 'mostPlayed') fetchSongs({ silent: true, limit: keepLimit });
      else if (tab === 'recentlyPlayed') fetchRecentlyPlayed({ silent: true, limit: keepLimit });
      else if (tab === 'playlists' && playlistId) {
        fetchSongsForPlaylist(playlistId, {
          silent: true,
          limit: Math.max(selectedPlaylistSongsRef.current.length, LIBRARY_PAGE_SIZE),
        });
      }
      // A favorite toggled on the phone has to re-colour the heart on any
      // search results currently on screen here too.
      fetchFavoriteIds();
    };

    const channel = supabase
      .channel(`db-changes-${scopedUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'song', filter: userFilter }, refreshVisibleSongs)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'song_playlist_map', filter: userFilter }, () => {
        const playlistId = activePlaylistIdRef.current;
        if (playlistId) {
          fetchSongsForPlaylist(playlistId, {
            silent: true,
            limit: Math.max(selectedPlaylistSongsRef.current.length, LIBRARY_PAGE_SIZE),
          });
        }
        // The grid shows a song count per playlist, and adding a track from
        // the phone changes it whether or not that playlist happens to be
        // open here. Without this the count only caught up on a refresh.
        fetchPlaylists({ skipAutoSelect: true, silent: true });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'playlist', filter: userFilter }, () => {
        fetchPlaylists({ skipAutoSelect: true, silent: true });
      })
      // Keeps search history in sync both ways: a query typed on the phone
      // (or another browser tab) shows up here instantly, and vice versa.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'search_history', filter: userFilter }, () => {
        fetchSearchHistory();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [currentUser?.email, fetchFavorites, fetchSongs, fetchRecentlyPlayed, fetchSongsForPlaylist, fetchPlaylists, fetchSearchHistory, fetchFavoriteIds]);

  // Load search history once a user is known — guests get none (see
  // fetchSearchHistory), and realtime keeps it fresh after this.
  useEffect(() => {
    if (currentUser?.email) {
      fetchSearchHistory();
    } else {
      setSearchHistory([]);
    }
    fetchFavoriteIds();
  }, [currentUser, fetchSearchHistory, fetchFavoriteIds]);

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
          // Store the best the API offers; thumbnailFor() picks the right
          // size per surface at render time.
          thumbnailUrl: item.snippet.thumbnails.maxres?.url || item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url,
          durationText: '',
          source: 'youtube',
          isVideo: true,
        }));

        // /search never returns duration, so fill it in before showing the
        // results — otherwise favoriting one saves an empty durationText.
        const durations = await fetchDurations(formattedResults.map((s) => s.id), apiKey);
        formattedResults.forEach((song) => {
          song.durationText = durations[song.id] || '';
        });

        setSearchResults(formattedResults);
        setNextPageToken(data.nextPageToken || null);
        toast.success(`Found ${formattedResults.length} results`);

        if (getUserEmail()) {
          // Optimistic local update so it shows immediately; realtime
          // (and the Android app) will reconcile it across devices.
          setSearchHistory((prev) => [
            { query, timestamp: Date.now() },
            ...prev.filter((h) => h.query !== query),
          ].slice(0, 15));
          fetchFromServer('search-history', {
            method: 'POST',
            body: JSON.stringify({ query }),
          }).catch((err) => console.error('Error saving search history:', err));
        }
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
          // Store the best the API offers; thumbnailFor() picks the right
          // size per surface at render time.
          thumbnailUrl: item.snippet.thumbnails.maxres?.url || item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url,
          durationText: '',
          source: 'youtube',
          isVideo: true,
        }));

        const durations = await fetchDurations(formattedResults.map((s) => s.id), apiKey);
        formattedResults.forEach((song) => {
          song.durationText = durations[song.id] || '';
        });

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

  // Loads the next page for whichever list is on screen (Most Played,
  // Favorites, Recently Played, or a playlist) — separate from
  // handleLoadMoreResults above, which pages YouTube search results.
  const handleLoadMoreLibrary = useCallback(async () => {
    if (!hasMoreSongs || isLoadingMoreSongs) return;
    setIsLoadingMoreSongs(true);
    try {
      if (activeTab === 'mostPlayed') {
        await fetchSongs({ append: true, offset: songs.length });
      } else if (activeTab === 'favorites') {
        await fetchFavorites({ append: true, offset: songs.length });
      } else if (activeTab === 'recentlyPlayed') {
        await fetchRecentlyPlayed({ append: true, offset: songs.length });
      } else if (activeTab === 'playlists' && activePlaylistId) {
        await fetchSongsForPlaylist(activePlaylistId, { append: true, offset: selectedPlaylistSongs.length });
      }
    } finally {
      setIsLoadingMoreSongs(false);
    }
  }, [activeTab, activePlaylistId, songs.length, selectedPlaylistSongs.length, hasMoreSongs, isLoadingMoreSongs, fetchSongs, fetchFavorites, fetchRecentlyPlayed, fetchSongsForPlaylist]);

  // ── Infinite scroll ───────────────────────────────────────────────────
  // A sentinel div sits under the grid; when it scrolls into view the next
  // page loads on its own. Kept in a ref (rather than the observer's deps)
  // so the observer is created once per sentinel mount but always runs
  // against current state — recreating it on every state change would make
  // it re-fire its initial callback and request pages in a loop.
  const autoLoadRef = useRef(() => {});
  autoLoadRef.current = () => {
    if (isSearching) {
      if (nextPageToken && !isLoadingMore) handleLoadMoreResults();
    } else if (hasMoreSongs && !isLoadingMoreSongs) {
      handleLoadMoreLibrary();
    }
  };

  // Callback ref instead of a plain ref: the sentinel mounts and unmounts
  // as the view switches, and this re-runs the effect each time it does.
  const [loadMoreSentinel, setLoadMoreSentinel] = useState(null);

  useEffect(() => {
    const root = mainScrollRef.current;
    if (!loadMoreSentinel || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) autoLoadRef.current();
      },
      // Start fetching a bit before the sentinel is actually visible so the
      // next page is usually there by the time the user reaches the end.
      { root, rootMargin: '400px' }
    );
    observer.observe(loadMoreSentinel);
    return () => observer.disconnect();
  }, [loadMoreSentinel]);

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
    // Keep the heart correct on any other view showing this same song —
    // notably search results, which have no likedAt of their own.
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(songId)) next.delete(songId);
      else next.add(songId);
      return next;
    });
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
        // Each view already arrives newest-first from the server, by the key
        // that actually means "added" for that view: likedAt for favorites,
        // position for a playlist, lastPlayedAt / totalPlayTimeMs for the
        // history tabs. Re-sorting here by likedAt got playlists badly wrong
        // — a song's like time has nothing to do with when it was added to
        // a playlist, so favorited songs jumped to the top and songs with
        // neither a like nor any play time fell to the bottom at 0. It also
        // silently re-ordered Most Played and Recently Played away from the
        // ranking the server had just computed. Descending is the server's
        // own order; ascending just reverses it.
        if (sortOrder === 'asc') result.reverse();
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

    // Only animate cards whose song wasn't already visible a moment ago —
    // by id, not by position. A position-based "did it just get appended
    // at the end" check (the old approach) misses a realtime sync that
    // prepends a new favorite/most-played song at the *front* (both are
    // sorted newest-first), falls through to "treat as a full replacement",
    // and replays the fade-in on every already-visible card — the whole
    // grid flashing to invisible and back, which looks exactly like a
    // reload even with the loading skeleton already suppressed. Diffing by
    // id handles a prepend, an append ("Load more"), a removal, or any
    // combination correctly, and animates only the cards that are actually
    // new. A genuinely fresh view (new search, tab switch) has zero
    // overlap with the previous ids, so every card counts as new there.
    const currentIds = displayedSongs.map((s) => s.id);
    const prevIds = prevDisplayedSongIdsRef.current;
    const prevIdSet = new Set(prevIds);

    const isUnchanged =
      currentIds.length === prevIds.length &&
      currentIds.every((id, i) => id === prevIds[i]);

    prevDisplayedSongIdsRef.current = currentIds;

    if (isUnchanged) return;

    const newIdSet = new Set(currentIds.filter((id) => !prevIdSet.has(id)));
    if (newIdSet.size === 0) return; // pure removal or reorder — nothing new to animate

    const cardsToAnimate = cards.filter((_, i) => newIdSet.has(currentIds[i]));
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

  const handleRemoveHistoryItem = useCallback(async (query) => {
    setSearchHistory((prev) => prev.filter((h) => h.query !== query));
    try {
      await fetchFromServer(`search-history?query=${encodeURIComponent(query)}`, { method: 'DELETE' });
    } catch (error) {
      console.error('Error removing search history item:', error);
    }
  }, []);

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
          searchHistory={searchHistory}
          onRemoveHistoryItem={handleRemoveHistoryItem}
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
                            isFavorite={favoriteIds.has(song.id) || song.likedAt != null}
                          />
                        ))}
                      </div>
                      {(isSearching ? nextPageToken : hasMoreSongs) && (
                        <div ref={setLoadMoreSentinel} className="flex justify-center py-6">
                          {(isSearching ? isLoadingMore : isLoadingMoreSongs) && (
                            <span className="text-sm text-gray-500">Loading…</span>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div
                        className={`overflow-x-auto md:overflow-visible flex flex-nowrap gap-1 mb-8 md:grid md:grid-cols-2 md:gap-4 lg:grid-cols-5
                          md:sticky md:top-0 md:z-20 md:bg-gray-900/95 md:backdrop-blur-xl md:py-3 md:transition-transform md:duration-300 md:ease-out
                          ${playlistBarHidden ? 'md:-translate-y-[calc(100%+2rem)]' : 'md:translate-y-0'}`}
                      >
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
                                isFavorite={favoriteIds.has(song.id) || song.likedAt != null}
                                onSetAsCover={currentUser ? () => handleSetPlaylistCover(activePlaylistId, song.thumbnailUrl) : undefined}
                              />
                            ))}
                          </div>
                          {hasMoreSongs && (
                            <div ref={setLoadMoreSentinel} className="flex justify-center py-6">
                              {isLoadingMoreSongs && <span className="text-sm text-gray-500">Loading…</span>}
                            </div>
                          )}
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