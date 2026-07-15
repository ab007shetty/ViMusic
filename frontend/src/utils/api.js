// src/utils/api.js

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "http://localhost:8080/api" : "/api");

// Store current user email (set after login)
let currentUserEmail = null;

// ====== USER SESSION MANAGEMENT ======
export const setUserEmail = (email) => {
  console.log(`📧 Setting user email: ${email || "null (guest mode)"}`);
  currentUserEmail = email;
  if (email) {
    localStorage.setItem("userEmail", email);
    console.log("✅ User email saved to localStorage");
  } else {
    localStorage.removeItem("userEmail");
    console.log("✅ User email removed from localStorage");
  }
};

export const getUserEmail = () => {
  // Always try to get from localStorage first if not in memory
  if (!currentUserEmail) {
    const stored = localStorage.getItem("userEmail");
    if (stored) {
      currentUserEmail = stored;
      console.log(`📧 Restored user email from localStorage: ${stored}`);
    }
  }
  return currentUserEmail;
};

export const isLoggedIn = () => {
  return !!getUserEmail();
};

// ====== HEADERS WITH USER AUTH ======
const getHeaders = (additionalHeaders = {}) => {
  const headers = {
    "Content-Type": "application/json",
    ...additionalHeaders,
  };

  // CRITICAL: Always get latest user email
  const userEmail = getUserEmail();
  if (userEmail) {
    headers["X-User-Email"] = userEmail;
    console.log(`🔐 [API] Adding X-User-Email header: ${userEmail}`);
  } else {
    console.log(`👤 [API] No user email - sending as GUEST (no header)`);
  }

  return headers;
};

// ====== CORE FETCH FUNCTION ======
export const fetchFromServer = async (endpoint, options = {}) => {
  try {
    // Merge headers with user auth
    const headers = getHeaders(options.headers);

    const response = await fetch(`${API_BASE}/${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error ${response.status}:`, errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`❌ API Error on ${endpoint}:`, error);
    throw error;
  }
};

// ====== GENERIC API METHODS ======
export const api = {
  get: (endpoint) => fetchFromServer(endpoint, { method: "GET" }),

  post: (endpoint, data) =>
    fetchFromServer(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  put: (endpoint, data) =>
    fetchFromServer(endpoint, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (endpoint) =>
    fetchFromServer(endpoint, {
      method: "DELETE",
    }),
};

// ====== DEFAULT EXPORT (for backward compatibility) ======
export default {
  api,
  setUserEmail,
  getUserEmail,
  isLoggedIn,
  fetchFromServer,
};
