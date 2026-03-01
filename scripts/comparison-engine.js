/**
 * RetroCast – Comparison Engine
 * Compares historical forecast vs actual observed weather and produces accuracy metrics.
 */

import {
  fetchActualWeather,
  fetchHistoricalForecast,
  fetchMonthlyMedianWeather,
} from "./api-service.js";
import { formatDate, daysAgo } from "./utils.js";
import { LIMITS, getWeatherInfo, WEATHER_CODES } from "./constants.js";

// ── Scoring helpers (private) ────────────────────────────────────────────────

const RATINGS = [
  { min: 3.5, grade: "A", label: "Excellent" },
  { min: 2.5, grade: "B", label: "Good" },
  { min: 1.5, grade: "C", label: "Fair" },
  { min: 0, grade: "D", label: "Poor" },
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
  if (avgErr <= 1) score = "A";
  else if (avgErr <= 2) score = "B";
  else if (avgErr <= 4) score = "C";
  else score = "D";

  const rating = scoreToRating({ A: 4, B: 3, C: 2, D: 1 }[score]);

  return {
    maxError: maxErr,
    minError: minErr,
    avgError: avgErr,
    score,
    rating: rating.label,
  };
}

// ── Precipitation accuracy ───────────────────────────────────────────────────

function calcPrecipitation(forecast, actual) {
  const fRain = forecast.precipitation.sum > 0.1;
  const aRain = actual.precipitation.sum > 0.1;
  const correct = fRain === aRain;

  const amountErr = Math.abs(
    forecast.precipitation.sum - actual.precipitation.sum,
  );
  const pctErr =
    actual.precipitation.sum > 0
      ? (amountErr / actual.precipitation.sum) * 100
      : forecast.precipitation.sum > 0.1
        ? 100
        : 0;

  let accuracy;
  if (correct && amountErr < 0.5) accuracy = "Perfect";
  else if (correct && amountErr < 2) accuracy = "Excellent";
  else if (correct && amountErr < 5) accuracy = "Good";
  else if (correct) accuracy = "Fair";
  else if (amountErr < 2) accuracy = "Poor";
  else accuracy = "Incorrect";

  return { correct, accuracy, amountError: amountErr, percentageError: pctErr };
}

// ── Condition accuracy ───────────────────────────────────────────────────────

function calcCondition(forecast, actual) {
  const fCat = getWeatherInfo(forecast.weatherCode).category;
  const aCat = getWeatherInfo(actual.weatherCode).category;
  const match = fCat === aCat;

  let confidence;
  if (match) confidence = "High";
  else if (
    (fCat === "clear" && aCat === "cloudy") ||
    (fCat === "cloudy" && aCat === "clear") ||
    (fCat === "rain" && aCat === "showers") ||
    (fCat === "showers" && aCat === "rain")
  ) {
    confidence = "Medium";
  } else {
    confidence = "Low";
  }

  return {
    match,
    confidence,
    forecastCode: forecast.weatherCode,
    actualCode: actual.weatherCode,
    forecastCategory: fCat,
    actualCategory: aCat,
  };
}

// ── Overall score ────────────────────────────────────────────────────────────

function calcOverall(temp, precip, cond) {
  const tempPts = ratingLabelToPoints(temp.rating);
  const precipPts = ratingLabelToPoints(
    precip.accuracy === "Perfect" ? "Excellent" : precip.accuracy,
  );
  const condPts = cond.match ? 4 : cond.confidence === "Medium" ? 2 : 0;

  // Weighted: 40% temp, 40% precip, 20% condition
  const weighted = tempPts * 0.4 + precipPts * 0.4 + condPts * 0.2;
  const pct = Math.round((weighted / 4) * 100);
  const rating = scoreToRating(weighted);

  return {
    score: rating.grade,
    rating: rating.label,
    percentage: pct,
    points: weighted,
  };
}

// ── Public: compare one day ──────────────────────────────────────────────────

export function compareForecastToActual(forecast, actual) {
  const temperature = calcTemperature(forecast, actual);
  const precipitation = calcPrecipitation(forecast, actual);
  const condition = calcCondition(forecast, actual);
  const overall = calcOverall(temperature, precipitation, condition);

  return { temperature, precipitation, condition, overall };
}

// ── Median weather comparisons ────────────────────────────────────────────────

/**
 * Compare a single day's forecast to the monthly median.
 * Simple comparison showing how forecast compares to statistical expectations.
 */
export function compareForecastToMedian(forecast, median) {
  const forecastAvg = (forecast.temperature.max + forecast.temperature.min) / 2;
  const medianAvg = median.temperature.avg;
  const tempDiff = forecastAvg - medianAvg;

  const precipDiff = forecast.precipitation.sum - median.precipitation.sum;
  const isRainier = forecast.precipitation.sum > median.precipitation.sum + 1;
  const isDrier = forecast.precipitation.sum < median.precipitation.sum - 1;

  const fCat = forecast.weather.category;
  const mCat = median.weather.category;
  const categoryMatch = fCat === mCat;

  return {
    temperature: {
      diff: tempDiff,
      warmer: tempDiff > 1,
      cooler: tempDiff < -1,
      typical: Math.abs(tempDiff) <= 1,
    },
    precipitation: {
      diff: precipDiff,
      rainier: isRainier,
      drier: isDrier,
      typical: !isRainier && !isDrier,
    },
    condition: {
      match: categoryMatch,
      forecastCategory: fCat,
      medianCategory: mCat,
    },
  };
}

/**
 * Compare actual observed weather to the monthly median.
 * Shows how the actual weather compares to typical expectations.
 */
export function compareActualToMedian(actual, median) {
  const actualAvg = (actual.temperature.max + actual.temperature.min) / 2;
  const medianAvg = median.temperature.avg;
  const tempDiff = actualAvg - medianAvg;

  const precipDiff = actual.precipitation.sum - median.precipitation.sum;
  const isRainier = actual.precipitation.sum > median.precipitation.sum + 1;
  const isDrier = actual.precipitation.sum < median.precipitation.sum - 1;

  const aCat = actual.weather.category;
  const mCat = median.weather.category;
  const categoryMatch = aCat === mCat;

  return {
    temperature: {
      diff: tempDiff,
      warmer: tempDiff > 1,
      cooler: tempDiff < -1,
      typical: Math.abs(tempDiff) <= 1,
    },
    precipitation: {
      diff: precipDiff,
      rainier: isRainier,
      drier: isDrier,
      typical: !isRainier && !isDrier,
    },
    condition: {
      match: categoryMatch,
      actualCategory: aCat,
      medianCategory: mCat,
    },
  };
}

// ── Random weather generation ──────────────────────────────────────────────────

/**
 * Generate random weather data within sensible fixed ranges.
 * @param {Object} day - Day object containing date
 * @param {Object} location - Location object with lat/lon (for optional variation)
 * @returns {Object} Random weather data in the same format as API responses
 */
function generateRandomWeather(day, location) {
  const weatherCodes = Object.keys(WEATHER_CODES).map(Number);
  const randomCode =
    weatherCodes[Math.floor(Math.random() * weatherCodes.length)];

  const randomTempMin = -20 + Math.random() * 60;
  const randomTempMax = randomTempMin + Math.random() * 15;

  const randomPrecipSum = Math.random() * 50;
  const randomPrecipHours =
    randomPrecipSum > 0 ? 1 + Math.floor(Math.random() * 24) : 0;

  return {
    date: day.date,
    weatherCode: randomCode,
    weather: getWeatherInfo(randomCode),
    temperature: {
      max: Math.max(randomTempMax, randomTempMin),
      min: randomTempMin,
    },
    precipitation: {
      sum: randomPrecipSum,
      hours: randomPrecipHours,
      probability: null,
    },
  };
}

// ── Random weather comparison ───────────────────────────────────────────────────

/**
 * Compare actual observed weather to random predictions.
 * Shows how random guessing performs compared to real forecasts.
 */
export function compareActualToRandom(actual, random) {
  return compareForecastToActual(random, actual);
}

// ── Median accuracy calculation helper ──────────────────────────────────────────

export function compareActualWeatherToMedian(actual, median) {
  const result = compareActualToMedian(actual, median);

  const tempErr = Math.abs(result.temperature.diff);
  let tempPts;
  if (tempErr <= 1) tempPts = 4;
  else if (tempErr <= 2) tempPts = 3;
  else if (tempErr <= 4) tempPts = 2;
  else tempPts = 1;

  const tempRating = scoreToRating(tempPts);

  const precipCorrect = result.precipitation.typical;
  const precipAmountErr = Math.abs(result.precipitation.diff);
  let precipAccuracy;
  if (precipCorrect && precipAmountErr < 0.5) precipAccuracy = "Perfect";
  else if (precipCorrect && precipAmountErr < 2) precipAccuracy = "Excellent";
  else if (precipCorrect && precipAmountErr < 5) precipAccuracy = "Good";
  else if (precipCorrect) precipAccuracy = "Fair";
  else if (precipAmountErr < 2) precipAccuracy = "Poor";
  else precipAccuracy = "Incorrect";

  const condMatch = result.condition.match;
  const condPts = condMatch ? 4 : 2;
  const precipPts = ratingLabelToPoints(
    precipAccuracy === "Perfect" ? "Excellent" : precipAccuracy,
  );

  const weighted = tempPts * 0.4 + precipPts * 0.4 + condPts * 0.2;
  const pct = Math.round((weighted / 4) * 100);
  const overallRating = scoreToRating(weighted);

  return {
    temperature: {
      avgError: tempErr,
      maxError: tempErr,
      minError: tempErr,
      rating: tempRating.label,
      score: tempRating.grade,
    },
    precipitation: {
      correct: precipCorrect,
      accuracy: precipAccuracy,
      amountError: precipAmountErr,
    },
    condition: {
      match: condMatch,
      confidence: condMatch ? "High" : "Medium",
    },
    overall: {
      score: overallRating.grade,
      rating: overallRating.label,
      percentage: pct,
      points: weighted,
    },
  };
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
  const endDate = daysAgo(1);

  // Fetch both datasets in parallel – one call each covers all 3 days
  const [actuals, forecasts] = await Promise.all([
    fetchActualWeather(lat, lon, startDate, endDate),
    fetchHistoricalForecast(lat, lon, startDate, endDate),
  ]);

  // Fetch monthly median weather for the current month
  const currentMonth = new Date().getMonth() + 1;
  const monthlyMedian = await fetchMonthlyMedianWeather(lat, lon, currentMonth);

  // Build a lookup by date string
  const actualMap = Object.fromEntries(actuals.map((d) => [d.date, d]));
  const forecastMap = Object.fromEntries(forecasts.map((d) => [d.date, d]));

  const results = [];
  for (let i = days; i >= 1; i--) {
    const date = formatDate(daysAgo(i));
    const actual = actualMap[date];
    const forecast = forecastMap[date];

    if (actual && forecast) {
      const accuracy = compareForecastToActual(forecast, actual);
      const forecastVsMedian = monthlyMedian
        ? compareForecastToMedian(forecast, monthlyMedian)
        : null;
      const actualVsMedian = monthlyMedian
        ? compareActualToMedian(actual, monthlyMedian)
        : null;

      const randomWeather = generateRandomWeather(
        { date },
        { latitude: lat, longitude: lon },
      );
      const randomAccuracy = compareActualToRandom(actual, randomWeather);

      results.push({
        date,
        daysAgo: i,
        forecast,
        actual,
        accuracy,
        monthlyMedian,
        forecastVsMedian,
        actualVsMedian,
        randomWeather,
        randomAccuracy,
      });
    } else {
      results.push({
        date,
        daysAgo: i,
        error: !actual
          ? "Actual weather data not yet available"
          : "Forecast data not available",
      });
    }
  }

  return results;
}
