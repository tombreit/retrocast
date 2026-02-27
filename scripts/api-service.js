/**
 * RetroCast – API Service
 * Wraps Open-Meteo endpoints: forecast, archive, historical-forecast, geocoding.
 */

import { API, LIMITS, getWeatherInfo } from './constants.js';
import { formatDate, retry } from './utils.js';

// Shared daily parameters requested from Open-Meteo
const DAILY_PARAMS = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_sum',
  'precipitation_hours',
  'precipitation_probability_max',
].join(',');

// For archive API (no probability field available)
const DAILY_PARAMS_ARCHIVE = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_sum',
  'precipitation_hours',
].join(',');

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildURL(base, params) {
  const url = new URL(base);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return url.toString();
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  const data = await res.json();
  if (data.error) throw new Error(data.reason || data.error);
  return data;
}

/**
 * Parse a single day out of an Open-Meteo daily response.
 * @param {object} daily – the `daily` object from the response
 * @param {number} idx   – index of the day within the arrays
 * @param {boolean} hasProbability – whether precipitation_probability_max exists
 */
function parseDayData(daily, idx, hasProbability = false) {
  return {
    date:        daily.time[idx],
    weatherCode: daily.weather_code[idx],
    weather:     getWeatherInfo(daily.weather_code[idx]),
    temperature: {
      max: daily.temperature_2m_max[idx],
      min: daily.temperature_2m_min[idx],
    },
    precipitation: {
      sum:         daily.precipitation_sum[idx]   ?? 0,
      hours:       daily.precipitation_hours?.[idx] ?? 0,
      probability: hasProbability
        ? (daily.precipitation_probability_max?.[idx] ?? null)
        : null,
    },
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Search for cities by name. Returns up to LIMITS.GEOCODING_RESULTS results.
 */
export async function searchLocations(query) {
  const url = buildURL(API.GEOCODING, {
    name:     query,
    count:    LIMITS.GEOCODING_RESULTS,
    language: 'en',
    format:   'json',
  });
  const data = await retry(() => fetchJSON(url));
  if (!data.results?.length) return [];
  return data.results.map(r => ({
    name:      r.name,
    country:   r.country ?? '',
    admin1:    r.admin1 ?? '',
    latitude:  r.latitude,
    longitude: r.longitude,
  }));
}

/**
 * Fetch actual observed weather for a date range (archive API).
 * Returns an array of day objects.
 */
export async function fetchActualWeather(lat, lon, startDate, endDate) {
  const url = buildURL(API.ARCHIVE, {
    latitude:    lat,
    longitude:   lon,
    start_date:  formatDate(startDate),
    end_date:    formatDate(endDate),
    daily:       DAILY_PARAMS_ARCHIVE,
    timezone:    'auto',
  });
  const data = await retry(() => fetchJSON(url));
  if (!data.daily?.time?.length) return [];
  return data.daily.time.map((_, i) => parseDayData(data.daily, i, false));
}

/**
 * Fetch the archived model forecast for a date range (historical-forecast API).
 * This gives us what the weather model predicted *before* the day happened.
 * Returns an array of day objects.
 */
export async function fetchHistoricalForecast(lat, lon, startDate, endDate) {
  const url = buildURL(API.HISTORICAL_FORECAST, {
    latitude:    lat,
    longitude:   lon,
    start_date:  formatDate(startDate),
    end_date:    formatDate(endDate),
    daily:       DAILY_PARAMS,
    timezone:    'auto',
  });
  const data = await retry(() => fetchJSON(url));
  if (!data.daily?.time?.length) return [];
  return data.daily.time.map((_, i) => parseDayData(data.daily, i, true));
}

/**
 * Fetch today's forecast (used as fallback / for storing).
 */
export async function fetchCurrentForecast(lat, lon) {
  const url = buildURL(API.FORECAST, {
    latitude:    lat,
    longitude:   lon,
    daily:       DAILY_PARAMS,
    timezone:    'auto',
    forecast_days: 1,
  });
  const data = await retry(() => fetchJSON(url));
  if (!data.daily?.time?.length) return null;
  return parseDayData(data.daily, 0, true);
}
