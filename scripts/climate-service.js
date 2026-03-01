/**
 * RetroCast – Climate Service
 * Fetches historical archive data for the same calendar period across multiple
 * past years and computes per-day climate normals (median values).
 *
 * Strategy: for a date range like Feb 24–26, 2025 we fetch Feb 24–26 for
 * each of the last CLIMATE_YEARS years and take the median per day position.
 */

import { API, getWeatherInfo } from './constants.js';
import { formatDate } from './utils.js';

const DAILY_PARAMS = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_sum',
].join(',');

const CLIMATE_YEARS = 10;

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildURL(base, params) {
  const url = new URL(base);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.reason || data.error);
  return data;
}

/** Median of a non-empty numeric array. */
function median(arr) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Pick the most frequently occurring WMO weather category among the given codes
 * and return one representative code for that category.
 */
function representativeCode(codes) {
  const counts = {};
  for (const code of codes) {
    const cat = getWeatherInfo(code).category;
    counts[cat] = (counts[cat] || 0) + 1;
  }
  const topCat = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  return codes.find(c => getWeatherInfo(c).category === topCat) ?? codes[0];
}

/**
 * Adjust a Date to targetYear, handling Feb-29 → Feb-28 for non-leap years.
 */
function dateInYear(date, year) {
  const candidate = new Date(year, date.getMonth(), date.getDate());
  if (candidate.getMonth() !== date.getMonth()) {
    // Rolled over (e.g. Feb-29 → Mar-1 in non-leap year): use last day of month
    return new Date(year, date.getMonth() + 1, 0);
  }
  return candidate;
}

async function fetchArchiveRange(lat, lon, start, end) {
  const url = buildURL(API.ARCHIVE, {
    latitude:   lat,
    longitude:  lon,
    start_date: formatDate(start),
    end_date:   formatDate(end),
    daily:      DAILY_PARAMS,
    timezone:   'auto',
  });
  const data = await fetchJSON(url);
  if (!data.daily?.time?.length) return [];
  return data.daily.time.map((t, i) => ({
    date:        t,
    weatherCode: data.daily.weather_code[i],
    tempMax:     data.daily.temperature_2m_max[i],
    tempMin:     data.daily.temperature_2m_min[i],
    precip:      data.daily.precipitation_sum[i] ?? 0,
  }));
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * For each date in [startDate .. endDate] compute a "climate normal" day object:
 * the median temperature, precipitation, and modal weather condition across
 * the last CLIMATE_YEARS years for the same calendar period.
 *
 * Returns an array of day objects (or null entries for dates with insufficient data).
 */
export async function fetchClimateNormals(lat, lon, startDate, endDate) {
  const start = startDate instanceof Date ? startDate : new Date(startDate + 'T00:00:00');
  const end   = endDate   instanceof Date ? endDate   : new Date(endDate   + 'T00:00:00');
  const numDays = Math.round((end - start) / 86400000) + 1;

  // Build an array of Date objects for each day in the original range
  const dates = Array.from({ length: numDays }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });

  const currentYear = start.getFullYear();

  // Fetch equivalent date range for each of the past CLIMATE_YEARS years in parallel
  const yearFetches = Array.from({ length: CLIMATE_YEARS }, (_, i) => {
    const targetYear = currentYear - (i + 1);
    const ys = dateInYear(dates[0],           targetYear);
    const ye = dateInYear(dates[numDays - 1], targetYear);
    return fetchArchiveRange(lat, lon, ys, ye).catch(() => []);
  });

  const allYearsData = await Promise.all(yearFetches);

  // For each day position, aggregate data points across years
  return dates.map((originalDate, dayIdx) => {
    const points = allYearsData
      .map(yr => yr[dayIdx])
      .filter(dp => dp && dp.tempMax !== null && dp.tempMin !== null);

    if (points.length < 3) return null; // not enough historical data

    const tempMax  = parseFloat(median(points.map(p => p.tempMax)).toFixed(1));
    const tempMin  = parseFloat(median(points.map(p => p.tempMin)).toFixed(1));
    const precip   = parseFloat(median(points.map(p => p.precip)).toFixed(1));
    const code     = representativeCode(points.map(p => p.weatherCode));

    return {
      date:        formatDate(originalDate),
      weatherCode: code,
      weather:     getWeatherInfo(code),
      temperature: { max: tempMax, min: tempMin },
      precipitation: { sum: precip, hours: 0, probability: null },
    };
  });
}
