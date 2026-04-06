function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

function trimWords(text, maxWords) {
  const words = normalizeText(text).split(" ").filter(Boolean);
  if (words.length <= maxWords) {
    return words.join(" ");
  }
  return `${words.slice(0, maxWords).join(" ")}...`;
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

  return trimWords(bestPart, 8);
}

function categoryImpact(category) {
  switch (String(category || "").toLowerCase()) {
    case "security":
      return "This matters because it could change how teams protect data and accounts.";
    case "ai":
      return "This matters because it could change how people use AI tools at work.";
    case "cloud":
      return "This matters because it could affect cloud cost, speed, or uptime.";
    case "norway":
      return "This matters because it could affect Norwegian tech teams or public services.";
    default:
      return "This matters because it could affect daily work, cost, or risk.";
  }
}

export function buildDisplayTitle(item) {
  return simplifyTopic(item?.title || "New tech story");
}

export function buildDisplaySummary(item) {
  const baseSummary = normalizeText(item?.summary || item?.title || "");
  const shortSummary = trimWords(baseSummary, 28);
  const impactLine = categoryImpact(item?.category);
  return trimWords(`${shortSummary} ${impactLine}`, 50);
}
