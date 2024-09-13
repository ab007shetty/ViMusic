import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Dialog } from '@headlessui/react';
import { GoogleAuthProvider, signInWithPopup, auth } from '../firebase'; // Adjust path if needed
import { FaGoogle } from 'react-icons/fa'; // Import the Google icon
import { uploadEmptyDatabase } from '../utils/databaseUtils'; // Import the function

const LoginModal = ({ isOpen, onClose = () => {} }) => {
  const [error, setError] = useState(null);

  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Call the function to upload the empty database if it doesn't exist
      await uploadEmptyDatabase(user.email);

      // Handle successful login
      console.log('User info:', user);
      onClose(); // Close the modal upon successful login
    } catch (error) {
      console.error('Error during Google sign-in:', error);
      setError('Failed to sign in with Google');
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <Dialog.Panel>
        <Dialog.Title>Login</Dialog.Title>
        <Dialog.Description>
          <button 
            onClick={handleGoogleSignIn} 
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded flex items-center"
          >
            <FaGoogle className="mr-2" /> Sign in with Google
          </button>
        </Dialog.Description>
        {error && <p className="text-red-500">{error}</p>}
      </Dialog.Panel>
    </Dialog>
  );
};

// Define prop types
LoginModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default LoginModal;
