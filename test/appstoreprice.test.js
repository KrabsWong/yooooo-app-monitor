import test from "node:test";
import assert from "node:assert/strict";
import { extractAppFromHtml } from "../src/appstoreprice.js";

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
