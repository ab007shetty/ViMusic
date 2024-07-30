import React, { useState } from 'react';

const Header = ({ onSearch, onClearSearch, onSidebarToggle }) => {
  const [query, setQuery] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    onSearch(query);
  };

  return (
    <header className="p-4 flex items-center bg-gray-800 text-white bg-gradient-to-r from-emerald-400 to-indigo-600 rounded">
      <button
        onClick={onSidebarToggle}
        className="block lg:hidden text-white bg-gray-700 p-2 rounded-md mr-4"
        aria-label="Toggle Sidebar"
      >
        <span className="material-icons">menu</span>
      </button>
      <form className="relative flex-1" onSubmit={handleSearch}>
        <label htmlFor="default-search" className="sr-only">Search</label>
        <div className="relative">
          <input 
            type="search" 
            id="default-search" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full p-4 pl-10 text-sm text-gray-900 border border-gray-300 rounded-lg bg-gray-50 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
            placeholder="Search by Song, Album, Artist..." 
            required 
          />
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
              <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/>
            </svg>
          </div>
          <button 
            type="submit" 
            className="absolute right-2.5 bottom-2.5 bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-4 py-2 text-white"
          >
            Search
          </button>
        </div>
      </form>
    </header>
  );
};

export default Header;
