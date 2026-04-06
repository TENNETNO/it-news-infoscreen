function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

function countWords(text) {
  return normalizeText(text).split(" ").filter(Boolean).length;
}

function trimWords(text, maxWords, { ellipsis = true } = {}) {
  const words = normalizeText(text).split(" ").filter(Boolean);
  if (words.length <= maxWords) {
    return words.join(" ");
  }
  const trimmed = words.slice(0, maxWords).join(" ");
  return ellipsis ? `${trimmed}...` : trimmed;
}

function simplifyTopic(title) {
  const cleanTitle = normalizeText(title)
    .replace(/\([^)]*\)/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\s+-\s+.*$/, "")
    .trim();

  const colonParts = cleanTitle.split(":").map((part) => normalizeText(part)).filter(Boolean);
  const bestPart = colonParts.length > 1 && colonParts[1].split(" ").length >= 3
    ? colonParts[1]
    : cleanTitle;

  return trimWords(bestPart, 8, { ellipsis: false });
}

function categoryImpact(category) {
  switch (String(category || "").toLowerCase()) {
    case "security":
      return "This matters because it could change how teams protect data and accounts.";
    case "ai":
      return "This matters because it could change how teams use AI at work.";
    case "cloud":
      return "This matters because it could affect cloud cost, speed, or uptime.";
    case "norway":
      return "This matters because it could affect Norwegian teams or public services.";
    default:
      return "This matters because it could affect cost, risk, or daily work.";
  }
}

function sourceContext(sourceName) {
  if (!sourceName) {
    return "The source report has more detail on what changed and what to watch next.";
  }

  return `${sourceName} has more detail on what changed and what teams should watch next.`;
}

function ensureWordRange(text, minWords, maxWords, fillerParts) {
  let output = trimWords(text, maxWords);

  for (const part of fillerParts) {
    if (countWords(output) >= minWords) {
      break;
    }
    output = trimWords(`${output} ${part}`, maxWords);
  }

  return trimWords(output, maxWords);
}

export function buildDisplayTitle(item) {
  const generated = normalizeText(item?.short_title || "");
  if (generated) {
    return trimWords(generated, 8, { ellipsis: false });
  }

  return simplifyTopic(item?.title || "New tech story");
}

export function buildDisplaySummary(item) {
  const baseSummary = normalizeText(item?.summary || item?.title || "");
  const summaryBody = trimWords(baseSummary, 42);
  const text = `${summaryBody} ${categoryImpact(item?.category)}`;

  return ensureWordRange(text, 60, 70, [
    sourceContext(item?.source_name)
  ]);
}
