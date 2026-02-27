# RetroCast – Forecast vs Reality

A single-page web app that compares **weather forecasts** with **actual observed weather** for the last 3 days at any location worldwide. No server, no API key, no build step — just open `index.html`.

![Vanilla JS](https://img.shields.io/badge/Vanilla-JS-f7df1e?style=flat-square)
![No build](https://img.shields.io/badge/Build-None-green?style=flat-square)
![Open-Meteo](https://img.shields.io/badge/API-Open--Meteo-blue?style=flat-square)

## How It Works

1. **You pick a location** — search by city name (with autocomplete) or detect via browser geolocation.
2. **Two API calls** cover the last 3 days in parallel:
   - **Archive API** (`archive-api.open-meteo.com`) → actual observed weather
   - **Historical Forecast API** (`historical-forecast-api.open-meteo.com`) → what the model predicted *before* each day
3. **Comparison engine** scores each day across three dimensions:
   - **Temperature** — average absolute error of max/min temps (graded A–D)
   - **Precipitation** — did-it-rain match + amount error
   - **Condition** — weather category match (clear/cloudy/rain/snow/…)
4. **Overall accuracy** is a weighted composite: 40% temp + 40% precip + 20% condition, displayed as a percentage inside an animated SVG ring gauge.
5. A **summary bar** above the cards shows the 3-day average accuracy.

Data loads instantly — no need to use the app for days first, because the Historical Forecast API provides archived model forecasts going back to 2022.

## Features

- **3-day comparison cards** with forecast vs actual side-by-side, animated circular gauges
- **City search** with debounced autocomplete (up to 5 results)
- **Geolocation** detection with one click
- **Favorites** — save up to 8 locations, switch with a click (persisted in localStorage)
- **Dark mode** — auto-follows OS / browser preference
- **Responsive** — 3 breakpoints (desktop / tablet / phone)
- **Skeleton loading** shimmer cards while data is fetched
- **Retry on failure** — exponential backoff with per-card error states
- **No server state** — everything is client-side; localStorage stores active location + favorites
- **ES modules** — clean `import`/`export` architecture, no globals
- **Lucide SVG icons** — consistent, scalable, dark-mode-friendly
- **Inter font** via Google Fonts

## Quick Start

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

> **Firefox note:** Geolocation requires HTTPS or `localhost`.

## File Structure

```
index.html                  Entry point (single HTML file)
styles/main.css             All styles (dark mode, responsive, animations)
scripts/
  app.js                    Bootstrap (ES module entry)
  constants.js              WMO codes, API URLs, localStorage keys, limits
  utils.js                  Date formatting, debounce, retry, helpers
  api-service.js            Open-Meteo API wrapper (4 endpoints)
  storage-manager.js        localStorage: active location, favorites, banner
  comparison-engine.js      Scoring logic + batch fetch-and-compare
  ui-controller.js          DOM: search, favorites, cards, gauges, errors
```

## API Endpoints Used

| Endpoint | Purpose |
|---|---|
| `geocoding-api.open-meteo.com/v1/search` | City search / autocomplete |
| `archive-api.open-meteo.com/v1/archive` | Actual observed weather (daily) |
| `historical-forecast-api.open-meteo.com/v1/forecast` | Archived model forecast (daily) |
| `api.open-meteo.com/v1/forecast` | Current forecast (fallback, not used in main flow) |

All endpoints are free, require no API key, and have no strict rate limits for reasonable usage.

## localStorage Keys

| Key | Content |
|---|---|
| `retrocast_active_location` | Last selected `{ name, country, latitude, longitude }` |
| `retrocast_favorites` | Array of saved locations (max 8) |
| `retrocast_banner_closed` | Whether the info banner was dismissed |

## License

MIT
