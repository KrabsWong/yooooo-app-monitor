import test from "node:test";
import assert from "node:assert/strict";
import { buildProductComparisons } from "../src/comparison.js";

test("buildProductComparisons groups subscription variants by plan name and period", () => {
  const groups = buildProductComparisons(
    [
      {
        country: "US",
        countryName: "United States",
        status: "ok",
        inAppPurchases: [
          {
            name: "Google AI Pro (5 TB)",
            salableAdamId: "6736380797",
            offerName: "com.google.gemini.2tb.ai.m.1month_eft",
            billingPeriod: "P1M",
            currency: "USD",
            priceFormatted: "$19.99",
            priceAmount: 19.99,
            baseCurrency: "CNY",
            priceInBase: 135.46
          },
          {
            name: "Google AI Pro (5 TB)",
            salableAdamId: "6736380395",
            offerName: "com.google.gemini.2tb.ai.m",
            billingPeriod: "P1M",
            currency: "USD",
            priceFormatted: "$17.99",
            priceAmount: 17.99,
            baseCurrency: "CNY",
            priceInBase: 121.91
          }
        ]
      },
      {
        country: "JP",
        countryName: "Japan",
        status: "ok",
        inAppPurchases: [
          {
            name: "Google AI Pro (5 TB)",
            salableAdamId: "6736380395",
            offerName: "com.google.gemini.2tb.ai.m",
            billingPeriod: "P1M",
            currency: "JPY",
            priceFormatted: "JPY 2,900",
            priceAmount: 2900,
            baseCurrency: "CNY",
            priceInBase: 122.81
          }
        ]
      }
    ],
    (purchase) => Boolean(purchase.billingPeriod)
  );

  assert.equal(groups.length, 1);
  assert.equal(groups[0].key, "subscription:google ai pro (5 tb):P1M");
  assert.equal(groups[0].countryCount, 2);
  assert.deepEqual(
    groups[0].prices.map((price) => [price.country, price.localPrice]),
    [
      ["US", "$17.99"],
      ["JP", "JPY 2,900"]
    ]
  );
});
