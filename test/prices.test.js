import test from "node:test";
import assert from "node:assert/strict";
import { parseBillingPeriod, parseBuyParams, convertToBase } from "../src/prices.js";

test("parseBuyParams extracts Apple internal price units", () => {
  const parsed = parseBuyParams(
    "productType=A&price=19990&salableAdamId=6448311597&offerName=oai_chatgpt_plus_1999_1m"
  );

  assert.equal(parsed.productType, "A");
  assert.equal(parsed.salableAdamId, "6448311597");
  assert.equal(parsed.priceAmount, 19.99);
  assert.equal(parsed.offerName, "oai_chatgpt_plus_1999_1m");
});

test("parseBillingPeriod handles month and year suffixes", () => {
  assert.equal(parseBillingPeriod("oai_chatgpt_plus_1999_1m"), "P1M");
  assert.equal(parseBillingPeriod("oai_chatgpt_plus_20000_1y"), "P1Y");
  assert.equal(parseBillingPeriod("com.anthropic.claude.pro.monthly.ios"), "P1M");
  assert.equal(parseBillingPeriod("com.anthropic.claude.pro.yearly.ios"), "P1Y");
  assert.equal(parseBillingPeriod("com.anthropic.claude.max_20250402_5x.monthly.ios"), "P1M");
  assert.equal(parseBillingPeriod("com.google.gemini.2tb.ai.m"), "P1M");
  assert.equal(parseBillingPeriod("com.google.gemini.2tb.ai.m.1month_eft"), "P1M");
  assert.equal(parseBillingPeriod("com.google.gemini.30tb.ai.pro.m.3months_ip_50p"), "P1M");
  assert.equal(parseBillingPeriod("example.3months"), "P3M");
  assert.equal(parseBillingPeriod("100_credits_400_chatgpt"), null);
});

test("convertToBase converts quote currency to base currency", () => {
  const exchange = {
    baseCurrency: "CNY",
    rates: {
      USD: 0.147569
    }
  };

  assert.equal(convertToBase(19.99, "USD", exchange), 135.46);
});
