import express from "express";
import { scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";

const router = express.Router();
const scryptAsync = promisify(scrypt);

// Strict rate limit on login — 5 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             5,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { status: "error", message: "Too many login attempts. Try again in 15 minutes." }
});

function sessionDays() {
  const d = Number(process.env.SESSION_DAYS);
  return Number.isFinite(d) && d > 0 ? d : 10;
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge:   sessionDays() * 24 * 60 * 60 * 1000,
    path:     "/"
  };
}

// POST /auth/login
router.post("/login", loginLimiter, async (req, res) => {
  const { passphrase } = req.body ?? {};

  if (typeof passphrase !== "string" || passphrase.length < 1 || passphrase.length > 1000) {
    return res.status(400).json({ status: "error", message: "Invalid request." });
  }

  const PASSPHRASE_HASH = process.env.PASSPHRASE_HASH;
  const SESSION_SECRET  = process.env.SESSION_SECRET;

  if (!PASSPHRASE_HASH || !SESSION_SECRET) {
    console.error("[auth] PASSPHRASE_HASH or SESSION_SECRET not set in environment.");
    return res.status(503).json({ status: "error", message: "Authentication not configured." });
  }

  const parts = PASSPHRASE_HASH.split(":");
  if (parts.length !== 2) {
    return res.status(503).json({ status: "error", message: "Authentication not configured." });
  }

  const [salt, storedHex] = parts;

  try {
    const derived    = await scryptAsync(passphrase, salt, 64);
    const storedBuf  = Buffer.from(storedHex, "hex");
    // Constant-time comparison to prevent timing attacks
    const isMatch    = derived.length === storedBuf.length && timingSafeEqual(derived, storedBuf);

    if (!isMatch) {
      return res.status(401).json({ status: "error", message: "Incorrect passphrase." });
    }

    const token = jwt.sign({ v: 1 }, SESSION_SECRET, { expiresIn: `${sessionDays()}d` });
    res.cookie("session", token, cookieOptions());
    res.json({ status: "ok" });
  } catch {
    res.status(500).json({ status: "error", message: "Authentication error." });
  }
});

// POST /auth/logout
router.post("/logout", (_req, res) => {
  res.clearCookie("session", { path: "/" });
  res.json({ status: "ok" });
});

// GET /auth/status  — used by frontend on load to check if session is valid
router.get("/status", (req, res) => {
  const token          = req.cookies?.session;
  const SESSION_SECRET = process.env.SESSION_SECRET;

  if (!token || !SESSION_SECRET) {
    return res.status(401).json({ status: "unauthenticated" });
  }

  try {
    const payload = jwt.verify(token, SESSION_SECRET);
    res.json({ status: "authenticated", exp: payload.exp });
  } catch {
    res.status(401).json({ status: "unauthenticated" });
  }
});

export default router;
