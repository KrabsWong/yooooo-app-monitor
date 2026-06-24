import { collectTargetSnapshot } from "./appstore.js";
import { collectAppStorePriceTargetSnapshot, usesAppStorePriceSource } from "./appstoreprice.js";
import { fetchExchangeRates } from "./exchange.js";

export async function collectSnapshot({
  config,
  baseCurrency,
  countryOverride,
  concurrency,
  targetAppId
} = {}) {
  if (!config) {
    throw new Error("collectSnapshot requires a parsed monitor config");
  }

  const normalizedBaseCurrency = (baseCurrency || config.baseCurrency || "CNY").toUpperCase();
  const normalizedConcurrency = Number(concurrency || config.concurrency || 4);
  const exchange = await fetchExchangeRates(normalizedBaseCurrency);
  const targets = [];
  const configuredTargets = targetAppId
    ? (config.targets || []).filter((target) => String(target.appId) === String(targetAppId))
    : config.targets || [];

  if (targetAppId && !configuredTargets.length) {
    throw new Error(`Unknown appId: ${targetAppId}`);
  }

  for (const target of configuredTargets) {
    let targetSnapshot = usesAppStorePriceSource(target)
      ? await collectAppStorePriceTargetSnapshot({
          target,
          exchange,
          countryOverride
        })
      : await collectTargetSnapshot({
          target,
          exchange,
          countryOverride,
          concurrency: normalizedConcurrency
        });

    if (!usesAppStorePriceSource(target) && !targetSnapshot.subscriptionPlans.length) {
      targetSnapshot = await collectAppStorePriceFallback({
        target,
        exchange,
        countryOverride,
        currentSnapshot: targetSnapshot
      });
    }

    targets.push(targetSnapshot);
  }

  return {
    generatedAt: new Date().toISOString(),
    baseCurrency: normalizedBaseCurrency,
    exchange,
    targets
  };
}

async function collectAppStorePriceFallback({ target, exchange, countryOverride, currentSnapshot }) {
  try {
    const fallbackSnapshot = await collectAppStorePriceTargetSnapshot({
      target,
      exchange,
      countryOverride
    });

    return shouldUseAppStorePriceFallback({
      currentSnapshot,
      fallbackSnapshot,
      countryOverride
    })
      ? fallbackSnapshot
      : currentSnapshot;
  } catch {
    return currentSnapshot;
  }
}

export function shouldUseAppStorePriceFallback({ currentSnapshot, fallbackSnapshot, countryOverride }) {
  if (!fallbackSnapshot.subscriptionPlans.length) {
    return false;
  }

  const explicitCountryFilter = Boolean(countryOverride?.length);
  const requestedAllCountries = !explicitCountryFilter && currentSnapshot.requestedCountryCount > 1;

  if (requestedAllCountries && fallbackSnapshot.countryCount <= 1) {
    return false;
  }

  return true;
}
