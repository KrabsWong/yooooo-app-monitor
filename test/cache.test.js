import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { formatDailyCacheDate, readOrCreateDailyCache } from "../src/cache.js";

test("formatDailyCacheDate uses the configured time zone", () => {
  const date = new Date("2026-06-13T16:30:00.000Z");

  assert.equal(formatDailyCacheDate(date, "UTC"), "2026-06-13");
  assert.equal(formatDailyCacheDate(date, "Asia/Shanghai"), "2026-06-14");
});

test("readOrCreateDailyCache reuses same-day successful payloads", async () => {
  const cacheDir = await mkdtemp(join(tmpdir(), "app-monitor-cache-"));
  let calls = 0;
  const create = async () => ({ value: calls += 1 });
  const baseOptions = {
    cacheDir,
    namespace: "apps",
    keyParts: {
      country: "US"
    },
    timeZone: "UTC"
  };

  const first = await readOrCreateDailyCache({
    ...baseOptions,
    create,
    now: new Date("2026-06-14T01:00:00.000Z")
  });
  const second = await readOrCreateDailyCache({
    ...baseOptions,
    create,
    now: new Date("2026-06-14T23:00:00.000Z")
  });
  const refreshed = await readOrCreateDailyCache({
    ...baseOptions,
    create,
    now: new Date("2026-06-14T23:30:00.000Z"),
    refresh: true
  });
  const nextDay = await readOrCreateDailyCache({
    ...baseOptions,
    create,
    now: new Date("2026-06-15T00:01:00.000Z")
  });

  assert.equal(first.hit, false);
  assert.deepEqual(first.payload, { value: 1 });
  assert.equal(second.hit, true);
  assert.deepEqual(second.payload, { value: 1 });
  assert.equal(refreshed.hit, false);
  assert.deepEqual(refreshed.payload, { value: 2 });
  assert.equal(nextDay.hit, false);
  assert.deepEqual(nextDay.payload, { value: 3 });
});
