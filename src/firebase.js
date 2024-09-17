// src/firebase.js

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getStorage } from 'firebase/storage'; 

const firebaseConfig = {
  apiKey: "AIzaSyBesDm7gN4htzYqk78ROKLawtkWczLdO4c",
  authDomain: "vimusic4abshetty.firebaseapp.com",
  projectId: "vimusic4abshetty",
  storageBucket: "vimusic4abshetty.appspot.com",
  messagingSenderId: "347893693696",
  appId: "1:347893693696:web:9047cbbfd3f3f4d65787e5",
  measurementId: "G-TLHEGN6K26"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth and Storage
const auth = getAuth(app);
const storage = getStorage(app);

export { auth, GoogleAuthProvider, signInWithPopup, signOut, storage };

