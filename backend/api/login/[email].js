import { supabase } from "../../lib/supabase.js";
import { getUserId, handlePreflight } from "../../lib/auth.js";

/**
 * POST /api/login/:email
 *
 * Acknowledges login and ensures the public.users table has the latest
 * user metadata from Google OAuth (avatar, name, email, google_id, etc.).
 */
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const email = req.query.email || getUserId(req);

  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  try {
    // Extract metadata sent in request body if present
    const userPayload = req.body || {};
    const meta = userPayload.user_metadata || {};
    const appMeta = userPayload.app_metadata || {};

    const userId = userPayload.id;
    if (userId) {
      const fullName = meta.full_name || meta.name || "";
      const name = meta.name || meta.full_name || "";
      const avatarUrl = meta.avatar_url || meta.picture || "";
      const picture = meta.picture || meta.avatar_url || "";
      const provider = appMeta.provider || "google";
      const googleId = meta.sub || meta.provider_id || "";
      const emailVerified = Boolean(meta.email_verified ?? meta.verified_email ?? false);

      await supabase.from("users").upsert(
        {
          id: userId,
          email: email,
          full_name: fullName,
          name: name,
          avatar_url: avatarUrl,
          picture: picture,
          provider: provider,
          google_id: googleId,
          email_verified: emailVerified,
          custom_claims: meta.custom_claims || {},
          raw_user_meta_data: meta,
          last_sign_in_at: userPayload.last_sign_in_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
    }
  } catch (syncErr) {
    // Non-blocking error if table is not yet created or DB issue
    console.error("User profile sync error:", syncErr?.message || syncErr);
  }

  res.json({
    message: "Logged in successfully",
    user: email,
    isNew: false,
    requiresRefresh: true,
  });
}
