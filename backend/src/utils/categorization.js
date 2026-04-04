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
    "apple", "google", "meta", "amazon", "startup", "funding", "venture"
  ]
};

const NORWAY_MARKERS = [
  "norway", "norge", "norwegian", "oslo", "bergen", "trondheim",
  "stavanger", "norsk", "nkom", "nasjonal"
];

function containsAny(text, words) {
  return words.some((word) => text.includes(word));
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

  // Priority: security → ai → microsoft → cloud (default)
  for (const category of ["security", "ai", "microsoft", "cloud"]) {
    if (containsAny(corpus, CATEGORY_RULES[category])) {
      return category;
    }
  }

  return "cloud";
}
