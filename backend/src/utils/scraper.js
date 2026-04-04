import { load } from "cheerio";

export async function canScrape(url) {
  try {
    const robotsUrl = new URL("/robots.txt", url).toString();
    const response = await fetch(robotsUrl, { headers: { "User-Agent": "it-news-infoscreen-bot/1.0" }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) {
      return false;
    }
    const robots = (await response.text()).toLowerCase();
    const hasWildcardAllow = robots.includes("user-agent: *") && robots.includes("allow: /");
    const blocksAll = robots.includes("user-agent: *") && robots.includes("disallow: /");
    return hasWildcardAllow && !blocksAll;
  } catch {
    return false;
  }
}

export async function scrapeNsm(source) {
  const allowed = await canScrape(source.url);
  if (!allowed) {
    return [];
  }

  const response = await fetch(source.url, {
    headers: { "User-Agent": "it-news-infoscreen-bot/1.0" },
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    throw new Error(`NSM scrape failed: HTTP ${response.status}`);
  }

  const html = await response.text();
  const $ = load(html);
  const items = [];

  $("a").each((_, el) => {
    const title = $(el).text().trim();
    const href = $(el).attr("href");
    if (!title || !href) {
      return;
    }

    const lower = title.toLowerCase();
    if (!/(advarsel|varsel|sikkerhet|security|vulnerab|cve)/.test(lower)) {
      return;
    }

    const url = href.startsWith("http") ? href : new URL(href, source.url).toString();

    items.push({
      title,
      sourceUrl: url,
      publishedAt: new Date().toISOString(),
      summary: title
    });
  });

  return items.slice(0, 20);
}
