import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getNormalizedNews } from "./services/newsService.js";
import { CATEGORY_IDS } from "./utils/categorization.js";
import { loadConfig } from "./config/index.js";
import authRouter from "./routes/auth.js";
import { requireAuth } from "./middleware/requireAuth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Detect pkg-packaged environment early (needed for correct paths below)
const isPkg = Object.prototype.hasOwnProperty.call(process, "pkg");

// Load .env â€” pkg exe looks next to the exe, dev looks in backend/
// process.loadEnvFile is built-in since Node 20.12 (no dotenv dependency needed)
const envFile = isPkg
  ? path.join(path.dirname(process.execPath), ".env")
  : path.resolve(__dirname, "../.env");

function loadEnvFileFallback(filePath) {
  if (!existsSync(filePath)) {
    return { loaded: false, reason: "missing" };
  }

  try {
    const content = readFileSync(filePath, "utf8");
    const lines = content.split(/\r?\n/);
    let applied = 0;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const idx = line.indexOf("=");
      if (idx <= 0) continue;

      const key = line.slice(0, idx).trim();
      if (!key || process.env[key] !== undefined) continue;

      let value = line.slice(idx + 1).trim();
      value = value.replace(/^['"]|['"]$/g, "");
      process.env[key] = value;
      applied += 1;
    }

    return { loaded: true, reason: `fallback:applied_${applied}` };
  } catch {
    return { loaded: false, reason: "fallback-error" };
  }
}

let envLoadStatus = "not-attempted";
try {
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile(envFile);
    envLoadStatus = existsSync(envFile) ? "loadEnvFile:ok" : "loadEnvFile:missing";
  } else {
    const result = loadEnvFileFallback(envFile);
    envLoadStatus = result.loaded ? result.reason : `fallback:${result.reason}`;
  }
} catch {
  const result = loadEnvFileFallback(envFile);
  envLoadStatus = result.loaded ? result.reason : `error:${result.reason}`;
}

// Corporate SSL inspection proxies re-sign certificates with an internal CA that
// Node.js doesn't trust by default, causing all outbound HTTPS fetches to fail.
// Allow opting out via .env so IT can enable this on managed networks.
const disableTlsVerify = String(process.env.DISABLE_TLS_VERIFY || "").toLowerCase() === "true";
if (disableTlsVerify) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const app    = express();
const config = loadConfig();
const PORT   = process.env.PORT || config.port || 8080;
const FRONTEND_DIST = isPkg
  ? path.join(path.dirname(process.execPath), "frontend")
  : path.resolve(__dirname, "../../frontend/dist");

// â”€â”€ 1. Trust proxy (if behind nginx/reverse-proxy) â”€â”€â”€â”€â”€â”€â”€â”€
app.set("trust proxy", 1);

// â”€â”€ 2. Security headers via Helmet â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:      ["'self'"],
      scriptSrc:       ["'self'"],
      styleSrc:        ["'self'", "'unsafe-inline'"],   // Vite inlines critical CSS
      imgSrc:          ["'self'", "data:"],              // QR codes are data: URIs
      connectSrc:      ["'self'"],
      fontSrc:         ["'self'"],
      objectSrc:       ["'none'"],
      mediaSrc:        ["'none'"],
      frameSrc:        ["'none'"],
      frameAncestors:  ["'self'"],                       // no embedding in iframes
      baseUri:         ["'self'"],
      formAction:      ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  hsts: {
    maxAge:            63072000,   // 2 years
    includeSubDomains: true,
    preload:           true
  },
  referrerPolicy:         { policy: "no-referrer" },
  crossOriginOpenerPolicy:  { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "same-origin" },
  // Allow data: URIs for QR images to render correctly
  crossOriginEmbedderPolicy: false
}));

// Remove fingerprinting header (helmet also does this, explicit for clarity)
app.disable("x-powered-by");

// â”€â”€ 3. Cookie parser (before auth routes) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use(cookieParser());

// â”€â”€ 4. CORS â€” internal network origins only â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : [
      `http://localhost:${PORT}`,
      "http://localhost:5173",      // Vite dev server
      "http://localhost:4173"       // Vite preview
    ];

app.use(cors({
  origin: (origin, cb) => {
    // Allow same-origin requests (no Origin header) and configured origins
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(Object.assign(new Error("CORS policy violation"), { status: 403 }));
  },
  methods:        ["GET", "POST"],   // POST needed for /auth/login and /auth/logout
  allowedHeaders: ["Accept", "Content-Type"],
  credentials:    true               // needed to send/receive the session cookie
}));

// â”€â”€ 5. Request body size limit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Auth login sends a JSON body; all other endpoints are read-only
app.use(express.json({ limit: "4kb" }));

// â”€â”€ 6. Auth routes (unauthenticated â€” handles its own rate limit) â”€
app.use("/auth", authRouter);

// â”€â”€ 7. Rate limiting â€” protect API from abuse â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const apiLimiter = rateLimit({
  windowMs:       60_000,   // 1 minute window
  max:            60,       // 60 requests / minute per IP (one poll every 10 min = 6/hour)
  standardHeaders: true,
  legacyHeaders:  false,
  message: { status: "error", message: "Too many requests â€” please slow down." },
  skip: (req) => req.ip === "127.0.0.1" || req.ip === "::1"  // allow localhost unrestricted
});
app.use("/api/", apiLimiter);

// â”€â”€ 8. Protect all /api/ routes â€” valid session required â”€â”€
app.use("/api/", requireAuth);

// â”€â”€ 9. Block non-GET requests to /api â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use("/api/", (req, res, next) => {
  if (req.method !== "GET") {
    return res.status(405).json({ status: "error", message: "Method not allowed." });
  }
  next();
});

// â”€â”€ 10. Sanitise query-param helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function safeLimit(raw, defaultVal, max = 200) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return defaultVal;
  return Math.min(Math.floor(n), max);
}

function safeCategoryFilter(raw) {
  if (!raw || typeof raw !== "string") return null;
  if (raw.length > 120) return null;                     // reject suspiciously long strings
  return raw
    .split(",")
    .map((v) => v.trim().toLowerCase().replace(/[^a-z]/g, ""))  // letters only
    .filter((v) => CATEGORY_IDS.includes(v));
}

// â”€â”€ 11. API routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get("/api/health", async (_req, res) => {
  try {
    const data = await getNormalizedNews();
    res.json({
      status:       "ok",
      uptime_sec:   Math.floor(process.uptime()),
      sources:      data.sourceStats,
      last_updated: data.builtAt,
      now:          new Date().toISOString()
    });
  } catch {
    // Never expose internal error detail on a health endpoint
    res.status(503).json({ status: "degraded", now: new Date().toISOString() });
  }
});

app.get("/api/news", async (req, res) => {
  try {
    const { items, builtAt } = await getNormalizedNews();
    const limit          = safeLimit(req.query.limit, config.default_limit);
    const categoryFilter = safeCategoryFilter(req.query.category);

    const filtered = categoryFilter?.length
      ? items.filter((item) => categoryFilter.includes(item.category))
      : items;

    res.json({
      last_updated: builtAt,
      count:        filtered.length,
      items:        filtered.slice(0, limit)
    });
  } catch {
    res.status(500).json({ status: "error", message: "Failed to retrieve news." });
  }
});

app.get("/api/news/summary", async (_req, res) => {
  try {
    const { items, builtAt } = await getNormalizedNews();
    const counts = CATEGORY_IDS.reduce((acc, key) => { acc[key] = 0; return acc; }, {});

    for (const item of items) {
      if (counts[item.category] !== undefined) counts[item.category] += 1;
    }

    res.json({ last_updated: builtAt, total: items.length, categories: counts });
  } catch {
    res.status(500).json({ status: "error", message: "Failed to retrieve summary." });
  }
});

// â”€â”€ 12. Serve built frontend (production) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

if (existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST, {
    etag:         true,
    lastModified: true,
    // Prevent browsers from guessing MIME types
    setHeaders: (res, filePath) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      // Cache immutable hashed assets aggressively, HTML never
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-store");
      } else if (/\.[a-f0-9]{8,}\.(js|css|woff2?)$/.test(filePath)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    }
  }));

  // SPA fallback â€” always return index.html for unknown paths (Express 5 requires /{*path})
  app.get("/{*path}", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(path.join(FRONTEND_DIST, "index.html"));
  });
}

// â”€â”€ 13. Catch-all error handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  // Log internally but never expose stack traces to clients
  console.error("[server error]", err.message);
  const status = err.status ?? 500;
  res.status(status).json({ status: "error", message: "An unexpected error occurred." });
});

// â”€â”€ Start â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[it-news] Backend running on http://0.0.0.0:${PORT}`);
  console.log(`[it-news] Allowed CORS origins: ${ALLOWED_ORIGINS.join(", ")}`);
  console.log(`[it-news] Frontend dist served: ${existsSync(FRONTEND_DIST)}`);
  console.log(`[it-news] Env file: ${envFile}`);
  console.log(`[it-news] Env load: ${envLoadStatus}`);
  console.log(`[it-news] TLS mode: disable_verify=${disableTlsVerify} reject_unauthorized=${process.env.NODE_TLS_REJECT_UNAUTHORIZED ?? "(default)"}`);
  console.log(`[it-news] TLS extra CA file: ${process.env.NODE_EXTRA_CA_CERTS ?? "(not set)"}`);
});


