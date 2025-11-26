const API_BASE =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "http://localhost:5000/api" : "/api");

export const fetchFromServer = async (endpoint, options = {}) => {
  try {
    const response = await fetch(`${API_BASE}/${endpoint}`, options);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
};

export const api = {
  get: (endpoint) => fetchFromServer(endpoint),
  post: (endpoint, data) =>
    fetchFromServer(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  put: (endpoint, data) =>
    fetchFromServer(endpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  delete: (endpoint) =>
    fetchFromServer(endpoint, {
      method: "DELETE",
    }),
};
