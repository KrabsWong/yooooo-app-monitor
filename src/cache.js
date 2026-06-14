import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const DEFAULT_CACHE_TIME_ZONE = "Asia/Shanghai";

export async function readOrCreateDailyCache({
  cacheDir = ".cache/app-monitor",
  namespace,
  keyParts,
  sourceFiles = [],
  refresh = false,
  create,
  now = new Date(),
  timeZone = process.env.APP_MONITOR_CACHE_TIME_ZONE || process.env.TZ || DEFAULT_CACHE_TIME_ZONE
}) {
  const date = formatDailyCacheDate(now, timeZone);
  const cachePath = await buildDailyCachePath({
    cacheDir,
    namespace,
    keyParts,
    sourceFiles,
    date
  });

  if (!refresh) {
    const cached = await readCachePayload(cachePath);
    if (cached) {
      return {
        cachePath,
        date,
        hit: true,
        payload: cached
      };
    }
  }

  const payload = await create();
  try {
    await writeCachePayload(cachePath, {
      cachedAt: new Date().toISOString(),
      date,
      keyParts,
      payload
    });
  } catch (error) {
    console.warn(`Unable to write cache ${cachePath}: ${error.message}`);
  }

  return {
    cachePath,
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

export async function buildDailyCachePath({ cacheDir, namespace, keyParts, sourceFiles = [], date }) {
  const sourceHashes = [];
  for (const sourceFile of sourceFiles) {
    sourceHashes.push({
      path: resolve(sourceFile),
      hash: hashString(await readFile(sourceFile, "utf8"))
    });
  }

  const key = hashString(
    JSON.stringify({
      keyParts,
      sourceHashes
    })
  );

  return join(resolve(cacheDir), namespace, date, `${key}.json`);
}

async function readCachePayload(cachePath) {
  try {
    const cached = JSON.parse(await readFile(cachePath, "utf8"));
    return cached.payload || null;
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    return null;
  }
}

async function writeCachePayload(cachePath, payload) {
  await mkdir(dirname(cachePath), { recursive: true });
  const tempPath = `${cachePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(payload, null, 2)}\n`);
  await rename(tempPath, cachePath);
}

function hashString(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 20);
}
