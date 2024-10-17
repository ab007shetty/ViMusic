const localServer = process.env.REACT_APP_LOCAL_SERVER_URL;
const liveServer = process.env.REACT_APP_LIVE_SERVER_URL;

let currentServer = localServer; // Start with the local server by default
let alertShown = false;

// Utility function to fetch data from the current server or determine the correct server
export const fetchFromServer = async (endpoint, options = {}) => {
  const serverUrl = currentServer; // Always use the current server

  try {
    const response = await fetch(`${serverUrl}/${endpoint}`, options); // Use the provided options

    if (!response.ok) {
      throw new Error(`Failed to fetch from ${serverUrl}/${endpoint}`);
    }

    return await response.json(); // Return the JSON response if successful
  } catch (error) {
    console.error(`Error fetching from ${serverUrl}:`, error);

    // Handle server failover
    if (serverUrl === localServer) {
      // If the local server failed, switch to the live server
      currentServer = liveServer;
      console.warn(`Switching to live server: ${liveServer}`);

      // Retry the request with the live server
      return await fetchFromServer(endpoint, options);
    } else {
      // If live server failed, show alert only once
      if (!alertShown) {
        alert("Both local and live servers are unavailable. ONLY SEARCH WORKS!!!");
        alertShown = true; // Prevent multiple alerts
      }

      throw new Error("Both servers failed");
    }
  }
};

