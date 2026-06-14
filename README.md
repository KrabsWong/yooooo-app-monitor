# App Store Price Monitor

App Store Price Monitor collects visible App Store app metadata and in-app purchase prices across storefront regions, converts local prices into a base currency, and compares global prices by offer.

The web dashboard is built with React, Vite, Tailwind CSS, shadcn/ui, and lucide icons.

| page | screenshot |
|:------:|:----------:|
| Home | <img width="1251" height="862" alt="image" src="https://github.com/user-attachments/assets/c6168c67-b184-432f-88f4-270d7a45c981" /> |
| Detail | <img width="1243" height="879" alt="image" src="https://github.com/user-attachments/assets/96ba9ee8-4848-4886-97a8-9e094b245144" /> | 

## Features

- Multi-app dashboard with app icons, descriptions, and app-level refresh.
- Lazy price collection: the app directory loads first, and price data is fetched when an app detail page is opened.
- Daily successful-response cache for app summaries and per-app price snapshots.
- Global storefront collection using known App Store storefront IDs.
- Unsupported or unavailable countries are filtered from the final price output.
- Subscription plans and one-time in-app purchases are normalized into comparable offers.
- Country / region price tables are sorted by converted base price, with the lowest market highlighted.
- Local price, local currency, converted base price, median, average, highest, and spread are shown per offer.

## Requirements

- Node.js 22 or newer
- pnpm 11.x

## Install

```bash
pnpm install
```

## Run The Web Dashboard

```bash
pnpm dev
```

Open `http://localhost:5173`.

The app list is available at `/apps`. Opening `/apps/:appId` loads that app's current price snapshot on demand.

## Build And Serve

```bash
pnpm build
pnpm serve
```

## Deploy To Cloudflare

The Cloudflare version runs as a Worker with Static Assets for the Vite build and Workers KV for daily successful-response caching.

```bash
pnpm install
pnpm build
pnpm exec wrangler login
pnpm exec wrangler kv namespace create APP_MONITOR_CACHE
```

Copy the returned namespace `id` into `wrangler.jsonc`, then deploy:

```bash
pnpm deploy:cloudflare
```

The Worker serves the same routes as local development:

- `/apps` and `/apps/:appId` are served from `dist`.
- `/api/apps` and `/api/snapshot` run on the Worker.
- `APP_MONITOR_CACHE` stores daily cached app lists and per-app snapshots.

## CLI Collection

Run the configured collection job:

```bash
pnpm collect
```

Run only a subset of countries:

```bash
node src/cli.js --config config/monitors.example.json --countries US,JP,GB --out outputs/app-prices
```

## Configuration

The example config is in `config/monitors.example.json`.

Each target can provide:

```json
{
  "name": "Some App",
  "platform": "ios",
  "appId": "123456789",
  "countries": "all",
  "storefronts": {
    "US": "143441,29"
  }
}
```

`countries: "all"` attempts every known storefront in `src/storefronts.js`.

## Cache

The local server keeps daily file caches under `.cache/app-monitor/`.

- `/api/apps` caches the app directory after the first successful request of the day.
- `/api/snapshot?appId=...` caches each app price snapshot by app, country filter, and base currency.
- `refresh=1` bypasses the current day's cache and overwrites it after a successful request.
- Cache dates use `APP_MONITOR_CACHE_TIME_ZONE`, `TZ`, or `Asia/Shanghai` by default.

Generated cache and output files are ignored by git.

## Data Sources

- iTunes lookup API: app availability, metadata, artwork, currency, and download price.
- App Store product page JSON: visible in-app purchase rows under `pageData.addOns`.
- App Store Price pages: fallback structured subscription data when Apple product data is insufficient.
- Exchange Rate API: base-currency exchange rates.

## Output Shape

The JSON snapshot keeps per-country raw prices and comparison groups:

- `targets[].countries`: supported countries only.
- `targets[].filteredCountryCount`: countries removed because they were unsupported, unavailable, or incomplete.
- `targets[].subscriptionPlans`: subscription products grouped by normalized plan and billing period.
- `targets[].oneTimePurchases`: non-subscription in-app products such as consumables, bundles, credits, and game items.

The web UI merges subscription plans and one-time purchases into a single offer selector for comparison.

## Development

```bash
pnpm test
pnpm build
```

## License

This project is licensed under the GNU Affero General Public License v3.0 only. See `LICENSE`.
