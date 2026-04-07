# Lunex

A React finance dashboard inspired by the provided claymorphism reference, upgraded into an interactive product-style experience with:

- Overview, stocks, budgets, insights, and AI screens
- Claymorphism UI with loading, hover, and chart animations
- Theme switching and in-app notifications
- API-backed persistence through Express (local) and Upstash Redis (production)
- AI Advisor tab with Gemini-backed budget and savings suggestions
- Market Pulse widget powered by Twelve Data
- Stock Monitor page powered by Finnhub quotes and company profiles

## Tech Stack

- React + Vite
- Express
- Local JSON persistence
- Plain CSS with responsive claymorphism styling

## Project Structure

```text
src/                 Frontend React app
server/index.js      Local API server (JSON persistence)
server/data/         Persistent JSON state (local dev)
api/                 Vercel serverless API (KV persistence)
finance-dashboard.html  Original static reference file
```

## Run Locally

Install dependencies:

```bash
npm install
```

Start the frontend and local API together:

```bash
npm run dev
```

This runs:

- Vite frontend on `http://localhost:5173`
- Express API on `http://localhost:3001`

To enable the AI Advisor with Gemini:

1. Copy `.env.example` to `.env`
2. Add your `GEMINI_API_KEY`
3. Optionally tune `GEMINI_MODEL`, `GEMINI_MODELS`, or `GEMINI_TIMEOUT_MS` for latency/quality tradeoffs
4. Restart the dev server

To enable live market data with Twelve Data:

1. Add `TWELVE_DATA_API_KEY` to `.env`
2. Restart the server

If no key is provided, the backend attempts to use the Twelve Data `demo` fallback.

To enable the Stock Monitor page with Finnhub:

1. Add `FINNHUB_API_KEY` to `.env`
2. Restart the server

## Production Build

Build the frontend:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

The Express server will:

- serve the API at `/api/*`
- serve the built frontend from `dist/`
- return `index.html` for non-API app routes

## Vercel Deployment (Full Stack)

This project is wired for Vercel serverless APIs with Upstash Redis persistence.

1. Create a Redis database with the Vercel Upstash Redis integration.
2. In the Vercel project settings, add these environment variables:

```bash
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
GEMINI_API_KEY=
TWELVE_DATA_API_KEY=
FINNHUB_API_KEY=
```

3. Set the build command to:

```bash
npm install && npm run build
```

4. Set the output directory to `dist`.

The Vercel API routes live in `api/` and serve the same `/api/*` endpoints as the local Express server.

## API

### `GET /api/health`

Returns a simple health response.

### `GET /api/state`

Returns the full dashboard state:

- transactions
- budgets
- role
- theme
- activeTab
- goal
- notifications
- stockWatchlist

### `PUT /api/state`

Accepts a partial or full dashboard state and persists it.

### `POST /api/advisor`

Accepts a natural-language finance question and returns:

- overview
- budget suggestion
- expense cut suggestion
- goal guidance
- suggested actions

If `GEMINI_API_KEY` is missing, the backend returns a local fallback response instead of failing.

### `GET /api/market?symbol=AAPL`

Returns:

- current quote
- day change / percent change
- exchange metadata
- recent daily time series

This endpoint is powered by Twelve Data through the backend.

### `GET /api/stocks?symbols=AAPL,MSFT,NVDA`

Returns a live watchlist payload from Finnhub including:

- current quote
- day change / percent change
- company name
- exchange
- industry
- market capitalization

## Submission Notes

This project was rebuilt from the supplied HTML/PDF direction into a React application while preserving the claymorphism visual language and adding richer interactivity, chart polish, and local API persistence.

Key deliverables:

- Reusable React component structure
- Smooth UI interactions and visibility-aware animations
- Persistent state through a local backend
- Responsive dashboard layout for desktop and mobile

## Deployment

This app is ready to deploy as a single Node service.

Recommended deployment flow:

1. Run `npm install`
2. Run `npm run build`
3. Run `npm start`

The production server is already configured in `server/index.js`.

## Review Checklist

- `npm install`
- `npm run build`
- `npm start`
- Open the app and confirm API-backed edits persist after refresh
