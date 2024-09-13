import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleAuthProvider, signInWithPopup, signOut, auth } from '../firebase';
import { FaGoogle } from 'react-icons/fa';
import { onAuthStateChanged } from 'firebase/auth';
import AccountSettingsModal from './AccountSettingsModal'; // Adjust path if needed
import { uploadEmptyDatabase } from '../utils/databaseUtils'; // Import the function

const Header = ({ onSearch, onSidebarToggle }) => {
  const [query, setQuery] = useState('');
  const [user, setUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();
  const modalRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        setShowModal(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    onSearch(query);
  };

  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Call the function to upload the empty database if it doesn't exist
      await uploadEmptyDatabase(user.email);

      navigate('/home');
    } catch (error) {
      console.error('Error during Google sign-in:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Error during sign-out:', error);
    }
  };

  return (
	<header className="p-4 flex items-center bg-gray-800 text-white bg-gradient-to-r from-emerald-400 to-indigo-600 rounded relative z-50">
	  <button
		onClick={onSidebarToggle}
		className="block lg:hidden text-white bg-gray-700 p-2 rounded-md mr-4"
		aria-label="Toggle Sidebar"
	  >
		<span className="material-icons">menu</span>
	  </button>
	  <form className="relative flex-1" onSubmit={handleSearch}>
		<label htmlFor="default-search" className="sr-only">Search</label>
		<div className="relative flex items-center">
		  <input 
			type="search" 
			id="default-search" 
			value={query}
			onChange={(e) => setQuery(e.target.value)}
			className="w-full h-12 p-4 pl-10 text-sm text-gray-900 border border-gray-300 rounded-lg bg-gray-50 focus:ring-blue-500 focus:border-blue-500"
			placeholder="Search by Song, Album, Artist..." 
			required 
		  />
		  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
			<svg className="w-4 h-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
			  <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/>
			</svg>
		  </div>
		  <button 
			type="submit" 
			className="hidden md:block absolute right-2.5 bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-4 py-2 text-white"
		  >
			Search
		  </button>
		</div>
	  </form>
	  <div className="flex items-center ml-4 relative">
		{!user ? (
		  <button 
			onClick={handleGoogleSignIn} 
			className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded flex items-center h-12" // Ensure height matches the search bar
		  >
			<FaGoogle className="mr-2" /> Sign in with Google
		  </button>
		) : (
		  <>
			<img 
			  src={user.photoURL} 
			  alt={user.displayName} 
			  className="w-10 h-10 rounded-full cursor-pointer"
			  onClick={() => setShowModal(!showModal)}
			/>
			{showModal && (
			  <AccountSettingsModal
				showModal={showModal}
				onClose={() => setShowModal(false)}
				handleSignOut={handleSignOut} // Pass handleSignOut as prop
				user={user}
				modalRef={modalRef} // Pass modalRef if needed
			  />
			)}
		  </>
		)}
	  </div>
	</header>
  );
};

export default Header;
