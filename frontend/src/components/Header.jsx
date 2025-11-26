import React, { useState, useEffect } from 'react';
import { Search, Menu, X } from 'lucide-react';
import { supabase, signInWithGoogle, signOut as supabaseSignOut } from '../supabase';
import toast from 'react-hot-toast';
import { uploadEmptyDatabase } from '../utils/databaseUtils';
import AccountSettingsModal from './AccountSettingsModal';

const Header = ({ onSearch, onSidebarToggle, sidebarOpen }) => {
  const [query, setQuery] = useState('');
  const [user, setUser] = useState(null);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showSearchInput, setShowSearchInput] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSearch = () => {
    if (query.trim()) {
      onSearch?.(query);
      setShowSearchInput(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      // Note: The actual user session and database setup will be handled
      // by the onAuthStateChange listener in App.jsx
      toast.success('Signing in...');
    } catch (err) {
      toast.error('Sign in failed');
      console.error(err);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabaseSignOut();
      toast.success('Signed out successfully');
      setShowAccountMenu(false);
    } catch (err) {
      toast.error('Sign out failed');
    }
  };

  // Get user display info from user metadata
  const userDisplayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const userPhotoURL = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(userDisplayName)}&background=10b981&color=fff`;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-xl border-b border-gray-800 h-16">
      <div className="h-full px-4 flex items-center justify-between">

        {/* Left Side: Menu + Logo */}
        <div className="flex items-center gap-4">
          <button
            onClick={onSidebarToggle}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
            aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          <h1 className="text-3xl font-bold bg-gradient-to-r from-green-400 via-cyan-400 to-purple-500 bg-clip-text text-transparent tracking-tight">
            ViMusic
          </h1>
        </div>

        {/* Center: Desktop Search */}
        <div className="hidden md:flex flex-1 max-w-2xl mx-8">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Search any songs, artists, albums..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-800/70 border border-gray-700 rounded-full text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Right Side: Mobile Search + Auth */}
        <div className="flex items-center gap-3">

          {/* Mobile Search Icon */}
          <button
            onClick={() => setShowSearchInput(!showSearchInput)}
            className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
          >
            <Search className="w-6 h-6" />
          </button>

          {/* Auth: Google Sign In or Profile */}
          {!user ? (
            <button
              onClick={handleGoogleSignIn}
              className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-full font-medium hover:bg-gray-200 transition shadow-lg text-sm"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="hidden sm:inline">Sign in</span>
            </button>
          ) : (
            <div className="relative">
              <button
                onClick={() => setShowAccountMenu(!showAccountMenu)}
                className="flex items-center justify-center w-10 h-10 hover:bg-gray-800 rounded-full transition-all"
              >
                <img
                  src={userPhotoURL}
                  alt={userDisplayName}
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-green-500"
                />
              </button>

              {showAccountMenu && (
                <AccountSettingsModal
                  showModal={showAccountMenu}
                  onClose={() => setShowAccountMenu(false)}
                  handleSignOut={handleSignOut}
                  user={user}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Full-Width Search Dropdown */}
      {showSearchInput && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-gray-900/95 backdrop-blur-xl border-b border-gray-800 p-4 shadow-2xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Search songs, artists, albums..."
              autoFocus
              className="w-full pl-10 pr-4 py-3 bg-gray-800/70 border border-gray-700 rounded-full text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;