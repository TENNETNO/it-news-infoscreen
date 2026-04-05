import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { getNormalizedNews } from "../backend/src/services/newsService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputDir = path.resolve(__dirname, "../frontend/public/data");
const outputFile = path.join(outputDir, "news.json");

async function main() {
  const news = await getNormalizedNews();

  await mkdir(outputDir, { recursive: true });
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
