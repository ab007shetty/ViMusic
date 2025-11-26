import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Dialog } from '@headlessui/react';
import { FaGoogle } from 'react-icons/fa';
import { signInWithGoogle } from '../supabase';
import { uploadEmptyDatabase } from '../utils/databaseUtils';

const LoginModal = ({ isOpen, onClose = () => {} }) => {
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Sign in with Google via Supabase
      await signInWithGoogle();
      
      // Note: The actual user session will be handled by onAuthStateChanged
      // in App.jsx, which will call uploadEmptyDatabase
      console.log('Google sign-in initiated...');
      
      onClose();
    } catch (error) {
      console.error('Error during Google sign-in:', error);
      setError('Failed to sign in with Google');
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/70" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-sm w-full bg-gray-800 rounded-2xl p-6 shadow-2xl border border-gray-700">
          <Dialog.Title className="text-2xl font-bold text-white mb-2">
            Welcome to ViMusic
          </Dialog.Title>
          
          <Dialog.Description className="text-gray-400 mb-6">
            Sign in to sync your music library across devices
          </Dialog.Description>

          <button 
            onClick={handleGoogleSignIn} 
            disabled={isLoading}
            className="w-full bg-white hover:bg-gray-100 text-gray-900 font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-3 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FaGoogle className="text-xl" />
            {isLoading ? 'Signing in...' : 'Sign in with Google'}
          </button>

          {error && (
            <p className="mt-4 text-red-400 text-sm text-center">{error}</p>
          )}

          <p className="mt-4 text-xs text-gray-500 text-center">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

LoginModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default LoginModal;