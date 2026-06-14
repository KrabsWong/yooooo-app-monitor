import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { collectTargetSnapshot } from "./appstore.js";
import { collectAppStorePriceTargetSnapshot, usesAppStorePriceSource } from "./appstoreprice.js";
import { fetchExchangeRates } from "./exchange.js";

export async function collectSnapshot({
  configPath = "config/monitors.example.json",
  baseCurrency,
  countryOverride,
  concurrency,
  targetAppId
} = {}) {
  const resolvedConfigPath = resolve(configPath);
  const config = JSON.parse(await readFile(resolvedConfigPath, "utf8"));
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

    return fallbackSnapshot.subscriptionPlans.length ? fallbackSnapshot : currentSnapshot;
  } catch {
    return currentSnapshot;
  }
}
