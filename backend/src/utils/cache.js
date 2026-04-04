const memoryCache = new Map();
const pending = new Map();

export async function withCache(key, ttlSec, producer) {
  const now = Date.now();
  const hit = memoryCache.get(key);

  if (hit && hit.expiresAt > now) {
    return hit.value;
  }

  if (pending.has(key)) {
    return pending.get(key);
  }

  const promise = Promise.resolve()
    .then(() => producer())
    .then((value) => {
      memoryCache.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
      pending.delete(key);
      return value;
    })
    .catch((err) => {
      pending.delete(key);
      throw err;
    });

  pending.set(key, promise);
  return promise;
}

export function clearCache() {
  memoryCache.clear();
  pending.clear();
}
