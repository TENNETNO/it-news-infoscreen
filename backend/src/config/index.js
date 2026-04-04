import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, "sources.json");

export function loadConfig() {
  const raw = fs.readFileSync(configPath, "utf-8");
  return JSON.parse(raw);
}
