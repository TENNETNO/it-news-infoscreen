# IT News InfoScreen

Production-ready fullscreen IT news dashboard for office TVs, optimized for Norway-based teams (content in Norwegian and English).

## Features

- Backend aggregator for RSS + official feeds + optional safe scraper.
- Normalized, deduplicated, categorized JSON API.
- Frontend fullscreen dashboard with smooth live updates without manual refresh.
- Polling strategy:
  - Top stories every 60 seconds.
  - Security/vulnerabilities every 120 seconds.
- Offline resilience:
  - Keeps last known items visible.
  - Shows online/offline indicator.
  - Exponential backoff (10s, 30s, 60s, then 120s).
- 24/7 stability:
  - Automatic soft reload at 03:30 Europe/Oslo after 24h uptime.
- TV-focused UX:
  - Large typography and high contrast.
  - Left: top story cards.
  - Right: compact security/vulnerability list.
  - Bottom: rotating ticker.
  - Auto-rotating top story highlight every 20 seconds.
- Frontend-generated QR code per card pointing to original article.

## Project Structure

```text
it-news-infoscreen/
  backend/
    src/
      config/
        index.js
        sources.json
      services/
        newsService.js
      utils/
        cache.js
        categorization.js
        dedupe.js
        scraper.js
      server.js
    package.json
  frontend/
    src/
      components/
        HeaderBar.jsx
        NewsCard.jsx
        SecurityList.jsx
        Ticker.jsx
      hooks/
        useNewsPolling.js
      utils/
        time.js
      App.jsx
      main.jsx
      styles.css
    index.html
    vite.config.js
    package.json
  package.json
```

## Run Locally

### 1) Install dependencies

```bash
cd C:\Repos\it-news-infoscreen
npm install
npm install --prefix backend
npm install --prefix frontend
```

### 2) Start backend + frontend

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8080`

## API Endpoints

- `GET /api/health`
- `GET /api/news?limit=50`
- `GET /api/news/summary`

Optional category filter:

- `GET /api/news?limit=25&category=security,outages`

## News Item Schema

Every item contains:

- `id`
- `title`
- `source_name`
- `source_url`
- `published_at`
- `language` (`no` or `en`)
- `category` (`security`, `cloud`, `microsoft`, `ai`, `norway`, `outages`)
- `summary`
- `qr_url`

## Sources Configuration

Edit `backend/src/config/sources.json`.

Each source supports:

- `id`
- `enabled`
- `type` (`rss`, `nvd`, `scrape`)
- `name`
- `url`
- `language`
- `country`
- `cache_ttl_sec`

Included starter sources:

- Digi.no RSS
- Tek.no RSS
- Computerworld Norge RSS
- NSM alerts scraper (optional, disabled by default)
- CISA advisories and alerts feeds
- NVD NIST CVE endpoint
- The Register feed
- Hacker News (hnrss.org) [disabled by default]

## Add a New RSS Feed

1. Open `backend/src/config/sources.json`.
2. Add a new object in `sources`:

```json
{
  "id": "example-rss",
  "enabled": true,
  "type": "rss",
  "name": "Example Source",
  "url": "https://example.com/rss.xml",
  "language": "en",
  "country": "INTL",
  "cache_ttl_sec": 180
}
```

3. Restart backend.

## Deduplication and Tagging

- Deduplication uses:
  - Canonical link comparison.
  - Normalized title similarity (Jaccard threshold).
- If duplicates are found, earliest `published_at` is kept.
- Category tagging uses rule keywords for:
  - `security`, `cloud`, `microsoft`, `devops`, `ai`, `norway`, `outages`.

## Sample Screen Description (No Images)

1. Header: large Oslo time/date on the left, last updated + online/offline on the right.
2. Main layout:
   - Left panel: top story cards with title, summary, source, time-ago, language badge, QR.
   - Right panel: compact security list with source, time-ago, language badge, QR.
3. Bottom ticker: rotating short headlines across all categories.

## Production Notes

- Run frontend browser in kiosk/fullscreen mode.
- Run backend as a process service (PM2, NSSM, systemd equivalent).
- Optionally place a reverse proxy in front for office LAN deployment.
- No paid APIs and no secrets required by default.

