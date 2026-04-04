import jwt from "jsonwebtoken";

/**
 * Express middleware — rejects requests without a valid session JWT cookie.
 * Attach to any route that requires authentication.
 */
export function requireAuth(req, res, next) {
  const token          = req.cookies?.session;
  const SESSION_SECRET = process.env.SESSION_SECRET;

  if (!token || !SESSION_SECRET) {
    return res.status(401).json({ status: "error", message: "Authentication required." });
  }

  try {
    jwt.verify(token, SESSION_SECRET);
    next();
  } catch {
    // Token expired or tampered — force re-login
    res.clearCookie("session", { path: "/" });
    res.status(401).json({ status: "error", message: "Session expired. Please log in again." });
  }
}
