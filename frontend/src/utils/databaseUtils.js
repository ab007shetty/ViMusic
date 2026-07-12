import { supabase } from "../supabase";

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "http://localhost:8080/api" : "/api");

// Helper function to extract username from email
const getUsername = (email) => {
  return email.split("@")[0];
};

/**
 * Call backend to switch to user database (LOGIN)
 */
export const switchToUserDatabase = async (userEmail) => {
  try {
    console.log(`🔄 Switching to database for ${userEmail}...`);

    const response = await fetch(`${API_BASE}/login/${userEmail}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Email": userEmail,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error || `Server responded with ${response.status}`
      );
    }

    const data = await response.json();
    console.log("✅ Database switched:", data.message);

    return {
      success: true,
      isNew: data.isNew,
      requiresRefresh: data.requiresRefresh,
    };
  } catch (error) {
    console.error("❌ Error switching database:", error);
    throw error;
  }
};

/**
 * Upload empty database if doesn't exist, then switch (LEGACY)
 */
export const uploadEmptyDatabase = async (userEmail) => {
  return await switchToUserDatabase(userEmail);
};

/**
 * Handle database import
 * Sends the selected .db file directly to the backend.
 */
export const handleDatabaseImport = async (userEmail, file) => {
  if (!file) {
    throw new Error("No file selected");
  }

  try {
    console.log(`📥 Sending database file to backend...`);

    const response = await fetch(`${API_BASE}/import-database/${userEmail}`, {
      method: "POST",
      headers: {
        "X-User-Email": userEmail,
        "Content-Type": "application/octet-stream"
      },
      body: file // Send binary file directly!
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to import on server");
    }

    const data = await response.json();
    console.log("✅ Import complete:", data.message);

    return {
      success: true,
      requiresRefresh: data.requiresRefresh,
    };
  } catch (error) {
    console.error("❌ Import failed:", error);
    throw error;
  }
};

/**
 * Get download URL for export
 * Returns the direct URL to the backend's export endpoint.
 */
export const getDatabaseDownloadUrl = async (userEmail) => {
  console.log(`🔗 Getting download URL for ${userEmail}...`);
  // The backend's GET endpoint returns the .db binary directly.
  return `${API_BASE}/export-database/${userEmail}`;
};

/**
 * Sync current database to Supabase (called during logout)
 * Our Postgres backend is always in sync, so this just cleans up the session.
 */
export const syncDatabaseToCloud = async (userEmail) => {
  try {
    console.log(`☁️ Logging out ${userEmail}...`);

    const response = await fetch(`${API_BASE}/logout/${userEmail}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Email": userEmail,
      },
    });

    if (!response.ok) {
      console.warn("⚠️ Logout warning from server");
    }

    return {
      success: true,
      requiresRefresh: true,
    };
  } catch (error) {
    console.error("❌ Error during logout:", error);
    throw error;
  }
};

