import { supabase } from "../supabase";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const STORAGE_BUCKET = "databases";

// Helper function to extract username from email
const getUsername = (email) => {
  return email.split("@")[0];
};

/**
 * Call backend to switch to user database (LOGIN)
 * Backend will download from Supabase or create new if doesn't exist
 */
export const switchToUserDatabase = async (userEmail) => {
  try {
    console.log(`🔄 Switching to database for ${userEmail}...`);

    const response = await fetch(`${API_BASE}/login/${userEmail}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
 * Upload empty database if doesn't exist, then switch (LEGACY - for backwards compatibility)
 */
export const uploadEmptyDatabase = async (userEmail) => {
  return await switchToUserDatabase(userEmail);
};

/**
 * Handle database import
 * 1. Upload new database to Supabase
 * 2. Call backend to download and switch to it
 */
export const handleDatabaseImport = async (userEmail, file) => {
  if (!file) {
    throw new Error("No file selected");
  }

  try {
    const username = getUsername(userEmail);
    const remotePath = `${username}.db`;

    console.log(`📤 Uploading database to Supabase as ${remotePath}...`);

    // Upload to Supabase Storage (overwrite existing)
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(remotePath, file, {
        contentType: "application/x-sqlite3",
        upsert: true, // Overwrite if exists
      });

    if (uploadError) throw uploadError;
    console.log("☁️ Database uploaded to Supabase Storage");

    // Call backend to download and switch
    console.log(`📥 Importing database on server...`);

    const response = await fetch(`${API_BASE}/import-database/${userEmail}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
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
 * Get download URL for export (from Supabase)
 * Export always happens from Supabase, not local file
 */
export const getDatabaseDownloadUrl = async (userEmail) => {
  try {
    const username = getUsername(userEmail);
    const remotePath = `${username}.db`;

    console.log(`🔗 Getting download URL for ${username}...`);

    // Get signed URL (valid for 1 hour)
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(remotePath, 3600);

    if (error) {
      if (error.statusCode === 404) {
        throw new Error(
          "Database not found in cloud storage. Please try logging out and back in."
        );
      }
      throw error;
    }

    if (!data?.signedUrl) {
      throw new Error("Failed to generate download URL");
    }

    console.log("✅ Download URL generated");
    return data.signedUrl;
  } catch (error) {
    console.error("❌ Error getting download URL:", error);
    throw error;
  }
};

/**
 * Sync current database to Supabase (called during logout)
 */
export const syncDatabaseToCloud = async (userEmail) => {
  try {
    console.log(`☁️ Syncing database for ${userEmail}...`);

    const response = await fetch(`${API_BASE}/logout/${userEmail}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to sync database");
    }

    const data = await response.json();
    console.log("✅ Database synced:", data.message);

    return {
      success: true,
      requiresRefresh: data.requiresRefresh,
    };
  } catch (error) {
    console.error("❌ Error syncing database:", error);
    throw error;
  }
};
