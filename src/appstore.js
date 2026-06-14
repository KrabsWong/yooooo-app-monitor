import { enrichTargetWithComparisons } from "./comparison.js";
import { normalizeAddOn, normalizeDownloadOffer } from "./prices.js";
import { ALL_STOREFRONT_COUNTRIES, resolveStorefront } from "./storefronts.js";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/17.0 Safari/605.1.15";

export async function lookupApp(appId, country) {
  const normalizedCountry = country.toLowerCase();
  const url = new URL("https://itunes.apple.com/lookup");
  url.searchParams.set("id", appId);
  url.searchParams.set("country", normalizedCountry);

  const response = await fetch(url, {
    headers: {
      "accept": "application/json",
      "user-agent": USER_AGENT
    }
  });

  if (!response.ok) {
    throw new Error(`Lookup failed for ${country}: HTTP ${response.status}`);
  }

  const payload = await response.json();
  return payload.results?.[0] || null;
}

export async function fetchStorefrontProduct(appId, countryCode, storefrontHeader) {
  const url = `https://apps.apple.com/${countryCode.toLowerCase()}/app/id${encodeURIComponent(appId)}`;
  const response = await fetch(url, {
    headers: {
      "accept": "application/json, text/javascript, */*; q=0.01",
      "user-agent": USER_AGENT,
      "x-apple-store-front": storefrontHeader
    }
  });

  if (!response.ok) {
    const error = new Error(`Storefront product request failed: HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

export function extractProduct(payload, appId) {
  return payload?.storePlatformData?.["product-dv"]?.results?.[appId] || null;
}

export async function collectCountrySnapshot({ target, country, exchange }) {
  const normalizedCountry = country.toUpperCase();
  const result = {
    country: normalizedCountry,
    countryName: null,
    status: "ok",
    app: null,
    downloadOffer: null,
    inAppPurchases: [],
    dataSources: {
      lookup: "pending",
      storefrontProduct: "pending"
    },
    errors: []
  };

  let lookup;
  try {
    lookup = await lookupApp(target.appId, normalizedCountry);
  } catch (error) {
    result.status = "error";
    result.dataSources.lookup = "error";
    result.errors.push({ source: "lookup", message: error.message });
  }

  if (!lookup) {
    result.status = result.status === "error" ? "error" : "unavailable";
    result.dataSources.lookup = result.dataSources.lookup === "error" ? "error" : "not_found";
    result.dataSources.storefrontProduct = "skipped";
    return result;
  }

  result.dataSources.lookup = "ok";
  result.app = {
    appId: String(lookup.trackId || target.appId),
    name: lookup.trackName || target.name || null,
    bundleId: lookup.bundleId || null,
    artistName: lookup.artistName || null,
    platformKind: lookup.kind || null,
    currency: lookup.currency || null,
    formattedPrice: lookup.formattedPrice || null,
    price: typeof lookup.price === "number" ? lookup.price : null,
    version: lookup.version || null,
    trackViewUrl: lookup.trackViewUrl || null,
    iconUrl: lookup.artworkUrl100 || lookup.artworkUrl60 || lookup.artworkUrl512 || null,
    description: normalizeDescription(lookup.description)
  };

  const storefront = resolveStorefront(normalizedCountry, target.storefronts || {});
  if (!storefront) {
    result.dataSources.storefrontProduct = "missing_storefront_mapping";
    result.status = "unsupported";
    return result;
  }

  result.countryName = storefront.label;

  try {
    const payload = await fetchStorefrontProduct(target.appId, storefront.countryCode, storefront.header);
    const product = extractProduct(payload, target.appId);
    result.dataSources.storefrontProduct = "ok";
    result.storefront = {
      countryCode: storefront.countryCode,
      header: storefront.header,
      label: storefront.label,
      source: storefront.source,
      appleTimestamp: payload?.properties?.timestamp || null
    };

    const currency = result.app.currency;
    const firstOffer = product?.offers?.[0];
    if (firstOffer) {
      result.downloadOffer = normalizeDownloadOffer(firstOffer, currency, exchange);
    }

    const addOns = Array.isArray(payload?.pageData?.addOns) ? payload.pageData.addOns : [];
    result.inAppPurchases = addOns.map((addOn) => normalizeAddOn(addOn, currency, exchange));
  } catch (error) {
    result.status = error.status === 400 || error.status === 404 ? "unavailable" : "partial";
    result.dataSources.storefrontProduct = result.status === "unavailable" ? "not_found" : "error";
    result.errors.push({
      source: "storefrontProduct",
      message: error.message,
      status: error.status || null
    });
  }

  return result;
}

export async function collectTargetSnapshot({ target, exchange, countryOverride, concurrency = 4 }) {
  const countries = resolveTargetCountries(target, countryOverride);
  const collected = await mapWithConcurrency(countries, concurrency, (country) =>
    collectCountrySnapshot({ target, country, exchange })
  );
  const results = collected.filter(isPriceSupportedCountry);
  const filteredCountryCount = collected.length - results.length;
  const representativeApp = pickRepresentativeApp(results, collected);

  return enrichTargetWithComparisons({
    name: target.name || target.appId,
    platform: target.platform || "ios",
    appId: target.appId,
    iconUrl: target.iconUrl || representativeApp?.iconUrl || null,
    description: normalizeDescription(target.description) || representativeApp?.description || null,
    requestedCountryCount: countries.length,
    filteredCountryCount,
    countries: results
  });
}

export function resolveTargetCountries(target, countryOverride) {
  if (countryOverride?.length) {
    return normalizeCountries(countryOverride);
  }

  if (!target.countries || target.countries === "all") {
    return ALL_STOREFRONT_COUNTRIES;
  }

  if (Array.isArray(target.countries) && target.countries.some((country) => String(country).toLowerCase() === "all")) {
    return ALL_STOREFRONT_COUNTRIES;
  }

  return normalizeCountries(target.countries);
}

function normalizeCountries(countries) {
  const values = typeof countries === "string" ? countries.split(",") : countries;
  return Array.from(new Set(values.map((country) => String(country).trim().toUpperCase()).filter(Boolean))).sort();
}

function pickRepresentativeApp(results, collected) {
  const countriesWithApps = [...results, ...collected].filter((country) => country.app);
  return (
    countriesWithApps.find((country) => country.country === "US")?.app ||
    countriesWithApps.find((country) => country.country === "GB")?.app ||
    countriesWithApps[0]?.app ||
    null
  );
}

function normalizeDescription(description) {
  if (typeof description !== "string") {
    return null;
  }

  return description.replace(/\s+/g, " ").trim() || null;
}

function isPriceSupportedCountry(country) {
  return (
    country.status === "ok" &&
    country.app &&
    country.dataSources.lookup === "ok" &&
    country.dataSources.storefrontProduct === "ok" &&
    (country.downloadOffer || country.inAppPurchases.length > 0)
  );
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
