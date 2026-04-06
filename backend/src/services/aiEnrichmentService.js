import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");
const aiCacheDir = path.join(repoRoot, "backend", ".cache", "ai");
const aiStateFile = path.join(repoRoot, "backend", ".cache", "ai-state.json");
const imageOutputDir = path.join(repoRoot, "frontend", "public", "generated", "news-images");
const publicImageDir = "generated/news-images";

function readPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sanitizeSummary(text, fallback) {
  if (!text) {
    return fallback;
  }

  const cleaned = String(text).replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return fallback;
  }

  return cleaned.length > 240 ? `${cleaned.slice(0, 237).trim()}...` : cleaned;
}

function extractGeminiText(payload) {
  const parts = [];

  for (const candidate of payload?.candidates ?? []) {
    for (const part of candidate?.content?.parts ?? []) {
      if (typeof part?.text === "string" && part.text.trim()) {
        parts.push(part.text.trim());
      }
    }
  }

  return parts.join(" ").trim();
}

function extractGeminiInlineImage(payload) {
  for (const candidate of payload?.candidates ?? []) {
    for (const part of candidate?.content?.parts ?? []) {
      if (part?.inlineData?.data && part.inlineData.mimeType?.startsWith("image/")) {
        return {
          base64: part.inlineData.data,
          mimeType: part.inlineData.mimeType
        };
      }
    }
  }

  return null;
}

function extFromMimeType(mimeType) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/jpeg") return "jpg";
  return "png";
}

function currentOsloDateKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function buildSummaryPrompt(item) {
  return [
    "Rewrite this news story as a friendly short summary for an office infoscreen.",
    "Use easy words, a clear tone, and make it feel interesting.",
    "Rules: 2 short sentences, max 45 words total, no bullet points, no hype, no quotes, no hashtags.",
    `Title: ${item.title}`,
    `Current summary: ${item.summary}`,
    `Source: ${item.source_name}`,
    `Category: ${item.category}`,
    `Language hint: ${item.language}`,
    `URL: ${item.source_url}`
  ].join("\n");
}

function buildImagePrompt(item) {
  return [
    "Create a clean, modern editorial illustration or realistic news-style scene for this IT news story.",
    "Focus on the topic only. Do not add text, captions, UI chrome, watermarks, logos, or brand marks.",
    "Make it visually strong for a widescreen office dashboard card, 16:9 composition.",
    `Story title: ${item.title}`,
    `Story summary: ${item.summary}`,
    `Category: ${item.category}`,
    `Source: ${item.source_name}`
  ].join("\n");
}

async function readJsonFile(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeJsonFile(filePath, payload) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function readCache(itemId) {
  return readJsonFile(path.join(aiCacheDir, `${itemId}.json`));
}

async function writeCache(itemId, payload) {
  await writeJsonFile(path.join(aiCacheDir, `${itemId}.json`), payload);
}

async function readAiState() {
  return (await readJsonFile(aiStateFile)) ?? {};
}

async function writeAiState(state) {
  await writeJsonFile(aiStateFile, state);
}

function isQuotaExceededError(error) {
  const message = String(error?.message ?? "");
  return /quota exceeded|insufficient_quota|free_tier_requests|http 429/i.test(message);
}

async function markQuotaExhausted(reason) {
  const state = await readAiState();
  state.quotaBlockedDay = currentOsloDateKey();
  state.quotaBlockedAt = new Date().toISOString();
  state.quotaBlockReason = reason;
  await writeAiState(state);
}

async function isQuotaBlockedToday() {
  const state = await readAiState();
  return state.quotaBlockedDay === currentOsloDateKey();
}

async function callGeminiModel(model, apiKey, body, timeoutMs) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Gemini request failed: HTTP ${response.status} ${errorText}`.trim());
  }

  return response.json();
}

async function generateSummary(item, settings) {
  if (!settings.geminiApiKey) {
    return item.summary;
  }

  const payload = await callGeminiModel(
    settings.geminiSummaryModel,
    settings.geminiApiKey,
    {
      contents: [
        {
          parts: [
            {
              text: buildSummaryPrompt(item)
            }
          ]
        }
      ]
    },
    30000
  );

  return sanitizeSummary(extractGeminiText(payload), item.summary);
}

async function generateImage(item, settings) {
  if (!settings.geminiApiKey) {
    return "";
  }

  const payload = await callGeminiModel(
    settings.geminiImageModel,
    settings.geminiApiKey,
    {
      contents: [
        {
          parts: [
            {
              text: buildImagePrompt(item)
            }
          ]
        }
      ],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"]
      }
    },
    90000
  );

  const image = extractGeminiInlineImage(payload);
  if (!image) {
    return "";
  }

  const extension = extFromMimeType(image.mimeType);
  const fileName = `${item.id}.${extension}`;
  const outputPath = path.join(imageOutputDir, fileName);
  await mkdir(imageOutputDir, { recursive: true });
  await writeFile(outputPath, Buffer.from(image.base64, "base64"));
  return `${publicImageDir}/${fileName}`;
}

async function enrichItem(item, settings) {
  const cache = await readCache(item.id);
  const summaryCacheValid = Boolean(cache?.summary && cache.summaryModel === settings.geminiSummaryModel);
  const imageCacheValid = Boolean(
    cache?.image_url &&
    cache.imageModel === settings.geminiImageModel &&
    existsSync(path.join(repoRoot, "frontend", "public", cache.image_url))
  );

  const next = {
    ...item,
    summary: summaryCacheValid ? cache.summary : item.summary,
    image_url: imageCacheValid ? cache.image_url : ""
  };

  if (!summaryCacheValid) {
    try {
      next.summary = await generateSummary(item, settings);
    } catch (error) {
      if (isQuotaExceededError(error)) {
        await markQuotaExhausted(error.message);
        throw error;
      }
      console.error(`[ai] Summary skipped for ${item.id}: ${error.message}`);
    }
  }

  if (!imageCacheValid) {
    try {
      next.image_url = await generateImage(next, settings);
    } catch (error) {
      if (isQuotaExceededError(error)) {
        await markQuotaExhausted(error.message);
        throw error;
      }
      console.error(`[ai] Image skipped for ${item.id}: ${error.message}`);
    }
  }

  await writeCache(item.id, {
    id: item.id,
    generatedAt: new Date().toISOString(),
    summary: next.summary,
    image_url: next.image_url,
    summaryModel: settings.geminiSummaryModel,
    imageModel: settings.geminiImageModel
  });

  return next;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await mapper(items[current], current);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export async function enrichNewsItems(items) {
  const settings = {
    geminiApiKey: process.env.GEMINI_API_KEY || "",
    geminiSummaryModel: process.env.GEMINI_SUMMARY_MODEL || "gemini-2.5-flash",
    geminiImageModel: process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image-preview",
    maxItems: readPositiveInt(process.env.AI_ENRICH_MAX_ITEMS, 200),
    concurrency: readPositiveInt(process.env.AI_ENRICH_CONCURRENCY, 1)
  };

  if (!settings.geminiApiKey) {
    return items.map((item) => ({ ...item, image_url: item.image_url || "" }));
  }

  if (await isQuotaBlockedToday()) {
    console.log(`[ai] Gemini quota already marked exhausted for ${currentOsloDateKey()}; skipping AI enrichment.`);
    return items.map((item) => ({ ...item, image_url: item.image_url || "" }));
  }

  const limitedCount = Math.min(settings.maxItems, items.length);

  try {
    const head = await mapWithConcurrency(
      items.slice(0, limitedCount),
      settings.concurrency,
      (item) => enrichItem(item, settings)
    );
    const tail = items.slice(limitedCount).map((item) => ({ ...item, image_url: item.image_url || "" }));
    return [...head, ...tail];
  } catch (error) {
    if (isQuotaExceededError(error)) {
      console.error(`[ai] Gemini quota exhausted for ${currentOsloDateKey()}; skipping remaining AI requests today.`);
      return items.map((item) => ({ ...item, image_url: item.image_url || "" }));
    }

    throw error;
  }
}
