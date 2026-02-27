/**
 * RetroCast – Shared Constants
 * Consolidated WMO weather codes, API URLs, localStorage keys, and design tokens.
 */

// ── API Base URLs ────────────────────────────────────────────────────────────
export const API = {
  FORECAST:            'https://api.open-meteo.com/v1/forecast',
  ARCHIVE:             'https://archive-api.open-meteo.com/v1/archive',
  HISTORICAL_FORECAST: 'https://historical-forecast-api.open-meteo.com/v1/forecast',
  GEOCODING:           'https://geocoding-api.open-meteo.com/v1/search',
};

// ── localStorage Keys ────────────────────────────────────────────────────────
export const STORAGE_KEYS = {
  ACTIVE_LOCATION: 'retrocast_active_location',
  FAVORITES:       'retrocast_favorites',
  FORECAST_PREFIX: 'retrocast_forecast_',
  BANNER_CLOSED:   'retrocast_banner_closed',
};

// ── Limits ───────────────────────────────────────────────────────────────────
export const LIMITS = {
  MAX_FAVORITES:       8,
  FORECAST_MAX_DAYS:   7,   // auto-cleanup threshold
  COMPARE_DAYS:        3,   // how many past days we show
  GEOCODING_RESULTS:   5,   // results per search
  RETRY_ATTEMPTS:      3,
  RETRY_BASE_DELAY_MS: 500,
};

// ── WMO Weather Codes ────────────────────────────────────────────────────────
// Single source of truth — previously triplicated across api-service & utils.
export const WEATHER_CODES = {
  0:  { icon: 'sun',              description: 'Clear sky',                category: 'clear' },
  1:  { icon: 'sun',              description: 'Mainly clear',            category: 'clear' },
  2:  { icon: 'cloud-sun',        description: 'Partly cloudy',           category: 'clear' },
  3:  { icon: 'cloud',            description: 'Overcast',                category: 'cloudy' },
  45: { icon: 'cloud-fog',        description: 'Fog',                     category: 'fog' },
  48: { icon: 'cloud-fog',        description: 'Depositing rime fog',     category: 'fog' },
  51: { icon: 'cloud-drizzle',    description: 'Light drizzle',           category: 'rain' },
  53: { icon: 'cloud-drizzle',    description: 'Moderate drizzle',        category: 'rain' },
  55: { icon: 'cloud-drizzle',    description: 'Dense drizzle',           category: 'rain' },
  56: { icon: 'cloud-drizzle',    description: 'Light freezing drizzle',  category: 'rain' },
  57: { icon: 'cloud-drizzle',    description: 'Dense freezing drizzle',  category: 'rain' },
  61: { icon: 'cloud-rain',       description: 'Slight rain',             category: 'rain' },
  63: { icon: 'cloud-rain',       description: 'Moderate rain',           category: 'rain' },
  65: { icon: 'cloud-rain-wind',  description: 'Heavy rain',              category: 'rain' },
  66: { icon: 'cloud-rain',       description: 'Light freezing rain',     category: 'rain' },
  67: { icon: 'cloud-rain-wind',  description: 'Heavy freezing rain',     category: 'rain' },
  71: { icon: 'cloud-snow',       description: 'Slight snow fall',        category: 'snow' },
  73: { icon: 'cloud-snow',       description: 'Moderate snow fall',      category: 'snow' },
  75: { icon: 'cloud-snow',       description: 'Heavy snow fall',         category: 'snow' },
  77: { icon: 'snowflake',        description: 'Snow grains',             category: 'snow' },
  80: { icon: 'cloud-rain',       description: 'Slight rain showers',     category: 'showers' },
  81: { icon: 'cloud-rain',       description: 'Moderate rain showers',   category: 'showers' },
  82: { icon: 'cloud-rain-wind',  description: 'Violent rain showers',    category: 'showers' },
  85: { icon: 'cloud-snow',       description: 'Slight snow showers',     category: 'snow' },
  86: { icon: 'cloud-snow',       description: 'Heavy snow showers',      category: 'snow' },
  95: { icon: 'cloud-lightning',   description: 'Thunderstorm',            category: 'thunderstorm' },
  96: { icon: 'cloud-lightning',   description: 'Thunderstorm with slight hail', category: 'thunderstorm' },
  99: { icon: 'cloud-lightning',   description: 'Thunderstorm with heavy hail',  category: 'thunderstorm' },
};

// Fallback for unknown codes
export const WEATHER_CODE_DEFAULT = { icon: 'help-circle', description: 'Unknown', category: 'unknown' };

/**
 * Look up a WMO weather code. Always returns a valid object.
 */
export function getWeatherInfo(code) {
  return WEATHER_CODES[code] ?? WEATHER_CODE_DEFAULT;
}
