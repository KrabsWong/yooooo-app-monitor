#!/usr/bin/env node
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { collectAppList } from "./apps.js";
import { readOrCreateDailyCache } from "./cache.js";
import { readMonitorConfig } from "./node-config.js";
import { collectSnapshot } from "./snapshot.js";

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};
const CACHE_SCHEMA_VERSION = "2026-06-17-description-token-filter-v1";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const port = Number(args.port || process.env.PORT || 5173);
  const configPath = resolve(args.config || "config/monitors.example.json");
  const cacheDir = resolve(args.cacheDir || process.env.APP_MONITOR_CACHE_DIR || ".cache/app-monitor");
  const dev = Boolean(args.dev);
  const vite = dev
    ? await import("vite").then(({ createServer }) =>
        createServer({
          root,
          appType: "spa",
          server: { middlewareMode: true }
        })
      )
    : null;
  const distDir = resolve(root, "dist");
  const activeAppLists = new Map();
  const activeSnapshots = new Map();

  const server = http.createServer(async (request, response) => {
    try {
      const handledApi = await handleApiRequest(request, response, {
        configPath,
        cacheDir,
        activeAppLists,
        activeSnapshots
      });

      if (handledApi) {
        return;
      }

      if (vite) {
        vite.middlewares(request, response, () => {
          response.statusCode = 404;
          response.end("Not found");
        });
        return;
      }

      await serveStatic(request, response, distDir);
    } catch (error) {
      sendJson(response, 500, {
        error: error.message || "Internal server error"
      });
    }
  });

  const actualPort = await listenWithFallback(server, port);
  console.log(`App Store price monitor listening on http://localhost:${actualPort}`);
}

async function handleApiRequest(request, response, { configPath, cacheDir, activeAppLists, activeSnapshots }) {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  if (url.pathname !== "/api/snapshot" && url.pathname !== "/api/apps") {
    return false;
  }

  if (request.method !== "GET" && request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed" });
    return true;
  }

  const countries = url.searchParams.get("countries");
  const baseCurrency = url.searchParams.get("baseCurrency");
  const concurrency = url.searchParams.get("concurrency");
  const targetAppId = url.searchParams.get("appId");
  const refresh = isRefreshRequested(url);
  const countryOverride = countries ? countries.split(",").map((country) => country.trim()).filter(Boolean) : null;
  const normalizedCountryOverride = countryOverride
    ? Array.from(new Set(countryOverride.map((country) => country.toUpperCase()))).sort()
    : null;

  if (url.pathname === "/api/apps") {
    const country = (url.searchParams.get("country") || "US").toUpperCase();
    const activeKey = JSON.stringify({
      country,
      refresh
    });
    let activeAppList = activeAppLists.get(activeKey);
    if (!activeAppList) {
      activeAppList = readOrCreateDailyCache({
        cacheDir,
        namespace: "apps",
        keyParts: {
          cacheSchemaVersion: CACHE_SCHEMA_VERSION,
          country
        },
        sourceFiles: [configPath],
        refresh,
        create: async () =>
          collectAppList({
            config: await readMonitorConfig(configPath),
            country,
            concurrency
          })
      }).finally(() => {
        activeAppLists.delete(activeKey);
      });
      activeAppLists.set(activeKey, activeAppList);
    }

    const result = await activeAppList;
    sendJson(response, 200, result.payload, cacheHeaders(result, refresh));
    return true;
  }

  const activeKey = JSON.stringify({
    appId: targetAppId || null,
    baseCurrency: baseCurrency || null,
    countries: normalizedCountryOverride || null,
    refresh
  });

  let activeSnapshot = activeSnapshots.get(activeKey);
  if (!activeSnapshot) {
    activeSnapshot = readOrCreateDailyCache({
      cacheDir,
      namespace: "snapshots",
      keyParts: {
        cacheSchemaVersion: CACHE_SCHEMA_VERSION,
        appId: targetAppId || null,
        baseCurrency: baseCurrency ? baseCurrency.toUpperCase() : null,
        countries: normalizedCountryOverride || null
      },
      sourceFiles: [configPath],
      refresh,
      create: async () =>
        collectSnapshot({
          config: await readMonitorConfig(configPath),
          baseCurrency,
          countryOverride,
          concurrency,
          targetAppId
        })
    }).finally(() => {
      activeSnapshots.delete(activeKey);
    });
    activeSnapshots.set(activeKey, activeSnapshot);
  }

  const result = await activeSnapshot;
  sendJson(response, 200, result.payload, cacheHeaders(result, refresh));
  return true;
}

async function serveStatic(request, response, distDir) {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const pathname = decodeURIComponent(url.pathname);
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = resolve(distDir, `.${requestedPath}`);

  if (!filePath.startsWith(distDir)) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      throw new Error("Not a file");
    }
    streamFile(response, filePath);
  } catch {
    streamFile(response, resolve(distDir, "index.html"));
  }
}

function streamFile(response, filePath) {
  response.writeHead(200, {
    "content-type": MIME_TYPES[extname(filePath)] || "application/octet-stream"
  });
  createReadStream(filePath).pipe(response);
}

function sendJson(response, statusCode, payload, headers = {}) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    ...headers
  });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function cacheHeaders(result, refresh) {
  return {
    "x-app-monitor-cache": refresh ? "refresh" : result.hit ? "hit" : "miss",
    "x-app-monitor-cache-date": result.date
  };
}

function isRefreshRequested(url) {
  const refresh = url.searchParams.get("refresh");
  return refresh === "1" || refresh === "true" || refresh === "yes";
}

function listenWithFallback(server, preferredPort) {
  return new Promise((resolveListen, rejectListen) => {
    let port = preferredPort;

    function tryListen() {
      server.once("error", onError);
      server.listen(port, "0.0.0.0", () => {
        server.off("error", onError);
        resolveListen(port);
      });
    }

    function onError(error) {
      server.off("error", onError);
      if (error.code === "EADDRINUSE" && port < preferredPort + 20) {
        port += 1;
        tryListen();
        return;
      }
      rejectListen(error);
    }

    tryListen();
  });
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
