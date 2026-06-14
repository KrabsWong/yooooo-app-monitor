const EXCHANGE_API_BASE = "https://open.er-api.com/v6/latest";

export async function fetchExchangeRates(baseCurrency = "CNY") {
  const normalizedBase = baseCurrency.toUpperCase();
  const response = await fetch(`${EXCHANGE_API_BASE}/${encodeURIComponent(normalizedBase)}`, {
    headers: {
      "accept": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Exchange rate request failed: HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload.result !== "success" || !payload.rates) {
    throw new Error(`Exchange rate response was not successful: ${payload.result || "unknown"}`);
  }

  return {
    provider: payload.provider || "open.er-api.com",
    baseCurrency: normalizedBase,
    updatedAt: payload.time_last_update_utc || null,
    nextUpdateAt: payload.time_next_update_utc || null,
    rates: payload.rates
  };
}
