/**
 * RetroCast – Comparison Engine
 * Compares historical forecast vs actual observed weather and produces accuracy metrics.
 */

import { fetchActualWeather, fetchHistoricalForecast } from './api-service.js';
import { formatDate, daysAgo } from './utils.js';
import { LIMITS, getWeatherInfo } from './constants.js';

// ── Scoring helpers (private) ────────────────────────────────────────────────

const RATINGS = [
  { min: 3.5, grade: 'A', label: 'Excellent' },
  { min: 2.5, grade: 'B', label: 'Good' },
  { min: 1.5, grade: 'C', label: 'Fair' },
  { min: 0,   grade: 'D', label: 'Poor' },
];

function scoreToRating(pts) {
  for (const r of RATINGS) {
    if (pts >= r.min) return r;
  }
  return RATINGS[RATINGS.length - 1];
}

function ratingLabelToPoints(label) {
  const map = { Excellent: 4, Good: 3, Fair: 2, Poor: 1 };
  return map[label] ?? 0;
}

// ── Temperature accuracy ─────────────────────────────────────────────────────

function calcTemperature(forecast, actual) {
  const maxErr = Math.abs(forecast.temperature.max - actual.temperature.max);
  const minErr = Math.abs(forecast.temperature.min - actual.temperature.min);
  const avgErr = (maxErr + minErr) / 2;

  let score;
  if (avgErr <= 1)      score = 'A';
  else if (avgErr <= 2) score = 'B';
  else if (avgErr <= 4) score = 'C';
  else                  score = 'D';

  const rating = scoreToRating({ A: 4, B: 3, C: 2, D: 1 }[score]);

  return { maxError: maxErr, minError: minErr, avgError: avgErr, score, rating: rating.label };
}

// ── Precipitation accuracy ───────────────────────────────────────────────────

function calcPrecipitation(forecast, actual) {
  const fRain = forecast.precipitation.sum > 0.1;
  const aRain = actual.precipitation.sum > 0.1;
  const correct = fRain === aRain;

  const amountErr = Math.abs(forecast.precipitation.sum - actual.precipitation.sum);
  const pctErr = actual.precipitation.sum > 0
    ? (amountErr / actual.precipitation.sum) * 100
    : (forecast.precipitation.sum > 0.1 ? 100 : 0);

  let accuracy;
  if (correct && amountErr < 0.5)      accuracy = 'Perfect';
  else if (correct && amountErr < 2)   accuracy = 'Excellent';
  else if (correct && amountErr < 5)   accuracy = 'Good';
  else if (correct)                    accuracy = 'Fair';
  else if (amountErr < 2)             accuracy = 'Poor';
  else                                 accuracy = 'Incorrect';

  return { correct, accuracy, amountError: amountErr, percentageError: pctErr };
}

// ── Condition accuracy ───────────────────────────────────────────────────────

function calcCondition(forecast, actual) {
  const fCat = getWeatherInfo(forecast.weatherCode).category;
  const aCat = getWeatherInfo(actual.weatherCode).category;
  const match = fCat === aCat;

  let confidence;
  if (match) confidence = 'High';
  else if (
    (fCat === 'clear' && aCat === 'cloudy') ||
    (fCat === 'cloudy' && aCat === 'clear') ||
    (fCat === 'rain' && aCat === 'showers') ||
    (fCat === 'showers' && aCat === 'rain')
  ) {
    confidence = 'Medium';
  } else {
    confidence = 'Low';
  }

  return {
    match,
    confidence,
    forecastCode: forecast.weatherCode,
    actualCode:   actual.weatherCode,
    forecastCategory: fCat,
    actualCategory:   aCat,
  };
}

// ── Overall score ────────────────────────────────────────────────────────────

function calcOverall(temp, precip, cond) {
  const tempPts   = ratingLabelToPoints(temp.rating);
  const precipPts = ratingLabelToPoints(precip.accuracy === 'Perfect' ? 'Excellent' : precip.accuracy);
  const condPts   = cond.match ? 4 : (cond.confidence === 'Medium' ? 2 : 0);

  // Weighted: 40% temp, 40% precip, 20% condition
  const weighted = tempPts * 0.4 + precipPts * 0.4 + condPts * 0.2;
  const pct = Math.round((weighted / 4) * 100);
  const rating = scoreToRating(weighted);

  return {
    score:      rating.grade,
    rating:     rating.label,
    percentage: pct,
    points:     weighted,
  };
}

// ── Statistical median helpers ───────────────────────────────────────────────

function calculateMedian(values) {
  if (values.length === 0) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  } else {
    return sorted[middle];
  }
}

function calculateWeatherConditionMedian(dailyData) {
  // Count frequency of each weather category
  const categoryCount = {};
  dailyData.forEach(day => {
    const category = getWeatherInfo(day.weatherCode).category;
    categoryCount[category] = (categoryCount[category] || 0) + 1;
  });
  
  // Find category with highest frequency
  let maxCount = 0;
  let dominantCategory = 'unknown';
  for (const [category, count] of Object.entries(categoryCount)) {
    if (count > maxCount) {
      maxCount = count;
      dominantCategory = category;
    }
  }
  
  return dominantCategory;
}

// ── Public: compare one day with statistical median ────────────────────────────

export function compareForecastToActualWithMedian(forecast, actual, medianStats) {
  const temperature   = calcTemperature(forecast, actual);
  const precipitation = calcPrecipitation(forecast, actual);
  const condition     = calcCondition(forecast, actual);
  const overall       = calcOverall(temperature, precipitation, condition);
  
  // Add statistical comparison
  const temperatureDiff = Math.abs(forecast.temperature.max - medianStats.temperature);
  const precipitationDiff = Math.abs(forecast.precipitation.sum - medianStats.precipitation);
  
  // Calculate how forecast compares to median (as percentage of median value)
  const tempMedianPercentage = medianStats.temperature > 0 
    ? (temperatureDiff / medianStats.temperature) * 100 
    : 0;
    
  const precipMedianPercentage = medianStats.precipitation > 0 
    ? (precipitationDiff / medianStats.precipitation) * 100 
    : 0;
  
  return { 
    temperature, 
    precipitation, 
    condition, 
    overall,
    medianComparison: {
      temperature: { diff: temperatureDiff, percentage: tempMedianPercentage },
      precipitation: { diff: precipitationDiff, percentage: precipMedianPercentage },
      condition: {
        forecastCategory: getWeatherInfo(forecast.weatherCode).category,
        medianCategory: medianStats.weatherCategory,
        match: getWeatherInfo(forecast.weatherCode).category === medianStats.weatherCategory
      }
    }
  };
}

// ── Public: compare one day ──────────────────────────────────────────────────

export function compareForecastToActual(forecast, actual) {
  const temperature   = calcTemperature(forecast, actual);
  const precipitation = calcPrecipitation(forecast, actual);
  const condition     = calcCondition(forecast, actual);
  const overall       = calcOverall(temperature, precipitation, condition);

  return { temperature, precipitation, condition, overall };
}

// ── Public: fetch + compare for N past days ──────────────────────────────────

/**
 * For a given location, fetch the last `LIMITS.COMPARE_DAYS` days and return
 * an array of { date, dayLabel, forecast, actual, accuracy } objects.
 *
 * Each entry may have `error` instead if that particular day failed.
 */
export async function fetchAndCompareAll(location) {
  const { latitude: lat, longitude: lon } = location;
  const days = LIMITS.COMPARE_DAYS;

  // date range: 3 days ago … yesterday
  const startDate = daysAgo(days);
  const endDate   = daysAgo(1);

  // Fetch both datasets in parallel – one call each covers all 3 days
  const [actuals, forecasts] = await Promise.all([
    fetchActualWeather(lat, lon, startDate, endDate),
    fetchHistoricalForecast(lat, lon, startDate, endDate),
  ]);

  // Build a lookup by date string
  const actualMap   = Object.fromEntries(actuals.map(d => [d.date, d]));
  const forecastMap = Object.fromEntries(forecasts.map(d => [d.date, d]));

  const results = [];
  for (let i = days; i >= 1; i--) {
    const date = formatDate(daysAgo(i));
    const actual   = actualMap[date];
    const forecast = forecastMap[date];

    if (actual && forecast) {
      const accuracy = compareForecastToActual(forecast, actual);
      results.push({ date, daysAgo: i, forecast, actual, accuracy });
    } else {
      results.push({
        date,
        daysAgo: i,
        error: !actual ? 'Actual weather data not yet available' : 'Forecast data not available',
      });
    }
  }

  return results;
}

// ── Public: fetch historical data for a specific month to calculate medians ────

/**
 * Fetch historical weather data for a specific month across multiple years
 * to compute statistical medians.
 */
export async function fetchMonthlyHistoricalData(lat, lon, month) {
  // We'll fetch data for a range of years (2010-2023) for the given month
  const years = [];
  for (let year = 2010; year <= 2023; year++) {
    years.push(year);
  }
  
  const allData = [];
  
  // Fetch data for each year in the range
  for (const year of years) {
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    // Get end date - last day of the month
    const endDate = `${year}-${month.toString().padStart(2, '0')}-${getDaysInMonth(month, year)}`;
    
    try {
      const yearData = await fetchActualWeather(lat, lon, startDate, endDate);
      allData.push(...yearData);
    } catch (error) {
      console.warn(`Could not fetch data for ${year}, skipping`);
      // Continue with other years
    }
  }
  
  return allData;
}

// Helper function to get number of days in a month
function getDaysInMonth(month, year) {
  return new Date(year, month, 0).getDate();
}

/**
 * Calculate statistical medians from historical data for a specific month
 */
export function calculateMonthlyMedians(dailyData) {
  if (dailyData.length === 0) {
    return {
      temperature: 0,
      precipitation: 0,
      weatherCategory: 'unknown'
    };
  }
  
  // Extract temperature and precipitation data
  const temperatures = dailyData.map(d => d.temperature.max);
  const precipitations = dailyData.map(d => d.precipitation.sum);
  
  return {
    temperature: calculateMedian(temperatures),
    precipitation: calculateMedian(precipitations),
    weatherCategory: calculateWeatherConditionMedian(dailyData)
  };
}
