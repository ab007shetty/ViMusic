/**
 * Extract the user identifier from the request.
 *
 * user_id convention (matches Postgres schema):
 *   '' (empty string) = guest / unauthenticated
 *   'user@email.com'  = authenticated user
 *
 * We use the full email (not just the prefix) as user_id to avoid
 * collisions like user@gmail.com vs user@yahoo.com.
 */
export function getUserId(req) {
  const email = req.headers["x-user-email"] || null;

  if (
    !email ||
    email === "null" ||
    email === "undefined" ||
    email === "guest"
  ) {
    return ""; // guest — matches DEFAULT '' in Postgres
  }

  return email.toLowerCase().trim();
}

/**
 * CORS headers for all responses.
 */
export function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, x-user-email, Authorization"
  );
}

/**
 * Handle preflight OPTIONS requests.
 * Returns true if this was a preflight (caller should return immediately).
 */
export function handlePreflight(req, res) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return true;
  }
  return false;
}
