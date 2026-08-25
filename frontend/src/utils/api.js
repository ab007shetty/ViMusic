// src/utils/api.js

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "http://localhost:8080/api" : "/api");

// Store current user email (set after login)
let currentUserEmail = null;

// ====== USER SESSION MANAGEMENT ======
export const setUserEmail = (email) => {
  currentUserEmail = email;
  if (email) {
    localStorage.setItem("userEmail", email);
  } else {
    localStorage.removeItem("userEmail");
  }
};

export const getUserEmail = () => {
  if (!currentUserEmail) {
    const stored = localStorage.getItem("userEmail");
    if (stored) {
      currentUserEmail = stored;
    }
  }
  return currentUserEmail;
};

export const isLoggedIn = () => {
  return !!getUserEmail();
};

// ====== HEADERS WITH USER AUTH ======
const getHeaders = (additionalHeaders = {}) => {
  const userEmail = getUserEmail();
  return {
    "Content-Type": "application/json",
    ...(userEmail ? { "X-User-Email": userEmail } : {}),
    ...additionalHeaders,
  };
};

// ====== CORE FETCH FUNCTION ======
export const fetchFromServer = async (endpoint, options = {}) => {
  try {
    const headers = getHeaders(options.headers);

    const response = await fetch(`${API_BASE}/${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`HTTP error! status: ${response.status}${errorText ? ` — ${errorText}` : ''}`);
    }

    return await response.json();
  } catch (error) {
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
