function normalizeBase(baseUrl) {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

export function withBase(path) {
  const baseUrl = normalizeBase(import.meta.env.BASE_URL || "/");
  const cleanPath = String(path).replace(/^\/+/, "");
  return `${baseUrl}${cleanPath}`;
}
