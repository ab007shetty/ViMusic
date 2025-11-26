// components/SortFilter.jsx
import React, { useState, useRef, useEffect } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Search } from 'lucide-react';

const SortFilter = ({ onSort, onSortOrder, onSearch, sortOptions }) => {
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [selectedSort, setSelectedSort] = useState(sortOptions[0]); // Default to first option (Added On)
  const [sortOrder, setSortOrder] = useState('desc'); // Default to descending
  const [searchQuery, setSearchQuery] = useState('');
  
  const sortRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sortRef.current && !sortRef.current.contains(event.target)) {
        setShowSortMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSortSelect = (option) => {
    setSelectedSort(option);
    onSort(option.value);
    setShowSortMenu(false);
  };

  const toggleSortOrder = () => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(newOrder);
    onSortOrder(newOrder);
  };

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch(query);
  };

  return (
    <div className="flex items-center gap-3 w-full ">
      {/* Search Input - First */}
      <div className="relative flex-1 md:flex-initial">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Search your songs..."
          className="pl-10 pr-4 py-2 w-full md:w-64 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
        />
      </div>

      {/* Sort Dropdown - Second */}
      <div className="relative flex-shrink-0" ref={sortRef}>
        <button
          onClick={() => setShowSortMenu(!showSortMenu)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl transition-all border border-gray-700 hover:border-gray-600"
        >
          <ArrowUpDown size={18} className="text-gray-400" />
          <span className="text-sm font-medium text-white ">{selectedSort.label}</span>
        </button>

        {showSortMenu && (
          <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-xl shadow-2xl border border-gray-700 p-2 z-50">
            {sortOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleSortSelect(option)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                  selectedSort.value === option.value
                    ? 'bg-green-500/20 text-green-400 font-medium'
                    : 'text-white hover:bg-gray-700'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sort Order Toggle - Third */}
      <button
        onClick={toggleSortOrder}
        className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl transition-all border border-gray-700 hover:border-gray-600 flex-shrink-0"
        title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
      >
        {sortOrder === 'asc' ? (
          <ArrowUp size={18} className="text-green-400" />
        ) : (
          <ArrowDown size={18} className="text-green-400" />
        )}
      </button>
    </div>
  );
};

export default SortFilter;