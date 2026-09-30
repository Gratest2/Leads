# Niche Radar

A Danish clinic opportunity-analysis prototype built with Next.js and TypeScript. It requires no account, payment, external API, or cloud service for the demo.

## Run locally

```powershell
npm install
npm run dev
```

Open http://localhost:3000.

## V1 architecture

- `src/lib/radar.ts` defines Places, website-crawler, Search, Google Ads, and Meta provider contracts, result shapes, data-quality signals, and mock/unavailable adapters.
- `src/lib/radar-config.ts` owns the editable opportunity-score weights (25/25/15/15/10/5/5).
- `src/app/api/data-sources/route.ts` reports whether required environment variables are present without returning secret values.
- `src/app/radar-app.tsx` owns the scan, profile, and dashboard flow. Approved treatments and scan results are saved in browser `localStorage`.
- Suggested treatments remain pending until explicitly approved. Scores normalize over available signals only; missing signals are excluded and lower the separate data-confidence percentage.
- Local clinic count, website-topic coverage, Search competition, Google Ads competition, and Meta ad competition are stored as separate signals.
- `BrowserKeywordPlannerCache` caches Keyword Planner responses in browser storage for 24 hours. `CrawlOptions` requires robots.txt compliance, same-origin links, a page limit, and a minimum delay.
- Google result counts and monthly keyword volume are separate measurements.

## Demo data and integrations

Website analysis and competitor discovery are mocked. The illustrative competitor list is test data, not verified local businesses, and loads only when a scan is run. Search, Google Ads, and Meta responses are unavailable until provider implementations and access are configured.

The Data Sources page shows `Nøgler konfigureret` when the required environment variables exist; this does not test credentials or imply a live provider is connected. Use `.env.example` as a local template and never commit `.env.local`.

Real competitor discovery needs a Places implementation. Public-page analysis needs a crawler that obeys `robots.txt` and rate limits. Search-result counts need a legitimate Search API, monthly keyword metrics need Google Ads API access and OAuth authorization, and Meta Ad Library access may be restricted. Implement providers behind their interfaces; the app remains usable with the mock or unavailable adapters.

## Checks

```powershell
npm run lint
npm run build
```
