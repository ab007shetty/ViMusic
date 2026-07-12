import { handlePreflight } from "../../lib/auth.js";

/**
 * POST /api/login/:email
 *
 * In the Postgres model there is no "create user database" step —
 * rows are simply scoped by user_id. Login is now a no-op on the
 * server side; it just acknowledges the user.
 *
 * Supabase Auth handles the actual authentication on the client.
 */
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const email = req.query.email;

  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  console.log(`✅ Login acknowledged for: ${email}`);

  res.json({
    message: "Logged in successfully",
    user: email,
    isNew: false,
    requiresRefresh: true,
  });
}
