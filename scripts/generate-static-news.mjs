import path from "node:path";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getNormalizedNews } from "../backend/src/services/newsService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const outputDir = path.resolve(__dirname, "../frontend/public/data");
const outputFile = path.join(outputDir, "news.json");
const envFile = path.join(repoRoot, "backend", ".env");

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const index = line.indexOf("=");
    if (index <= 0) continue;

    const key = line.slice(0, index).trim();
    if (!key || process.env[key] !== undefined) continue;

    const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    process.env[key] = value;
  }
}

async function ensureImageDirectory() {
  const dir = path.resolve(__dirname, "../frontend/public/generated/news-images");
  await mkdir(dir, { recursive: true });

  const gitignorePath = path.join(dir, ".gitignore");
  if (!existsSync(gitignorePath)) {
    await writeFile(gitignorePath, "*\n!.gitignore\n", "utf8");
  }
}

async function main() {
  loadEnvFile(envFile);

  const news = await getNormalizedNews();

  await mkdir(outputDir, { recursive: true });
  await ensureImageDirectory();
  await writeFile(outputFile, `${JSON.stringify(news, null, 2)}\n`, "utf8");

  console.log(`[static-data] Wrote ${news.items.length} items to ${outputFile}`);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("[static-data] Failed to generate news JSON.");
    console.error(error);
    process.exit(1);
  });
