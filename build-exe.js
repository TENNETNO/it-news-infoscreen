#!/usr/bin/env node
/**
 * build-exe.js  —  packages the infoscreen as a standalone Windows .exe
 *
 * Output:  release/
 *            infoscreen.exe   ← self-contained server (Node.js + all backend code)
 *            frontend/        ← built React app (served by the exe)
 *            .env.example     ← reminder to place .env here
 *            start-kiosk.bat  ← opens Chrome in full-screen kiosk mode
 *
 * Usage:
 *   node build-exe.js
 *
 * Requirements:  Node.js 18+ installed on the build machine.
 */

import { execSync }                    from "node:child_process";
import { cpSync, mkdirSync, rmSync,
         existsSync, writeFileSync }   from "node:fs";
import { join }                        from "node:path";
import { fileURLToPath }               from "node:url";
import esbuild                         from "esbuild";

const root    = fileURLToPath(new URL(".", import.meta.url));
const build   = join(root, ".build");
const release = join(root, "release");

function run(cmd, cwd = root) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd });
}

// ── 1. Clean previous build artefacts ─────────────────────
console.log("\n── Cleaning previous build ──");
// Only wipe the temp .build dir — release/ is overwritten in-place
// (Windows may lock infoscreen.exe if it was recently run, preventing rmSync)
if (existsSync(build)) rmSync(build, { recursive: true, force: true });
mkdirSync(build, { recursive: true });
mkdirSync(release, { recursive: true });

// ── 2. Build React frontend ────────────────────────────────
console.log("\n── Building frontend ──");
run("npm run build --prefix frontend");

// ── 3. Bundle backend with esbuild → single CJS file ──────
console.log("\n── Bundling backend ──");
await esbuild.build({
  entryPoints: [join(root, "backend/src/server.js")],
  bundle:      true,
  platform:    "node",
  target:      "node20",
  outfile:     join(build, "server.cjs"),
  format:      "cjs",
  // In CJS bundles import.meta.url is undefined — patch it with the real file URL
  banner:      { js: "const __importMetaUrl = require('url').pathToFileURL(__filename).href;" },
  define:      { "import.meta.url": "__importMetaUrl" },
  external:    ["fsevents", "cpu-features"],
  logLevel:    "warning"
});

// ── 4. Copy runtime assets into .build so pkg can snapshot them ──
// sources.json is read with fs.readFileSync — it must be present next to the bundle
cpSync(
  join(root, "backend/src/config/sources.json"),
  join(build, "sources.json")
);

// ── 5. Create a minimal package.json for pkg ──────────────
writeFileSync(join(build, "package.json"), JSON.stringify({
  name: "infoscreen",
  version: "1.0.0",
  bin: "server.cjs",
  pkg: {
    targets: ["node20-win-x64"],
    outputPath: release,
    assets: ["sources.json"]
  }
}, null, 2));

// ── 6. Package into .exe with pkg ─────────────────────────
// Pass the package.json (not server.cjs) so pkg reads the assets config
console.log("\n── Packaging .exe (this may take a minute) ──");
run(
  `npx pkg ${build}/package.json --target node20-win-x64 --output ${release}/infoscreen.exe`,
  build
);

// ── 7. Copy built frontend and .env next to the exe ───────
console.log("\n── Copying frontend dist ──");
cpSync(join(root, "frontend", "dist"), join(release, "frontend"), { recursive: true });

// Copy .env from backend/ into release/ so the exe can find it
const backendEnv = join(root, "backend", ".env");
if (existsSync(backendEnv)) {
  cpSync(backendEnv, join(release, ".env"));
  console.log("── Copied backend/.env → release/.env ──");
} else {
  console.warn("── WARNING: backend/.env not found — create release/.env before running the exe ──");
}

// ── 8. Write helper files into release/ ───────────────────
writeFileSync(join(release, ".env.example"), [
  "# Copy this file to .env and fill in your values",
  "PORT=8080",
  "ALLOWED_ORIGINS=http://localhost:8080",
  "PASSPHRASE_HASH=<run node scripts/hash-passphrase.js in backend/>",
  "SESSION_SECRET=<random 48-byte base64url string>",
  "SESSION_DAYS=10",
  ""
].join("\n"));

writeFileSync(join(release, "start-kiosk.bat"), [
  "@echo off",
  ":: Start the infoscreen server",
  'start "" infoscreen.exe',
  "",
  ":: Wait a moment for the server to start",
  "timeout /t 3 /nobreak > nul",
  "",
  ":: Open Chrome in kiosk mode (full-screen, no browser UI)",
  'start "" "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --kiosk --app=http://localhost:8080 --disable-pinch --overscroll-history-navigation=0',
  ""
].join("\r\n"));

writeFileSync(join(release, "stop.bat"), [
  "@echo off",
  "taskkill /f /im infoscreen.exe >nul 2>&1",
  "taskkill /f /im chrome.exe     >nul 2>&1",
  "echo Infoscreen stopped.",
  ""
].join("\r\n"));

// ── Done ──────────────────────────────────────────────────
console.log(`
──────────────────────────────────────────
  Build complete!  →  release/

  Files to copy to the TV machine:
    infoscreen.exe
    frontend/       (entire folder)
    .env            (create from .env.example — add your PASSPHRASE_HASH etc.)
    start-kiosk.bat
    stop.bat

  On the TV machine, double-click start-kiosk.bat to launch.
──────────────────────────────────────────
`);
