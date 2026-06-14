import { enrichTargetWithComparisons } from "./comparison.js";
import { convertToBase, roundMoney } from "./prices.js";
import { resolveStorefront } from "./storefronts.js";

const APPSTOREPRICE_BASE = "https://appstoreprice.org/en/apps";

export function usesAppStorePriceSource(target) {
  return target?.source === "appstoreprice" || !/^\d+$/.test(String(target?.appId || ""));
}

export async function collectAppStorePriceSummary({ target }) {
  const app = await fetchAppStorePriceApp(target.appId);

  return {
    name: target.name || app.name || target.appId,
    platform: target.platform || "ios",
    appId: target.appId,
    iconUrl: target.iconUrl || app.iconUrl || null,
    description: normalizeDescription(target.description) || normalizeDescription(app.description),
    artistName: app.developer || null,
    primaryGenreName: app.category || null,
    country: "appstoreprice",
    status: "ok",
    error: null
  };
}

export async function collectAppStorePriceTargetSnapshot({ target, exchange, countryOverride }) {
  const app = await fetchAppStorePriceApp(target.appId);
  const selectedCountries = countryOverride?.length
    ? new Set(countryOverride.map((country) => String(country).toUpperCase()))
    : null;
  const countryMap = new Map();

  for (const subscription of app.subscriptions || []) {
    for (const price of subscription.prices || []) {
      const country = String(price.region || "").toUpperCase();
      if (!country || (selectedCountries && !selectedCountries.has(country))) {
        continue;
      }

      const existing = countryMap.get(country) || {
        country,
        countryName: resolveCountryName(country, price.regionName),
        status: "ok",
        app: null,
        downloadOffer: null,
        inAppPurchases: [],
        dataSources: {
          lookup: "appstoreprice",
          storefrontProduct: "appstoreprice"
        },
        errors: []
      };

      existing.inAppPurchases.push({
        name: subscription.name || subscription.subscriptionId || "Subscription",
        priceFormatted: formatLocalPrice(price.price, price.currency),
        priceAmount: typeof price.price === "number" ? price.price : null,
        currency: price.currency || null,
        baseCurrency: exchange.baseCurrency,
        priceInBase: convertAppStorePriceToBase(price, exchange),
        salableAdamId: null,
        offerName: subscription.subscriptionId || null,
        productType: subscription.type || "subscription",
        billingPeriod: normalizeDuration(subscription.duration),
        buyParams: null
      });

      countryMap.set(country, existing);
    }
  }

  const countries = Array.from(countryMap.values()).sort((first, second) => first.country.localeCompare(second.country));
  const requestedCountryCount = selectedCountries ? selectedCountries.size : countries.length;

  return enrichTargetWithComparisons({
    name: target.name || app.name || target.appId,
    platform: target.platform || "ios",
    appId: target.appId,
    iconUrl: target.iconUrl || app.iconUrl || null,
    description: normalizeDescription(target.description) || normalizeDescription(app.description),
    requestedCountryCount,
    filteredCountryCount: Math.max(0, requestedCountryCount - countries.length),
    countries
  });
}

export async function fetchAppStorePriceApp(appId) {
  const url = `${APPSTOREPRICE_BASE}/${encodeURIComponent(appId)}`;
  const response = await fetch(url, {
    headers: {
      accept: "text/html"
    }
  });

  if (!response.ok) {
    throw new Error(`App Store Price request failed for ${appId}: HTTP ${response.status}`);
  }

  const html = await response.text();
  const app = extractAppFromHtml(html);
  if (!app) {
    throw new Error(`Unable to find App Store Price app payload for ${appId}`);
  }

  return app;
}

export function extractAppFromHtml(html) {
  const scriptMatches = html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g);

  for (const match of scriptMatches) {
    const script = match[1];
    if (!script.startsWith("self.__next_f.push(") || !script.includes('\\"subscriptions\\"')) {
      continue;
    }

    let payload;
    try {
      payload = JSON.parse(script.slice("self.__next_f.push(".length, -1));
    } catch {
      continue;
    }

    for (const value of payload.filter((item) => typeof item === "string")) {
      if (!value.includes('"app":{') || !value.includes('"subscriptions"')) {
        continue;
      }

      const appJson = extractObjectAfter(value, '"app":');
      if (!appJson) {
        continue;
      }

      return JSON.parse(appJson);
    }
  }

  return null;
}

function extractObjectAfter(text, marker) {
  const markerIndex = text.indexOf(marker);
  if (markerIndex < 0) {
    return null;
  }

  const start = text.indexOf("{", markerIndex + marker.length);
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
}

function convertAppStorePriceToBase(price, exchange) {
  if (Number.isFinite(price.priceCny)) {
    return convertToBase(price.priceCny, "CNY", exchange);
  }
  if (Number.isFinite(price.priceUsd)) {
    return convertToBase(price.priceUsd, "USD", exchange);
  }
  return null;
}

function normalizeDuration(duration) {
  const labels = {
    daily: "P1D",
    weekly: "P1W",
    monthly: "P1M",
    yearly: "P1Y",
    annual: "P1Y"
  };
  return labels[String(duration || "").toLowerCase()] || null;
}

function formatLocalPrice(amount, currency) {
  if (!Number.isFinite(amount)) {
    return currency || null;
  }

  return `${currency || ""} ${roundMoney(amount).toLocaleString()}`.trim();
}

function resolveCountryName(country, fallback) {
  return resolveStorefront(country)?.label || fallback || country;
}

function normalizeDescription(description) {
  if (typeof description !== "string") {
    return null;
  }

  return description.replace(/\s+/g, " ").trim() || null;
}
