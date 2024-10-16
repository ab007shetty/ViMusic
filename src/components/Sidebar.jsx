import React, { useEffect } from 'react';

const Sidebar = ({ isOpen, onClose, onViewPlaylists, onViewMostPlayed, onViewFavorites, activeTab }) => {
  const handleFooterClick = () => {
    window.open('https://github.com/ab007shetty', '_blank');
  };

  // Auto close sidebar when clicking outside on small screens
  useEffect(() => {
    const handleClickOutside = (event) => {
      const sidebar = document.getElementById('sidebar');
      if (sidebar && !sidebar.contains(event.target) && isOpen) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleButtonClick = (viewAction) => {
    viewAction(); // Call the appropriate action
    onClose(); // Automatically close sidebar after action
  };

  return (
    <div 
      id="sidebar" 
      className={`fixed lg:static inset-y-0 left-0 transform ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } transition-transform duration-300 ease-in-out lg:transform-none w-60 bg-black text-white p-4 flex flex-col h-screen z-50`} 
    >
      <div className="flex items-center justify-between lg:justify-center lg:mb-8 mb-4">
        <h1 className="text-4xl font-bold text-center lg:text-center flex-grow lg:flex-grow-0">
          <span className="relative">
            <span className="text-blue-500 relative z-10">Vi</span>
            <span className="text-green-500 relative z-10">Music</span>
          </span>
        </h1>
        <button 
          className="lg:hidden text-white"
          onClick={onClose} // Close button for mobile screens
        >
          <span className="material-icons">close</span>
        </button>
      </div>
      <div className="flex flex-col">
        <button 
          className={`p-2 rounded w-full mb-2 transition-colors duration-300 ${
            activeTab === 'mostPlayed' ? 'bg-gray-700 text-white border-l-4 border-blue-500' : 'bg-gray-800 hover:bg-gray-700'
          }`}
          onClick={() => handleButtonClick(onViewMostPlayed)}
        >
          Most Played
        </button>
        <button 
          className={`p-2 rounded w-full mb-2 transition-colors duration-300 ${
            activeTab === 'playlists' ? 'bg-gray-700 text-white border-l-4 border-blue-500' : 'bg-gray-800 hover:bg-gray-700'
          }`}
          onClick={() => handleButtonClick(onViewPlaylists)}
        >
          My Playlists
        </button>
        <button 
          className={`p-2 rounded w-full transition-colors duration-300 ${
            activeTab === 'favorites' ? 'bg-gray-700 text-white border-l-4 border-blue-500' : 'bg-gray-800 hover:bg-gray-700'
          }`}
          onClick={() => handleButtonClick(onViewFavorites)}
        >
          Favorites
        </button>
      </div>
      <div 
        className="mt-auto flex justify-center items-center text-gray-400 cursor-pointer rounded bg-gray-500 p-2 text-white" 
        onClick={() => {
          handleFooterClick();
          onClose(); // Auto-close after clicking footer link
        }}
      >
        <p className="text-sm">
          Made with <span className="text-red-500">❤️</span> by abshetty
        </p>
      </div>
    </div>
  );
};

export default Sidebar;
