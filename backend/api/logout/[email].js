import { handlePreflight } from "../../lib/auth.js";

/**
 * POST /api/logout/:email
 *
 * In the old architecture logout triggered an upload of the local .db
 * to Supabase Storage. With Postgres, all writes are immediate and
 * persistent — no sync needed on logout.
 */
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const email = req.query.email;
  console.log(`👋 Logout acknowledged for: ${email}`);

  res.json({
    message: "Logged out successfully",
    requiresRefresh: true,
  });
}
