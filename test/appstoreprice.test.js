import test from "node:test";
import assert from "node:assert/strict";
import { collectAppStorePriceSummary, extractAppFromHtml } from "../src/appstoreprice.js";

test("extractAppFromHtml reads app payload from Next flight scripts", () => {
  const app = {
    appStoreId: "appleone",
    name: "Apple One",
    developer: "Apple Inc.",
    subscriptions: [
      {
        subscriptionId: "appleone_individual",
        name: "Apple One Individual",
        duration: "monthly",
        prices: [
          {
            region: "IN",
            currency: "INR",
            price: 195,
            priceCny: 13.83
          }
        ]
      }
    ]
  };
  const flightPayload = JSON.stringify([1, `9:["$","div",null,{"app":${JSON.stringify(app)}}]`]);
  const html = `<script>self.__next_f.push(${flightPayload})</script>`;

  assert.deepEqual(extractAppFromHtml(html), app);
});

test("collectAppStorePriceSummary ignores React Flight token descriptions", async () => {
  const originalFetch = globalThis.fetch;
  const app = {
    appStoreId: "chatgpt",
    name: "ChatGPT",
    developer: "OpenAI OpCo, LLC",
    category: "Productivity",
    description: "$7b",
    subscriptions: []
  };
  const flightPayload = JSON.stringify([1, `9:["$","div",null,{"app":${JSON.stringify(app)},"subscriptions":[]}]`]);
  const html = `<script>self.__next_f.push(${flightPayload})</script>`;

  globalThis.fetch = async () => new Response(html, { status: 200 });

  try {
    const summary = await collectAppStorePriceSummary({
      target: {
        appId: "chatgpt",
        platform: "ios"
      }
    });

    assert.equal(summary.description, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
