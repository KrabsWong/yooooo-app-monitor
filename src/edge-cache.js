const DEFAULT_CACHE_TIME_ZONE = "Asia/Shanghai";
const DEFAULT_CACHE_TTL_SECONDS = 60 * 60 * 24 * 14;

export async function readOrCreateDailyKvCache({
  kv,
  namespace,
  keyParts,
  config,
  refresh = false,
  create,
  now = new Date(),
  timeZone = DEFAULT_CACHE_TIME_ZONE,
  ttlSeconds = DEFAULT_CACHE_TTL_SECONDS
}) {
  const date = formatDailyCacheDate(now, timeZone);
  const cacheKey = await buildDailyKvCacheKey({
    namespace,
    keyParts,
    config,
    date
  });

  if (!refresh && kv) {
    const cached = await kv.get(cacheKey, { type: "json" });
    if (cached?.payload) {
      return {
        cacheKey,
        date,
        hit: true,
        payload: cached.payload
      };
    }
  }

  const payload = await create();

  if (kv) {
    try {
      await kv.put(
        cacheKey,
        JSON.stringify({
          cachedAt: new Date().toISOString(),
          date,
          keyParts,
          payload
        }),
        { expirationTtl: ttlSeconds }
      );
    } catch (error) {
      console.warn(`Unable to write KV cache ${cacheKey}: ${error.message}`);
    }
  }

  return {
    cacheKey,
    date,
    hit: false,
    payload
  };
}

export function formatDailyCacheDate(date, timeZone = DEFAULT_CACHE_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function buildDailyKvCacheKey({ namespace, keyParts, config, date }) {
  const key = await hashString(
    JSON.stringify({
      config,
      keyParts
    })
  );
  return `${namespace}:${date}:${key}`;
}

async function hashString(value) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 20);
}
