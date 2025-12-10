import React, { useState, useEffect, useRef } from 'react';
import { handleDatabaseImport, getDatabaseDownloadUrl, syncDatabaseToCloud } from '../utils/databaseUtils';
import { setUserEmail } from '../utils/api';

const AccountSettingsModal = ({ showModal, onClose, handleSignOut, user }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const modalRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (showModal) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose, showModal]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.name.endsWith('.db')) {
        alert('Please select a valid .db file');
        e.target.value = '';
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      alert('Please select a database file first');
      return;
    }

    if (!user?.email) {
      alert('User not authenticated');
      return;
    }

    const confirmed = window.confirm(
      '⚠️ Importing will replace your current database. This action cannot be undone. Continue?'
    );

    if (!confirmed) {
      return;
    }

    setIsUploading(true);
    try {
      const result = await handleDatabaseImport(user.email, selectedFile);
      
      alert('✅ Database imported successfully! The page will now refresh.');
      setSelectedFile(null);
      
      // Force reload to load new database
      if (result.requiresRefresh) {
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (error) {
      console.error('Error during import:', error);
      alert(`❌ Import failed: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleExport = async () => {
    if (!user?.email) {
      alert('User not authenticated');
      return;
    }

    setIsExporting(true);
    try {
      // Get signed download URL from Supabase
      const url = await getDatabaseDownloadUrl(user.email);
      
      // Download the file
      const a = document.createElement('a');
      a.href = url;
      a.download = `vimusic-${user.email}-${Date.now()}.db`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      console.log('✅ Database exported successfully');
    } catch (error) {
      console.error('Error exporting database:', error);
      alert(`❌ Export failed: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSignOutClick = async () => {
    if (!user?.email) {
      console.log('No user is signed in.');
      return;
    }

    const confirmed = window.confirm('Are you sure you want to sign out?');
    if (!confirmed) return;

    setIsSigningOut(true);
    try {
      // Sync database to cloud before signing out
      await syncDatabaseToCloud(user.email);
      console.log('✅ Database synced to cloud');
      
      // CRITICAL: Clear user email from API service
      setUserEmail(null);
      
      // Sign out from Supabase
      await handleSignOut();
      console.log('✅ Signed out successfully');
      
      // Reload to switch to guest mode
      setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      console.error('❌ Error during sign out:', error);
      alert(`❌ Sign out error: ${error.message}`);
      setIsSigningOut(false);
    }
  };

  if (!showModal) return null;

  return (
    <div 
      ref={modalRef}
      className="absolute top-14 right-0 w-80 bg-gray-800 text-white border border-gray-700 rounded-lg shadow-2xl z-50 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-settings-title"
    >
      {/* User Info Section */}
      <div className="p-4 border-b border-gray-700 bg-gradient-to-br from-gray-800 to-gray-900">
        <div className="flex items-center gap-3">
          <img 
            src={user.user_metadata?.avatar_url || user.user_metadata?.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email)}&background=10b981&color=fff`} 
            alt={user.user_metadata?.full_name || user.email}
            className="w-12 h-12 rounded-full ring-2 ring-green-500 object-cover"
          />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white truncate" id="account-settings-title">
              {user.user_metadata?.full_name || user.email.split('@')[0]}
            </p>
            <p className="text-sm text-gray-400 truncate">{user.email}</p>
          </div>
        </div>
      </div>

      {/* Database Actions */}
      <div className="p-4 space-y-3">
        <h4 className="font-semibold text-sm text-gray-300 uppercase tracking-wide mb-3">
          Database Management
        </h4>
        
        {/* Import Database */}
        <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700">
          <label htmlFor="db-import" className="block text-sm font-medium text-gray-300 mb-2">
            Import Database
          </label>
          <input 
            id="db-import"
            type="file" 
            accept=".db"
            onChange={handleFileChange}
            disabled={isUploading}
            className="block w-full text-sm text-gray-400 
              file:mr-3 file:py-2 file:px-4 
              file:rounded-lg file:border-0
              file:text-sm file:font-medium
              file:bg-green-500 file:text-white
              hover:file:bg-green-600
              file:cursor-pointer
              cursor-pointer
              disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Select database file to import"
          />
          {selectedFile && (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-gray-400 truncate">
                📁 {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </p>
              <button 
                onClick={handleImport}
                disabled={isUploading}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                aria-label="Upload and import selected database"
              >
                {isUploading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span>Upload & Import</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Export Database */}
        <button 
          onClick={handleExport}
          disabled={isExporting}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-medium py-2.5 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Export database"
        >
          {isExporting ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Exporting...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Export Database</span>
            </>
          )}
        </button>

        {/* Sign Out */}
        <button 
          onClick={handleSignOutClick}
          disabled={isSigningOut}
          className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-medium py-2.5 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Sign out"
        >
          {isSigningOut ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Signing out...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Sign Out</span>
            </>
          )}
        </button>
      </div>

      {/* Info Footer */}
      <div className="px-4 py-3 bg-gray-900/30 border-t border-gray-700">
        <p className="text-xs text-gray-500 text-center">
          💡 Your data is securely synced to the cloud
        </p>
      </div>
    </div>
  );
};

export default AccountSettingsModal;