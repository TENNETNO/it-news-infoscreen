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
      return "This matters because it can change how teams protect users, devices, and company data.";
    case "ai":
      return "This matters because it can change how teams use AI tools, automate work, and manage risk.";
    case "cloud":
      return "This matters because it can affect uptime, cloud cost, platform choice, and service performance.";
    case "norway":
      return "This matters because it can affect Norwegian companies, digital services, and local technology decisions.";
    default:
      return "This matters because it can affect cost, operations, security, or day-to-day technology choices.";
  }
}

function sourceContext(sourceName) {
  if (!sourceName) {
    return "The original report has more detail on what changed, why it matters now, and what teams should watch next.";
  }

  return `${sourceName} has more detail on what changed, why it matters now, and what teams should watch next.`;
}

function followUpContext(category) {
  switch (String(category || "").toLowerCase()) {
    case "security":
      return "Teams may need to review exposure, update guidance, and confirm that current controls are still strong enough.";
    case "ai":
      return "Leaders may need to review governance, vendor choices, and where AI can safely create real business value.";
    case "cloud":
      return "Platform owners may need to review architecture, contracts, resilience plans, and near-term migration priorities.";
    case "norway":
      return "Local teams may need to watch for policy changes, supplier impact, and effects on public or private digital services.";
    default:
      return "Teams may need to review plans, adjust priorities, and decide whether this changes any near-term actions.";
  }
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
  const summaryBody = trimWords(baseSummary, 90);
  const text = `${summaryBody} ${categoryImpact(item?.category)}`;

  return ensureWordRange(text, 180, 210, [
    sourceContext(item?.source_name),
    followUpContext(item?.category)
  ]);
}

