# IT News InfoScreen

Browser-based fullscreen IT news dashboard for office TVs, optimized for Norway-based teams with content in Norwegian and English. The application now builds as a static site for GitHub Pages instead of starting as a packaged `.exe`.

## Features

- Build-time news aggregation using the existing backend feed logic.
- Generated static JSON consumed directly by the browser app.
- Fullscreen TV-friendly dashboard with rotating story highlights and QR codes.
- Automatic client reload at 03:30 Europe/Oslo after 24 hours of uptime.
- GitHub Pages deployment workflow with scheduled refreshes.

## Project Structure

```text
it-news-infoscreen/
  .github/workflows/
    deploy-pages.yml
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
  frontend/
    public/
      data/
        news.json
    src/
      components/
      hooks/
      utils/
      App.jsx
      main.jsx
      styles.css
    index.html
    vite.config.js
  scripts/
    generate-static-news.mjs
  package.json
```

## Install

```bash
cd C:\Repos\it-news-infoscreen
npm install
npm install --prefix backend
npm install --prefix frontend
```

## Build For Browser

```bash
npm run build
```

This does two things:

- Fetches and normalizes the latest news into `frontend/public/data/news.json`
- Builds the static site into `frontend/dist`

## Preview Locally

```bash
npm run preview --prefix frontend
```

Open:

- `http://localhost:4173/it-news-infoscreen/`

## GitHub Pages Deployment

The included workflow publishes the site to:

- `https://tennetno.github.io/it-news-infoscreen/`

Deployment triggers:

- Push to `main`
- Manual `workflow_dispatch`
- Hourly scheduled rebuilds to refresh the generated news data

To use it in GitHub:

1. Push this repository to GitHub.
2. In the repository settings, open `Pages`.
3. Set the source to `GitHub Actions`.
4. Push to `main` or run the workflow manually.

## Data Format

The generated `frontend/public/data/news.json` file contains:

- `builtAt`
- `items`
- `sourceStats`

Each item contains:

- `id`
- `title`
- `source_name`
- `source_url`
- `published_at`
- `language`
- `category`
- `summary`
- `qr_url`

## Source Configuration

Edit `backend/src/config/sources.json`.

After changing sources, rebuild with:

```bash
npm run build
```

## Optional Backend Development

The Node backend is still available for local development work:

```bash
npm run dev
```

- Frontend dev server: `http://localhost:5173`
- Backend API: `http://localhost:8080`

## Notes

- GitHub Pages is static-only, so the previous server-side cookie authentication flow is not part of the deployed Pages version.
- The backend remains in the repo and is reused during the build step to generate the static news file.
- For TV usage, open the GitHub Pages URL in the browser and enable kiosk or fullscreen mode there.
