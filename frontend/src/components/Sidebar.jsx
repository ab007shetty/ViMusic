// components/Sidebar.jsx
import React from 'react';
import { Home, ListMusic, Heart } from 'lucide-react';

const Sidebar = ({ 
  isOpen, 
  onClose, 
  onViewPlaylists, 
  onViewMostPlayed, 
  onViewFavorites, 
  activeTab 
}) => {
  const menuItems = [
    { id: 'mostPlayed', label: 'Most Played', icon: Home, action: onViewMostPlayed },
    { id: 'playlists', label: 'Playlists', icon: ListMusic, action: onViewPlaylists },
    { id: 'favorites', label: 'Favorites', icon: Heart, action: onViewFavorites },
  ];

  const handleAction = (action) => {
    action?.();
    // Close sidebar on mobile after action
    if (window.innerWidth < 768) {
      onClose?.();
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar - Now closes on both mobile AND desktop */}
      <aside
        className={`
          fixed top-16 left-0 bottom-0 z-40 w-56
          bg-gradient-to-b from-gray-900 via-gray-950 to-black
          border-r border-gray-800 flex flex-col
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleAction(item.action)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                  isActive
                    ? 'bg-gradient-to-r from-green-500/20 to-blue-500/20 text-white border-l-4 border-green-500 shadow-lg shadow-green-500/10'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <Icon size={20} className={isActive ? 'text-green-400' : 'group-hover:text-white'} />
                <span className="ml-4 font-medium text-md">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800">
          <div className="text-center text-sm text-gray-400">
            Made with ❤️ by{' '}
            <a
              href="https://abshetty.in"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-cyan-400 hover:text-cyan-300 underline-offset-2 hover:underline transition"
            >
              abshetty
            </a>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;