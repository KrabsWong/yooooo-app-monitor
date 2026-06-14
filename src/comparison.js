export function enrichTargetWithComparisons(target) {
  const subscriptionPlans = buildProductComparisons(target.countries, (purchase) => Boolean(purchase.billingPeriod));
  const oneTimePurchases = buildProductComparisons(target.countries, (purchase) => !purchase.billingPeriod);

  return {
    ...target,
    countryCount: target.countries.length,
    subscriptionPlans,
    oneTimePurchases
  };
}

export function buildProductComparisons(countries, includePurchase) {
  const groups = new Map();

  for (const country of countries) {
    for (const purchase of country.inAppPurchases || []) {
      if (!includePurchase(purchase)) {
        continue;
      }

      const key = productGroupKey(purchase);
      const existing = groups.get(key) || {
        key,
        name: purchase.name || "Unknown product",
        salableAdamId: purchase.salableAdamId || null,
        offerName: purchase.offerName || null,
        productType: purchase.productType || null,
        billingPeriod: purchase.billingPeriod || null,
        baseCurrency: purchase.baseCurrency || null,
        countryCount: 0,
        stats: null,
        prices: []
      };

      const priceRow = {
        country: country.country,
        countryName: country.countryName || country.storefront?.label || country.country,
        status: country.status,
        currency: purchase.currency || null,
        localPrice: purchase.priceFormatted || null,
        priceAmount: purchase.priceAmount,
        baseCurrency: purchase.baseCurrency || null,
        priceInBase: purchase.priceInBase,
        offerName: purchase.offerName || null,
        salableAdamId: purchase.salableAdamId || null
      };

      const existingPriceIndex = existing.prices.findIndex((price) => price.country === priceRow.country);
      if (existingPriceIndex === -1) {
        existing.prices.push(priceRow);
      } else if (comparePrices(priceRow, existing.prices[existingPriceIndex]) < 0) {
        existing.prices[existingPriceIndex] = priceRow;
      }
      groups.set(key, existing);
    }
  }

  return Array.from(groups.values())
    .map((group) => {
      const prices = group.prices.sort(comparePrices);
      return {
        ...group,
        prices,
        countryCount: prices.length,
        stats: buildStats(prices)
      };
    })
    .sort(compareGroups);
}

export function productGroupKey(purchase) {
  if (purchase.billingPeriod) {
    return `subscription:${normalizeKeyPart(purchase.name || "unknown")}:${purchase.billingPeriod}`;
  }
  if (purchase.salableAdamId) {
    return `salable:${purchase.salableAdamId}`;
  }
  if (purchase.offerName) {
    return `offer:${purchase.offerName}`;
  }
  return `name:${purchase.name || "unknown"}:${purchase.billingPeriod || "none"}`;
}

function normalizeKeyPart(value) {
  return String(value).trim().replace(/\s+/g, " ").toLowerCase();
}

function comparePrices(left, right) {
  const leftPrice = Number.isFinite(left.priceInBase) ? left.priceInBase : Number.POSITIVE_INFINITY;
  const rightPrice = Number.isFinite(right.priceInBase) ? right.priceInBase : Number.POSITIVE_INFINITY;

  if (leftPrice !== rightPrice) {
    return leftPrice - rightPrice;
  }

  return left.country.localeCompare(right.country);
}

function compareGroups(left, right) {
  const leftPeriod = left.billingPeriod || "";
  const rightPeriod = right.billingPeriod || "";
  if (leftPeriod !== rightPeriod) {
    return leftPeriod.localeCompare(rightPeriod);
  }
  return left.name.localeCompare(right.name);
}

function buildStats(prices) {
  const numeric = prices
    .map((price) => price.priceInBase)
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);

  if (!numeric.length) {
    return {
      min: null,
      max: null,
      average: null,
      median: null,
      spread: null
    };
  }

  const min = numeric[0];
  const max = numeric[numeric.length - 1];
  const middle = Math.floor(numeric.length / 2);
  const median =
    numeric.length % 2 === 0 ? roundMoney((numeric[middle - 1] + numeric[middle]) / 2) : numeric[middle];
  const average = roundMoney(numeric.reduce((total, value) => total + value, 0) / numeric.length);

  return {
    min,
    max,
    average,
    median,
    spread: roundMoney(max - min)
  };
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
