export function parseBuyParams(buyParams = "") {
  const params = new URLSearchParams(buyParams);
  const rawPrice = params.get("price");
  const priceAmount = rawPrice == null ? null : Number(rawPrice) / 1000;

  return {
    productType: params.get("productType"),
    salableAdamId: params.get("salableAdamId"),
    pricingParameters: params.get("pricingParameters"),
    offerName: params.get("offerName"),
    appAdamId: params.get("appAdamId"),
    rawPrice: rawPrice == null ? null : Number(rawPrice),
    priceAmount: Number.isFinite(priceAmount) ? priceAmount : null
  };
}

export function parseBillingPeriod(offerName = "") {
  const tokens = String(offerName)
    .split(/[._-]+/)
    .map((token) => token.toLowerCase())
    .filter(Boolean);
  const shorthandToken = tokens.find((token) => /^[dwmy]$/.test(token));
  if (shorthandToken) {
    return formatPeriod("1", shorthandToken);
  }

  const compactMatch = offerName.match(/(?:^|[._-])(\d+)([dwmy])(?:$|[._-])/i);
  if (compactMatch) {
    const [, count, unit] = compactMatch;
    return formatPeriod(count, unit);
  }

  const compactWordToken = tokens.find((token) =>
    /^\d+(daily|day|days|weekly|week|weeks|monthly|month|months|quarterly|quarter|quarters|yearly|annual|annually|year|years)$/.test(
      token
    )
  );
  if (compactWordToken) {
    const [, count, unit] = compactWordToken.match(
      /^(\d+)(daily|day|days|weekly|week|weeks|monthly|month|months|quarterly|quarter|quarters|yearly|annual|annually|year|years)$/
    );
    return formatWordPeriod(count, unit);
  }

  const wordMatch = offerName.match(
    /(?:^|[._-])(daily|day|days|weekly|week|weeks|monthly|month|months|quarterly|quarter|quarters|yearly|annual|annually|year|years)(?:$|[._-])/i
  );
  if (!wordMatch) {
    return null;
  }

  return formatWordPeriod("1", wordMatch[1]);
}

function formatWordPeriod(count, unit) {
  const wordMap = {
    daily: "D",
    day: "D",
    days: "D",
    weekly: "W",
    week: "W",
    weeks: "W",
    monthly: "M",
    month: "M",
    months: "M",
    quarterly: "M",
    quarter: "M",
    quarters: "M",
    yearly: "Y",
    annual: "Y",
    annually: "Y",
    year: "Y",
    years: "Y"
  };
  const normalizedUnit = unit.toLowerCase();
  const normalizedCount = normalizedUnit === "quarterly" || normalizedUnit === "quarter" || normalizedUnit === "quarters" ? 3 : count;
  const periodUnit = wordMap[normalizedUnit];

  return periodUnit ? `P${normalizedCount}${periodUnit}` : null;
}

function formatPeriod(count, unit) {
  const unitMap = {
    d: "D",
    w: "W",
    m: "M",
    y: "Y"
  };

  return `P${count}${unitMap[unit.toLowerCase()]}`;
}

export function convertToBase(amount, currency, exchange) {
  if (amount == null || !currency || !exchange) {
    return null;
  }

  const normalizedCurrency = currency.toUpperCase();
  const normalizedBase = exchange.baseCurrency.toUpperCase();

  if (normalizedCurrency === normalizedBase) {
    return roundMoney(amount);
  }

  const rate = exchange.rates[normalizedCurrency];
  if (!rate) {
    return null;
  }

  return roundMoney(amount / rate);
}

export function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function normalizeAddOn(addOn, currency, exchange) {
  const buyParams = parseBuyParams(addOn.buyParams);
  const amount = buyParams.priceAmount;

  return {
    name: addOn.name || null,
    priceFormatted: addOn.price || null,
    priceAmount: amount,
    currency,
    baseCurrency: exchange.baseCurrency,
    priceInBase: convertToBase(amount, currency, exchange),
    salableAdamId: buyParams.salableAdamId,
    offerName: buyParams.offerName,
    productType: buyParams.productType,
    billingPeriod: parseBillingPeriod(buyParams.offerName || ""),
    buyParams: addOn.buyParams || null
  };
}

export function normalizeDownloadOffer(offer, currency, exchange) {
  const amount = typeof offer?.price === "number" ? offer.price : null;

  return {
    type: offer?.type || null,
    priceFormatted: offer?.priceFormatted || null,
    priceAmount: amount,
    currency,
    baseCurrency: exchange.baseCurrency,
    priceInBase: convertToBase(amount, currency, exchange)
  };
}
