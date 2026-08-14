import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function syncAllUsers() {
  console.log("🔄 Fetching all users from Supabase Auth...");

  try {
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) {
      console.error("❌ Failed to list auth users:", error);
      return;
    }

    const authUsers = data?.users || [];
    console.log(`📋 Found ${authUsers.length} auth user(s).`);

    if (authUsers.length === 0) {
      console.log("No users to sync.");
      return;
    }

    const rows = authUsers.map((u) => {
      const meta = u.user_metadata || {};
      const appMeta = u.app_metadata || {};

      const fullName = meta.full_name || meta.name || "";
      const name = meta.name || meta.full_name || "";
      const avatarUrl = meta.avatar_url || meta.picture || "";
      const picture = meta.picture || meta.avatar_url || "";
      const provider = appMeta.provider || "google";
      const googleId = meta.sub || meta.provider_id || "";
      const emailVerified = Boolean(meta.email_verified ?? meta.verified_email ?? false);

      return {
        id: u.id,
        email: u.email,
        full_name: fullName,
        name: name,
        avatar_url: avatarUrl,
        picture: picture,
        provider: provider,
        google_id: googleId,
        email_verified: emailVerified,
        custom_claims: meta.custom_claims || {},
        raw_user_meta_data: meta,
        last_sign_in_at: u.last_sign_in_at || null,
        created_at: u.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    console.log(`💾 Upserting ${rows.length} user records into public.users...`);

    const { data: upserted, error: upsertError } = await supabase
      .from("users")
      .upsert(rows, { onConflict: "id" })
      .select();

    if (upsertError) {
      console.error("❌ Upsert failed:", upsertError);
    } else {
      console.log(`✅ Successfully synced ${upserted?.length || rows.length} user(s) into public.users!`);
    }
  } catch (err) {
    console.error("❌ Error syncing users:", err);
  }
}

syncAllUsers();
