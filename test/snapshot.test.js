import test from "node:test";
import assert from "node:assert/strict";
import { shouldUseAppStorePriceFallback } from "../src/snapshot.js";

test("appstoreprice fallback does not replace global collection with a single-country result", () => {
  const currentSnapshot = buildTargetSnapshot({
    requestedCountryCount: 114,
    countryCount: 0
  });
  const fallbackSnapshot = buildTargetSnapshot({
    requestedCountryCount: 1,
    countryCount: 1,
    subscriptionPlans: [buildPlan(["IN"])]
  });

  assert.equal(
    shouldUseAppStorePriceFallback({
      currentSnapshot,
      fallbackSnapshot,
      countryOverride: null
    }),
    false
  );
});

test("appstoreprice fallback can satisfy an explicit single-country request", () => {
  const currentSnapshot = buildTargetSnapshot({
    requestedCountryCount: 1,
    countryCount: 0
  });
  const fallbackSnapshot = buildTargetSnapshot({
    requestedCountryCount: 1,
    countryCount: 1,
    subscriptionPlans: [buildPlan(["IN"])]
  });

  assert.equal(
    shouldUseAppStorePriceFallback({
      currentSnapshot,
      fallbackSnapshot,
      countryOverride: ["IN"]
    }),
    true
  );
});

test("appstoreprice fallback is used when it expands coverage", () => {
  const currentSnapshot = buildTargetSnapshot({
    requestedCountryCount: 114,
    countryCount: 0
  });
  const fallbackSnapshot = buildTargetSnapshot({
    requestedCountryCount: 3,
    countryCount: 3,
    subscriptionPlans: [buildPlan(["IN", "US", "JP"])]
  });

  assert.equal(
    shouldUseAppStorePriceFallback({
      currentSnapshot,
      fallbackSnapshot,
      countryOverride: null
    }),
    true
  );
});

test("appstoreprice fallback is used when official data has markets but no subscriptions", () => {
  const currentSnapshot = buildTargetSnapshot({
    requestedCountryCount: 114,
    countryCount: 108
  });
  const fallbackSnapshot = buildTargetSnapshot({
    requestedCountryCount: 3,
    countryCount: 3,
    subscriptionPlans: [buildPlan(["IN", "US", "JP"])]
  });

  assert.equal(
    shouldUseAppStorePriceFallback({
      currentSnapshot,
      fallbackSnapshot,
      countryOverride: null
    }),
    true
  );
});

function buildTargetSnapshot({ requestedCountryCount, countryCount, subscriptionPlans = [] }) {
  return {
    requestedCountryCount,
    countryCount,
    countries: [],
    subscriptionPlans,
    oneTimePurchases: []
  };
}

function buildPlan(countries) {
  return {
    name: "ChatGPT Plus",
    countryCount: countries.length,
    prices: countries.map((country) => ({ country }))
  };
}
