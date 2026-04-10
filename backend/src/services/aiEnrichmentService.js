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
const SUMMARY_PROMPT_VERSION = "2026-04-10-short-title-v3";
const IMAGE_PROMPT_VERSION = "2026-04-07-vector-style-v1";

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

  return cleaned.length > 360 ? `${cleaned.slice(0, 357).trim()}...` : cleaned;
}

function sanitizeShortTitle(text, fallback) {
  const source = String(text || fallback || "").replace(/\s+/g, " ").trim();
  if (!source) {
    return fallback;
  }

  const words = source.split(" ").filter(Boolean).slice(0, 8);
  return words.join(" ").replace(/[.!?:;,]+$/g, "").trim() || fallback;
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

function cleanGeminiTitle(text, fallback) {
  const cleaned = String(text || "").replace(/\s+/g, " ").replace(/[.!?:;,]+$/g, "").trim();
  if (!cleaned) return fallback;
  const words = cleaned.split(/\s+/);
  if (words.length <= 10) return cleaned;
  // Gemini ignored the word limit — trim to 10 words at a clean boundary
  return words.slice(0, 10).join(" ").replace(/[,:;-]+$/, "").trim();
}

function parseSummaryResponse(rawText, item) {
  const fallback = {
    shortTitle: sanitizeShortTitle(item.title, item.title),
    summary: sanitizeSummary(item.summary, item.summary)
  };

  if (!rawText) {
    return fallback;
  }

  const text = String(rawText).trim();

  try {
    const parsed = JSON.parse(text);
    return {
      shortTitle: cleanGeminiTitle(parsed.short_title, fallback.shortTitle),
      summary: sanitizeSummary(parsed.summary, fallback.summary)
    };
  } catch {
    const shortTitleMatch = text.match(/short[_ ]title\s*[:=-]\s*(.+)/i);
    const summaryMatch = text.match(/summary\s*[:=-]\s*([\s\S]+)/i);

    return {
      shortTitle: cleanGeminiTitle(shortTitleMatch?.[1], fallback.shortTitle),
      summary: sanitizeSummary(summaryMatch?.[1] || text, fallback.summary)
    };
  }
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
    "You are writing headlines for an IT news screen in a corporate office.",
    'Return ONLY valid JSON in exactly this shape: {"short_title":"...","summary":"..."}',
    "",
    "short_title rules:",
    "- Maximum 9 words. This is a hard limit — count the words before returning.",
    "- Write a BRAND NEW catchy headline. Do NOT copy or rephrase the original word-for-word.",
    "- Make it punchy, clear, and interesting — like a newspaper front page.",
    "- Active voice. Start with the most important word (not 'A', 'The', 'How', 'Why').",
    "- No ellipsis, no trailing punctuation, no quotes.",
    "",
    "summary rules:",
    "- 60 to 70 words. Plain English. No bullet points. No hype.",
    "",
    `Original title: ${item.title}`,
    `Context: ${item.summary}`,
    `Source: ${item.source_name} | Category: ${item.category}`
  ].join("\n");
}

function buildImagePrompt(item) {
  return [
    "Generate a modern flat vector illustration based on the subject line of this news story.",
    "Style: clean outline monoline style, thick consistent stroke lines, smooth rounded edges, minimal shading, no gradients, no textures.",
    "Use ONLY this palette and close tones from it: #2C2A29, #FF6F4A, #BBBBBB, #FFFFFF, #2B2D2F, #363230, #425563, #B18978.",
    "Avoid brown tones as much as possible. Use #B18978 only very subtly if needed.",
    "Show a simple faceless character that clearly represents the concept and performs an action that communicates it.",
    "Represent the subject with abstract UI elements and symbols, not real-world environments.",
    "Use minimal cards, charts, dashboards, icons, or panels that match the subject. Keep them geometric, modern, and uncluttered.",
    "Place the composition inside a soft organic cloud-like blob with a clean salmon #FF6F4A outline.",
    "Some elements should slightly extend outside the cloud boundary to create a layered composition.",
    "High contrast only. Use #2B2D2F, white, and salmon as the main accents.",
    "Isolated object only. Transparent background. PNG. No background, no shadows, no environment, no decorative text, no marketing banners, no logos, no watermarks.",
    `Subject line: ${item.short_title || item.title}`,
    `Story summary for context: ${item.summary}`,
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

async function generateSummaryContent(item, settings) {
  if (!settings.geminiApiKey) {
    return {
      shortTitle: sanitizeShortTitle(item.title, item.title),
      summary: item.summary
    };
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
      ],
      generationConfig: {
        responseMimeType: "application/json"
      }
    },
    30000
  );

  return parseSummaryResponse(extractGeminiText(payload), item);
}

async function enrichItem(item, settings) {
  const cache = await readCache(item.id);
  const summaryCacheValid = Boolean(
    cache?.summary &&
    cache?.short_title &&
    cache.summaryModel === settings.geminiSummaryModel &&
    cache.summaryPromptVersion === SUMMARY_PROMPT_VERSION
  );
  const next = {
    ...item,
    short_title: summaryCacheValid ? cache.short_title : sanitizeShortTitle(item.title, item.title),
    summary: summaryCacheValid ? cache.summary : item.summary,
    image_url: ""
  };

  let geminiSucceeded = false;
  if (!summaryCacheValid) {
    try {
      const content = await generateSummaryContent(item, settings);
      next.short_title = content.shortTitle;
      next.summary = content.summary;
      geminiSucceeded = true;
    } catch (error) {
      if (isQuotaExceededError(error)) {
        await markQuotaExhausted(error.message);
        throw error;
      }
      console.error(`[ai] Summary skipped for ${item.id}: ${error.message}`);
    }
  }

  if (summaryCacheValid || geminiSucceeded) {
    await writeCache(item.id, {
      id: item.id,
      generatedAt: new Date().toISOString(),
      short_title: next.short_title,
      summary: next.summary,
      image_url: "",
      summaryModel: settings.geminiSummaryModel,
      summaryPromptVersion: SUMMARY_PROMPT_VERSION
    });
  }

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
    maxItems: readPositiveInt(process.env.AI_ENRICH_MAX_ITEMS, 200),
    concurrency: readPositiveInt(process.env.AI_ENRICH_CONCURRENCY, 1)
  };

  if (!settings.geminiApiKey) {
    return items.map((item) => ({
      ...item,
      short_title: sanitizeShortTitle(item.title, item.title),
      image_url: ""
    }));
  }

  if (await isQuotaBlockedToday()) {
    console.log(`[ai] Gemini quota already marked exhausted for ${currentOsloDateKey()}; skipping AI enrichment.`);
    return items.map((item) => ({
      ...item,
      short_title: sanitizeShortTitle(item.title, item.title),
      image_url: ""
    }));
  }

  const limitedCount = Math.min(settings.maxItems, items.length);

  try {
    const head = await mapWithConcurrency(
      items.slice(0, limitedCount),
      settings.concurrency,
      (item) => enrichItem(item, settings)
    );
    const tail = items.slice(limitedCount).map((item) => ({
      ...item,
      short_title: sanitizeShortTitle(item.title, item.title),
      image_url: ""
    }));
    return [...head, ...tail];
  } catch (error) {
    if (isQuotaExceededError(error)) {
      console.error(`[ai] Gemini quota exhausted for ${currentOsloDateKey()}; skipping remaining AI requests today.`);
      return items.map((item) => ({
        ...item,
        short_title: sanitizeShortTitle(item.title, item.title),
        image_url: ""
      }));
    }

    throw error;
  }
}




