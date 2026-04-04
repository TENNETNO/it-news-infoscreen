import crypto from "node:crypto";

const STOP_WORDS = new Set(["the", "a", "an", "and", "or", "for", "to", "of", "in", "on", "med", "og", "til", "av", "som"]);

export function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^a-z0-9\sæøå]/gi, " ")
    .split(/\s+/)
    .filter((token) => token && !STOP_WORDS.has(token))
    .join(" ");
}

export function canonicalUrl(url) {
  try {
    const parsed = new URL(url);
    for (const param of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
      parsed.searchParams.delete(param);
    }
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url?.trim() ?? "";
  }
}

function tokenSet(text) {
  return new Set(text.split(/\s+/).filter(Boolean));
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) {
      intersection += 1;
    }
  }
  const union = a.size + b.size - intersection;
  return union ? intersection / union : 0;
}

export function isDuplicate(candidate, existing) {
  if (canonicalUrl(candidate.source_url) === canonicalUrl(existing.source_url)) {
    return true;
  }

  const sim = jaccard(tokenSet(normalizeTitle(candidate.title)), tokenSet(normalizeTitle(existing.title)));
  return sim >= 0.86;
}

export function computeId(item) {
  const basis = `${normalizeTitle(item.title)}|${canonicalUrl(item.source_url)}|${item.source_name}`;
  return crypto.createHash("sha1").update(basis).digest("hex");
}

export function dedupe(items) {
  const deduped = [];

  for (const item of items) {
    const matchIndex = deduped.findIndex((existing) => isDuplicate(item, existing));
    if (matchIndex < 0) {
      deduped.push(item);
      continue;
    }

    const existing = deduped[matchIndex];
    const existingTs = Date.parse(existing.published_at) || Number.MAX_SAFE_INTEGER;
    const currentTs = Date.parse(item.published_at) || Number.MAX_SAFE_INTEGER;

    if (currentTs < existingTs) {
      deduped[matchIndex] = {
        ...item,
        id: existing.id
      };
    }
  }

  return deduped;
}
