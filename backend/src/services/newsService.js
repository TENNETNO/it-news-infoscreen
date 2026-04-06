import Parser from "rss-parser";
import { loadConfig } from "../config/index.js";
import { withCache } from "../utils/cache.js";
import { computeId, dedupe } from "../utils/dedupe.js";
import { detectCategory, detectLanguage } from "../utils/categorization.js";
import { scrapeNsm } from "../utils/scraper.js";
import { enrichNewsItems } from "./aiEnrichmentService.js";

const config = loadConfig();

const parser = new Parser({
  timeout: 12000,
  headers: {
    "User-Agent": "it-news-infoscreen/1.0"
  }
});

let lastBuild = {
  builtAt: null,
  items: [],
  sourceStats: []
};

let buildInFlight = null;

function summarizeText(text) {
  if (!text) {
    return "No summary available.";
  }

  const cleaned = text
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return "No summary available.";
  }

  const firstSentence = cleaned.split(/[.!?]/)[0]?.trim() ?? cleaned;
  return `${firstSentence.slice(0, 180)}${firstSentence.length > 180 ? "..." : ""}`;
}

function firstHttpUrl(text) {
  if (!text) {
    return "";
  }

  const match = String(text).match(/https?:\/\/[^\s"'<> )]+/i);
  return match ? match[0].trim() : "";
}

function toAbsoluteUrl(url, sourceBase = "") {
  if (!url) {
    return "";
  }

  try {
    const resolved = new URL(url, sourceBase || undefined);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return "";
    }
    return resolved.toString();
  } catch {
    return "";
  }
}

function unwrapRegisterLink(url) {
  if (!url || !url.includes("go.theregister.com/feed/")) {
    return url;
  }

  const unwrapped = url.replace("https://go.theregister.com/feed/", "https://");
  return toAbsoluteUrl(unwrapped) || url;
}

function getPreferredArticleUrl(raw, source) {
  const direct = toAbsoluteUrl(raw.origlink || raw.link || raw.guid, source.url);
  const comments = toAbsoluteUrl(raw.comments, source.url);
  const contentUrl = toAbsoluteUrl(firstHttpUrl(raw.content || raw["content:encoded"] || raw.contentSnippet), source.url);

  if (source.id === "the-register") {
    return unwrapRegisterLink(direct || contentUrl || comments);
  }

  if (source.id === "hnrss") {
    if (contentUrl && !contentUrl.includes("news.ycombinator.com/item")) {
      return contentUrl;
    }
    return direct || comments || contentUrl;
  }

  return direct || contentUrl || comments;
}

function normalizeItem(raw, source) {
  const title = raw.title?.trim();
  const sourceUrl = getPreferredArticleUrl(raw, source);
  if (!title || !sourceUrl) {
    return null;
  }

  const published = raw.isoDate || raw.pubDate || raw.published || new Date().toISOString();
  const summary = summarizeText(raw.contentSnippet || raw.content || raw.summary || title);
  const language = detectLanguage(source.language, `${title} ${summary}`);
  const category = detectCategory({ title, summary }, source);

  const candidate = {
    id: "",
    title,
    source_name: source.name,
    source_url: sourceUrl,
    published_at: new Date(published).toISOString(),
    language,
    category,
    summary,
    image_url: "",
    qr_url: sourceUrl
  };

  candidate.id = computeId(candidate);
  return candidate;
}

async function fetchRssSource(source) {
  const feed = await parser.parseURL(source.url);
  const items = feed.items ?? [];
  return items.map((raw) => normalizeItem(raw, source)).filter(Boolean);
}

async function fetchNvdSource(source) {
  const startDate = new Date(Date.now() - 1000 * 60 * 60 * 24);
  const endpoint = new URL(source.url);
  endpoint.searchParams.set("pubStartDate", startDate.toISOString());
  endpoint.searchParams.set("resultsPerPage", "40");

  const response = await fetch(endpoint, {
    headers: { "User-Agent": "it-news-infoscreen/1.0" },
    signal: AbortSignal.timeout(12000)
  });

  if (!response.ok) {
    throw new Error(`NVD fetch failed: HTTP ${response.status}`);
  }

  const payload = await response.json();
  const vulnerabilities = payload.vulnerabilities ?? [];

  return vulnerabilities.map((entry) => {
    const cve = entry.cve ?? {};
    const cveId = cve.id ?? "Unknown CVE";
    const description = cve.descriptions?.find((d) => d.lang === "en")?.value ?? "No details from NVD.";
    const publishedAt = cve.published ?? new Date().toISOString();
    const sourceUrl = `https://nvd.nist.gov/vuln/detail/${cveId}`;

    const item = {
      id: "",
      title: `${cveId}: ${description.slice(0, 85)}${description.length > 85 ? "..." : ""}`,
      source_name: source.name,
      source_url: sourceUrl,
      published_at: new Date(publishedAt).toISOString(),
      language: "en",
      category: "security",
      summary: summarizeText(description),
      image_url: "",
      qr_url: sourceUrl
    };

    item.id = computeId(item);
    return item;
  });
}

async function fetchScrapeSource(source) {
  const entries = await scrapeNsm(source);
  return entries.map((entry) => {
    const item = {
      id: "",
      title: entry.title,
      source_name: source.name,
      source_url: entry.sourceUrl,
      published_at: new Date(entry.publishedAt).toISOString(),
      language: source.language,
      category: "security",
      summary: summarizeText(entry.summary),
      image_url: "",
      qr_url: entry.sourceUrl
    };

    item.id = computeId(item);
    return item;
  });
}

async function fetchSource(source) {
  if (!source.enabled) {
    return [];
  }

  return withCache(`source:${source.id}`, source.cache_ttl_sec, async () => {
    if (source.type === "rss") {
      return fetchRssSource(source);
    }

    if (source.type === "nvd") {
      return fetchNvdSource(source);
    }

    if (source.type === "scrape") {
      return fetchScrapeSource(source);
    }

    return [];
  });
}

async function buildNews() {
  const sourceStats = [];
  const settled = await Promise.allSettled(config.sources.map(async (source) => {
    const items = await fetchSource(source);
    sourceStats.push({ source: source.id, status: "ok", count: items.length });
    return items;
  }));

  const merged = [];

  settled.forEach((result, index) => {
    const sourceId = config.sources[index]?.id ?? `source-${index}`;

    if (result.status === "fulfilled") {
      merged.push(...result.value);
      return;
    }

    sourceStats.push({
      source: sourceId,
      status: "error",
      count: 0,
      error: result.reason?.message ?? "Unknown fetch error"
    });
  });

  const deduped = dedupe(merged).sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));
  const enriched = await enrichNewsItems(deduped);

  lastBuild = {
    builtAt: new Date().toISOString(),
    items: enriched,
    sourceStats
  };

  return lastBuild;
}

export async function getNormalizedNews() {
  if (buildInFlight) return buildInFlight;

  if (
    lastBuild.builtAt &&
    Date.now() - Date.parse(lastBuild.builtAt) < config.refresh_window_ms
  ) {
    return lastBuild;
  }

  buildInFlight = buildNews().finally(() => {
    buildInFlight = null;
  });

  return buildInFlight;
}
