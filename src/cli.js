#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { readMonitorConfig } from "./node-config.js";
import { buildMarkdownReport } from "./report.js";
import { collectSnapshot } from "./snapshot.js";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const configPath = resolve(args.config || "config/monitors.example.json");
  const outPrefix = resolve(args.out || "outputs/appstore-prices");
  const countryOverride = args.countries ? args.countries.split(",").map((item) => item.trim()).filter(Boolean) : null;
  const config = await readMonitorConfig(configPath);
  const snapshot = await collectSnapshot({
    config,
    baseCurrency: args.baseCurrency,
    countryOverride,
    concurrency: args.concurrency
  });

  const jsonPath = `${outPrefix}.json`;
  const markdownPath = `${outPrefix}.md`;

  await mkdir(dirname(jsonPath), { recursive: true });
  await writeFile(jsonPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, buildMarkdownReport(snapshot), "utf8");

  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${markdownPath}`);
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      continue;
    }

    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    index += 1;
  }
  return args;
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
