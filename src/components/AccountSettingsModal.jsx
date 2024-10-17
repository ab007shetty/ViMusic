import React, { useState, useEffect, useRef } from 'react';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import { handleDatabaseImport } from '../utils/databaseUtils'; // Import the function
import axios from 'axios'; // Make sure axios is imported

const AccountSettingsModal = ({ showModal, onClose, handleSignOut, user }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const modalRef = useRef(null);
  const storage = getStorage();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const handleImport = async () => {
    if (selectedFile && user) {
      try {
        await handleDatabaseImport(user.email, selectedFile); // Call the imported function
        alert('Database uploaded and imported successfully!');
        setSelectedFile(null); // Clear selected file
      } catch (error) {
        console.error('Error during import:', error);
        alert('Error during import');
      }
    } else {
      alert('Please select a file');
    }
  };

  const handleExport = async () => {
    if (user) {
      try {
        const fileRef = ref(storage, `databases/${user.email}.db`);
        const url = await getDownloadURL(fileRef);
        
        // Create a link element to trigger the download
        const a = document.createElement('a');
        a.href = url;
        a.download = `${user.email}.db`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch (error) {
        console.error('Error retrieving file URL:', error);
        alert('Error retrieving file');
      }
    } else {
      alert('User not authenticated');
    }
  };

  const handleSignOutClick = async () => {
    if (user) {
      try {
		  
		  // Call the provided handleSignOut function
        await handleSignOut();
		
        // Make a request to the server to delete the user's database
       // await axios.post(`http://localhost:5000/api/logout/${user.email}`);
		await axios.post(`https://vimusic.up.railway.app/api/logout/${user.email}`);
        console.log('Logout successful and database deleted.');
   
      } catch (error) {
        console.error('Error during sign out:', error);
      }
    } else {
      console.log('No user is signed in.');
    }
  };

  return (
    showModal && (
      <div 
        ref={modalRef}
        className="absolute top-12 right-0 mt-2 w-80 bg-white text-black border border-gray-300 rounded-lg shadow-xl z-50"
      >
        <div className="p-6 space-y-4">
          <h3 className="font-semibold text-lg mb-4">Account Settings</h3>
          <div className="space-y-4">
            <div className="bg-gray-100 p-4 rounded-lg border border-gray-300">
              <h4 className="font-medium text-base mb-2">Import Database</h4>
              <input 
                type="file" 
                accept=".db"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:border file:border-gray-300 file:rounded-md file:bg-gray-50 file:text-gray-900 hover:file:bg-gray-100"
              />
              <button 
                onClick={handleImport}
                className="w-full mt-2 bg-green-500 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded"
              >
                Import Database
              </button>
            </div>
            <button 
              onClick={handleExport}
              className="w-full bg-blue-500 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded"
            >
              Export Database
            </button>
            <button 
              onClick={handleSignOutClick} // Use the local handleSignOutClick function
              className="w-full bg-red-500 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    )
  );
};

export default AccountSettingsModal;
