export const CATEGORY_IDS = [
  "security",
  "ai",
  "cloud",
  "microsoft",
  "norway"
];

const CATEGORY_RULES = {
  security: [
    "cve", "vulnerability", "vulnerabilities", "breach", "ransomware", "patch",
    "zero day", "zero-day", "cisa", "nsm", "nvd", "incident", "malware",
    "phishing", "exploit", "cyberattack", "cybersecurity", "hacked", "hack",
    "outage", "degraded", "data leak", "threat"
  ],
  ai: [
    "artificial intelligence", "machine learning", "deep learning",
    "llm", "large language model", "openai", "anthropic", "gemini",
    "chatgpt", "gpt", "copilot", "generative", "nvidia", "llama",
    "stable diffusion", "midjourney", "chatbot", "ai model", "foundation model"
  ],
  microsoft: [
    "microsoft", "windows", "azure", "office 365", "microsoft 365",
    "entra", "intune", "exchange", "sharepoint", "teams", "xbox",
    "azure ad", "active directory", "power bi", "dynamics"
  ],
  cloud: [
    "aws", "amazon web services", "gcp", "google cloud", "kubernetes",
    "serverless", "docker", "devops", "saas", "paas", "cloud computing",
    "data center", "infrastructure", "api", "open source", "linux",
    "software", "network", "database", "cybersecurity", "encryption",
    "it security", "enterprise", "tech company", "data privacy", "gdpr",
    "hardware", "processor", "chip", "semiconductor", "broadband", "5g"
  ]
};

const NORWAY_MARKERS = [
  "norway", "norge", "norwegian", "oslo", "bergen", "trondheim",
  "stavanger", "norsk", "nkom", "nasjonal"
];

// Patterns that disqualify a story regardless of category keyword matches
const BLOCK_PATTERNS = [
  /\bbest\s+\w.{0,30}\s+(20\d\d|review)/i,   // "Best X (2026)", "Best X Review"
  /\breview\b.*\b(20\d\d)\b/i,                 // product reviews with year
  /promo\s*codes?/i,                           // coupon/promo articles
  /savings\s+hacks?/i,
  /\brocket\s+report\b/i,                      // space launch digest
  /\bmosquito(es)?\b/i,                        // biology / not IT
  /\birrigat/i,                                // smart irrigation products
  /\bsmart\s+(shades?|blinds?|curtains?)\b/i,  // smart home consumer products
  /heading\s+to\s+\w+\s*[–—-]/i,             // "TechCrunch heading to Tokyo —"
  /\b(artemis|orion\s+capsule|falcon\s+9|spacex\s+launch)\b/i, // space news
];

function containsAny(text, words) {
  return words.some((word) => text.includes(word));
}

export function isBlockedContent(title, summary) {
  const corpus = `${title} ${summary}`;
  return BLOCK_PATTERNS.some((pattern) => pattern.test(corpus));
}

export function detectLanguage(sourceLang, text) {
  if (sourceLang === "no" || sourceLang === "en") {
    return sourceLang;
  }

  const lower = ` ${text.toLowerCase()} `;
  const norwegianHints = [" og ", " ikke ", " med ", " til ", " fra ", "å", "ø", "æ"];
  return containsAny(lower, norwegianHints) ? "no" : "en";
}

export function detectCategory(item, source) {
  const corpus = `${item.title} ${item.summary}`.toLowerCase();

  const sourceIsNorwegian = source.country === "NO" || source.language === "no";
  if (sourceIsNorwegian || containsAny(corpus, NORWAY_MARKERS)) {
    return "norway";
  }

  // Priority: security → ai → microsoft → cloud
  for (const category of ["security", "ai", "microsoft", "cloud"]) {
    if (containsAny(corpus, CATEGORY_RULES[category])) {
      return category;
    }
  }

  // No match — not IT-relevant, reject the item
  return null;
}
