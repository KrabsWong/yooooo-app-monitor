import monitorConfig from "../config/monitors.example.json";
import { collectAppList } from "./apps.js";
import { readOrCreateDailyKvCache } from "./edge-cache.js";
import { collectSnapshot } from "./snapshot.js";

const CACHE_SCHEMA_VERSION = "2026-06-17-description-token-filter-v1";
const activeAppLists = new Map();
const activeSnapshots = new Map();

export default {
  async fetch(request, env) {
    try {
      const apiResponse = await handleApiRequest(request, env);
      if (apiResponse) {
        return apiResponse;
      }

      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }

      return new Response("Not found", { status: 404 });
    } catch (error) {
      return sendJson(500, {
        error: error.message || "Internal server error"
      });
    }
  }
};

async function handleApiRequest(request, env) {
  const url = new URL(request.url);
  if (url.pathname !== "/api/snapshot" && url.pathname !== "/api/apps") {
    return null;
  }

  if (request.method !== "GET" && request.method !== "POST") {
    return sendJson(405, { error: "Method not allowed" });
  }

  const countries = url.searchParams.get("countries");
  const baseCurrency = url.searchParams.get("baseCurrency");
  const concurrency = url.searchParams.get("concurrency") || env.APP_MONITOR_CONCURRENCY;
  const targetAppId = url.searchParams.get("appId");
  const refresh = isRefreshRequested(url);
  const countryOverride = countries ? countries.split(",").map((country) => country.trim()).filter(Boolean) : null;
  const normalizedCountryOverride = countryOverride
    ? Array.from(new Set(countryOverride.map((country) => country.toUpperCase()))).sort()
    : null;

  if (url.pathname === "/api/apps") {
    const country = (url.searchParams.get("country") || "US").toUpperCase();
    const activeKey = JSON.stringify({
      country,
      refresh
    });
    let activeAppList = activeAppLists.get(activeKey);
    if (!activeAppList) {
      activeAppList = readOrCreateDailyKvCache({
        kv: env.APP_MONITOR_CACHE,
        namespace: "apps",
        keyParts: {
          cacheSchemaVersion: CACHE_SCHEMA_VERSION,
          country
        },
        config: monitorConfig,
        refresh,
        timeZone: env.APP_MONITOR_CACHE_TIME_ZONE,
        create: () =>
          collectAppList({
            config: monitorConfig,
            country,
            concurrency
          })
      }).finally(() => {
        activeAppLists.delete(activeKey);
      });
      activeAppLists.set(activeKey, activeAppList);
    }

    const result = await activeAppList;
    return sendJson(200, result.payload, cacheHeaders(result, refresh));
  }

  const activeKey = JSON.stringify({
    appId: targetAppId || null,
    baseCurrency: baseCurrency || null,
    countries: normalizedCountryOverride || null,
    refresh
  });

  let activeSnapshot = activeSnapshots.get(activeKey);
  if (!activeSnapshot) {
    activeSnapshot = readOrCreateDailyKvCache({
      kv: env.APP_MONITOR_CACHE,
      namespace: "snapshots",
      keyParts: {
        cacheSchemaVersion: CACHE_SCHEMA_VERSION,
        appId: targetAppId || null,
        baseCurrency: baseCurrency ? baseCurrency.toUpperCase() : null,
        countries: normalizedCountryOverride || null
      },
      config: monitorConfig,
      refresh,
      timeZone: env.APP_MONITOR_CACHE_TIME_ZONE,
      create: () =>
        collectSnapshot({
          config: monitorConfig,
          baseCurrency,
          countryOverride,
          concurrency,
          targetAppId
        })
    }).finally(() => {
      activeSnapshots.delete(activeKey);
    });
    activeSnapshots.set(activeKey, activeSnapshot);
  }

  const result = await activeSnapshot;
  return sendJson(200, result.payload, cacheHeaders(result, refresh));
}

function sendJson(statusCode, payload, headers = {}) {
  return new Response(`${JSON.stringify(payload, null, 2)}\n`, {
    status: statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers
    }
  });
}

function cacheHeaders(result, refresh) {
  return {
    "x-app-monitor-cache": refresh ? "refresh" : result.hit ? "hit" : "miss",
    "x-app-monitor-cache-date": result.date
  };
}

function isRefreshRequested(url) {
  const refresh = url.searchParams.get("refresh");
  return refresh === "1" || refresh === "true" || refresh === "yes";
}
