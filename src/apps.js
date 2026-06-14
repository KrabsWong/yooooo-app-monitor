import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { lookupApp } from "./appstore.js";
import { collectAppStorePriceSummary, usesAppStorePriceSource } from "./appstoreprice.js";

export async function collectAppList({ configPath = "config/monitors.example.json", country = "US", concurrency } = {}) {
  const resolvedConfigPath = resolve(configPath);
  const config = JSON.parse(await readFile(resolvedConfigPath, "utf8"));
  const targets = config.targets || [];
  const normalizedConcurrency = Number(concurrency || config.concurrency || 4);
  const normalizedCountry = String(country || "US").toUpperCase();
  const apps = await mapWithConcurrency(targets, normalizedConcurrency, (target) =>
    collectAppSummary({ target, country: normalizedCountry })
  );

  return {
    generatedAt: new Date().toISOString(),
    baseCurrency: (config.baseCurrency || "CNY").toUpperCase(),
    apps
  };
}

async function collectAppSummary({ target, country }) {
  if (usesAppStorePriceSource(target)) {
    return collectAppStorePriceSummary({ target });
  }

  let lookup = null;
  let error = null;

  try {
    lookup = await lookupApp(target.appId, country);
  } catch (lookupError) {
    error = lookupError.message;
  }

  if (!lookup) {
    try {
      return await collectAppStorePriceSummary({ target });
    } catch {
      // Keep the App Store lookup result below if the metadata fallback is also unavailable.
    }
  }

  return {
    name: target.name || lookup?.trackName || target.appId,
    platform: target.platform || "ios",
    appId: target.appId,
    iconUrl: target.iconUrl || lookup?.artworkUrl100 || lookup?.artworkUrl60 || lookup?.artworkUrl512 || null,
    description: normalizeDescription(target.description) || normalizeDescription(lookup?.description),
    artistName: lookup?.artistName || null,
    primaryGenreName: lookup?.primaryGenreName || null,
    country,
    status: lookup ? "ok" : "partial",
    error
  };
}

function normalizeDescription(description) {
  if (typeof description !== "string") {
    return null;
  }

  return description.replace(/\s+/g, " ").trim() || null;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(Number(concurrency) || 1, items.length));

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}
