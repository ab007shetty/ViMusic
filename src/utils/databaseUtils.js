import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import axios from 'axios';

// Function to upload an empty database if it doesn't exist
const uploadEmptyDatabase = async (userEmail) => {
  const emptyDatabaseRef = ref(storage, `databases/${userEmail}.db`);

  try {
    // Check if the user's database already exists in Firebase Storage
    await getDownloadURL(emptyDatabaseRef);
    console.log('User database already exists:', emptyDatabaseRef);
  } catch (error) {
    if (error.code === 'storage/object-not-found') {
      console.log('User database does not exist. Uploading empty database...');

      // Load empty database from public folder
      const emptyDatabasePath = `${process.env.PUBLIC_URL}/database/empty.db`;
      const response = await fetch(emptyDatabasePath);
      const blob = await response.blob();
      
      // Upload the empty database to Firebase Storage
      await uploadBytes(emptyDatabaseRef, blob);
      console.log('Empty database uploaded for user:', userEmail);
    } else {
      console.error('Error checking user database:', error);
    }
  } finally {
    // Ensure the database is downloaded to the server after upload
    await triggerDatabaseDownloadOnServer(userEmail);
  }
};

// Function to trigger the server-side database download
const triggerDatabaseDownloadOnServer = async (userEmail) => {
  try {
    // Call the server endpoint that downloads the user-specific database
    //const response = await axios.get(`http://localhost:5000/download-database/${userEmail}`);
	const response = await axios.get(`https://vimusic.up.railway.app/download-database/${userEmail}`);
    console.log('Server-side download triggered:', response.data);
  } catch (error) {
    console.error('Error triggering server-side database download:', error);
  }
};

// Function to handle the import process
const handleDatabaseImport = async (userEmail, file) => {
  const storageRef = ref(storage, `databases/${userEmail}.db`);
  await uploadBytes(storageRef, file);
  console.log('Database uploaded successfully!');
  await triggerDatabaseDownloadOnServer(userEmail);
};

export { uploadEmptyDatabase, handleDatabaseImport };
