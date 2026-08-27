# Currency Tracker Backend

Central NestJS service for collecting, validating, and publishing currency rates against SYP. Public clients only read deterministic `PublishedRate` records; source content and AI extraction details remain internal.

## Back4App Web Deployment

The repository includes a production Dockerfile for Back4App Containers. Use
port `8080`, health check path `/api/v1/rates`, and set these environment
variables in the Back4App dashboard:

```text
AI_PROVIDER=gemini
GEMINI_API_KEY=your-secret-key
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta
GEMINI_MODEL=gemini-3.1-flash-lite
GEMINI_TIMEOUT_MS=30000
GEMINI_MAX_OUTPUT_TOKENS=4096
COLLECTION_INTERVAL_MS=1800000
COLLECT_ON_STARTUP=true
OBSERVATION_MAX_AGE_MINUTES=90
OUTLIER_THRESHOLD_PERCENT=3
SOURCE_FETCH_TIMEOUT_MS=15000
SOURCE_CONTENT_MAX_CHARS=50000
```

Do not add `DATABASE_URL` or `PORT` in the dashboard; the container configures
both. The free container filesystem is suitable for a demo, but SQLite data can
be reset when the container is replaced or redeployed. On startup, the image
creates a fresh seeded database and immediately starts a collection run.

## Local setup

```bash
npm install
copy .env.example .env
npx prisma generate
npm run db:setup
npm run start:dev
```

Set `AI_PROVIDER=gemini` and `GEMINI_API_KEY` in `.env` before running a collection. Gemini is the default; DeepSeek remains an optional fallback. Models, API base URLs, timeouts, collection interval, freshness window, and outlier threshold are configurable. Never commit `.env`.

The development database is SQLite. Prisma keeps the data layer isolated so the datasource and adapter can later be changed to PostgreSQL.

## Public API

```text
GET /api/v1/rates
GET /api/v1/rates/USD
```

The database intentionally starts without fake published rates. The list endpoint returns `rates: []` until a successful collection publishes validated observations. A missing single currency returns HTTP 404.

## Collection pipeline

Known public sources (`SP Today` and `SYPNow`) are fetched through independent adapters. Cleaned public page text is sent to the configured AI provider with a JSON-only, no-fabrication prompt. All requested currencies are extracted in one structured request per source to conserve free-tier quota. Valid observations are normalized to `NEW_SYP`, rejected when stale, filtered using a configurable median-deviation threshold, and published using independent buy/sell medians.

The scheduler defaults to 30 minutes. `CollectionSchedulerService.refreshNow()` is the internal entry point intended for a future authenticated admin action. It is deliberately not exposed as an unauthenticated public endpoint.

After configuring the selected provider key, trigger the same pipeline immediately with:

```bash
npm run collect:now
```

Only a content hash, source URL, short relevant excerpt, fetch time, and extraction JSON are retained; full HTML pages are not stored.

## Permanent free Cloudflare deployment

The same repository also contains a Cloudflare Worker version under
`src/cloudflare`. It exposes the same public endpoints used by Flutter, stores
published rates and collection audit records in D1, and refreshes SP Today every
30 minutes using a Cron Trigger. SP Today is parsed deterministically in this
version, so Gemini is not required for the Cloudflare deployment.

After signing in to Cloudflare with Wrangler:

```bash
npm run cf:d1:create
npm run cf:d1:remote
npx wrangler secret put COLLECT_SECRET
npm run cf:deploy
```

`cf:d1:create` adds the new D1 binding to `wrangler.jsonc`. After deployment,
trigger the first collection without waiting for the next Cron run:

```bash
curl -X POST "https://currency-tracker-backend.YOUR-SUBDOMAIN.workers.dev/api/v1/collect" \
  -H "Authorization: Bearer YOUR_COLLECT_SECRET"
```

Then verify `GET /api/v1/rates` and paste the Worker URL into the Flutter app at
Settings > Server connection. Keep `COLLECT_SECRET` private; the public rates
endpoints do not require authentication.

## Commands

```bash
npm run build
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run lint
npx prisma migrate status
```
