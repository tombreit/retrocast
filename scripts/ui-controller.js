/**
 * RetroCast – UI Controller
 * Manages all DOM interactions: location search, favorites, day cards, gauges.
 */

import { searchLocations } from "./api-service.js";
import {
  fetchAndCompareAll,
  compareActualWeatherToMedian,
  compareActualToRandom,
} from "./comparison-engine.js";
import {
  getActiveLocation,
  setActiveLocation,
  getFavorites,
  addFavorite,
  removeFavorite,
  isFavorite,
  isBannerClosed,
  closeBanner,
} from "./storage-manager.js";
import { formatDisplayDate, getRelativeDayLabel, debounce } from "./utils.js";

// ── Lucide icon helper ───────────────────────────────────────────────────────

function icon(name, cls = "") {
  return `<i data-lucide="${name}" class="${cls}"></i>`;
}

// Re-initialise Lucide icons (call after inserting HTML with data-lucide attributes)
function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

// ── Accuracy helpers ─────────────────────────────────────────────────────────

function accuracyClass(rating) {
  const map = {
    Excellent: "excellent",
    Good: "good",
    Fair: "fair",
    Poor: "poor",
  };
  return map[rating] ?? "poor";
}

// ── SVG ring gauge ───────────────────────────────────────────────────────────

function renderGauge(percentage, grade) {
  const r = 54,
    c = 2 * Math.PI * r;
  const offset = c - (percentage / 100) * c;
  const cls =
    percentage >= 75
      ? "gauge-excellent"
      : percentage >= 50
        ? "gauge-good"
        : percentage >= 25
          ? "gauge-fair"
          : "gauge-poor";
  return `
    <div class="gauge">
      <svg viewBox="0 0 120 120">
        <circle class="gauge-bg" cx="60" cy="60" r="${r}" />
        <circle class="gauge-fill ${cls}" cx="60" cy="60" r="${r}"
                stroke-dasharray="${c}" stroke-dashoffset="${offset}"
                style="--target-offset:${offset}" />
      </svg>
      <div class="gauge-label">
        <span class="gauge-grade">${grade}</span>
        <span class="gauge-pct">${percentage}%</span>
      </div>
    </div>`;
}

// ── Compact gauge for comparison rows ───────────────────────────────────────────

function renderCompactGauge(percentage, grade, colorTheme = "forecast") {
  const themeColors = {
    forecast: "#6366f1",
    median: "#a855f7",
    random: "#64748b",
  };
  const color = themeColors[colorTheme] || themeColors.forecast;

  const r = 28,
    c = 2 * Math.PI * r;
  const offset = c - (percentage / 100) * c;

  return `
    <div class="gauge gauge--compact">
      <svg viewBox="0 0 64 64">
        <circle class="gauge-bg" cx="32" cy="32" r="${r}" />
        <circle class="gauge-fill" cx="32" cy="32" r="${r}"
                stroke-dasharray="${c}" stroke-dashoffset="${offset}"
                style="--target-offset:${offset}; --gauge-color:${color}" />
      </svg>
      <div class="gauge-label">
        <span class="gauge-grade">${grade}</span>
        <span class="gauge-pct">${percentage}%</span>
      </div>
    </div>`;
}

// ── Comparison row renderers ───────────────────────────────────────────────────

function renderComparisonRows(day, actual) {
  const { forecast, accuracy, monthlyMedian, randomWeather, randomAccuracy } =
    day;

  const medianData = monthlyMedian
    ? {
        avg: compareActualWeatherToMedian(actual, monthlyMedian),
        data: monthlyMedian,
      }
    : null;

  const randomData = randomWeather
    ? { avg: randomAccuracy, data: randomWeather }
    : null;

  return renderComparisonTable(
    actual,
    forecast,
    accuracy,
    medianData,
    randomData,
  );
}

// ── Comparison table renderer ──────────────────────────────────────────────────

function renderComparisonTable(
  actual,
  forecast,
  forecastAcc,
  medianData,
  randomData,
) {
  return `
    <div class="comparison-table">
      <!-- Header row -->
      <div class="comparison-table__header">
        <div class="comparison-table__cell comparison-table__cell--header comparison-table__cell--actual">
          Actual
        </div>
        <div class="comparison-table__cell comparison-table__cell--header comparison-table__cell--forecast">
          Forecast
        </div>
        <div class="comparison-table__cell comparison-table__cell--header comparison-table__cell--median">
          Median (10yr)
        </div>
        <div class="comparison-table__cell comparison-table__cell--header comparison-table__cell--random">
          Random
        </div>
      </div>

      <!-- Condition row -->
      <div class="comparison-table__row">
        <div class="comparison-table__cell comparison-table__cell--label">
          Condition
        </div>
        <div class="comparison-table__cell comparison-table__cell--actual comparison-table__cell--spanned">
          ${renderActualConditionCell(actual)}
        </div>
        <div class="comparison-table__cell comparison-table__cell--forecast ${getAccuracyColorClass(forecastAcc.condition.match, "cond")}">
          ${renderPredictionConditionCell(forecast, forecastAcc)}
        </div>
        <div class="comparison-table__cell comparison-table__cell--median ${getAccuracyColorClass(medianData?.avg.condition.match, "cond")}">
          ${medianData ? renderPredictionConditionCell(medianData.data, medianData.avg) : "-"}
        </div>
        <div class="comparison-table__cell comparison-table__cell--random ${getAccuracyColorClass(randomData?.avg.condition.match, "cond")}">
          ${randomData ? renderPredictionConditionCell(randomData.data, randomData.avg) : "-"}
        </div>
      </div>

      <!-- Temperature row -->
      <div class="comparison-table__row">
        <div class="comparison-table__cell comparison-table__cell--label">
          Temperature
        </div>
        <div class="comparison-table__cell comparison-table__cell--actual comparison-table__cell--spanned">
          ${renderActualTempCell(actual)}
        </div>
        <div class="comparison-table__cell comparison-table__cell--forecast ${getTempAccuracyColorClass(forecastAcc.temperature.avgError)}">
          ${renderPredictionTempCell(forecast, forecastAcc)}
        </div>
        <div class="comparison-table__cell comparison-table__cell--median ${getTempAccuracyColorClass(medianData?.avg.temperature.avgError)}">
          ${medianData ? renderPredictionTempCell(medianData.data, medianData.avg) : "-"}
        </div>
        <div class="comparison-table__cell comparison-table__cell--random ${getTempAccuracyColorClass(randomData?.avg.temperature.avgError)}">
          ${randomData ? renderPredictionTempCell(randomData.data, randomData.avg) : "-"}
        </div>
      </div>

      <!-- Precipitation row -->
      <div class="comparison-table__row comparison-table__row--last">
        <div class="comparison-table__cell comparison-table__cell--label">
          Precipitation
        </div>
        <div class="comparison-table__cell comparison-table__cell--actual comparison-table__cell--spanned">
          ${renderActualPrecipCell(actual)}
        </div>
        <div class="comparison-table__cell comparison-table__cell--forecast ${getPrecipAccuracyColorClass(forecastAcc.precipitation.accuracy)}">
          ${renderPredictionPrecipCell(forecast, forecastAcc)}
        </div>
        <div class="comparison-table__cell comparison-table__cell--median ${getPrecipAccuracyColorClass(medianData?.avg.precipitation.accuracy)}">
          ${medianData ? renderPredictionPrecipCell(medianData.data, medianData.avg) : "-"}
        </div>
        <div class="comparison-table__cell comparison-table__cell--random ${getPrecipAccuracyColorClass(randomData?.avg.precipitation.accuracy)}">
          ${randomData ? renderPredictionPrecipCell(randomData.data, randomData.avg) : "-"}
        </div>
      </div>
    </div>
  `;
}

// ── Cell renderer helpers ─────────────────────────────────────────────────────

function renderActualConditionCell(actual) {
  return `
    <div class="cell-actual">
      ${icon(actual.weather.icon)}
      <span>${actual.weather.description}</span>
    </div>
  `;
}

function renderPredictionConditionCell(prediction, acc) {
  const match = acc.condition.match;
  return `
    <div class="cell-prediction">
      <div class="cell-prediction__top">
        ${icon(match ? "check" : "x")}
        <span>${prediction.weather.description}</span>
      </div>
    </div>
  `;
}

function renderActualTempCell(actual) {
  return `
    <div class="cell-actual">
      ${icon("thermometer")}
      <span>${actual.temperature.max.toFixed(1)}° / ${actual.temperature.min.toFixed(1)}°</span>
    </div>
  `;
}

function renderPredictionTempCell(prediction, acc) {
  const tempErr = acc.temperature.avgError.toFixed(1);
  const grade = acc.temperature.score;
  return `
    <div class="cell-prediction">
      <div class="cell-prediction__top">
        <span>${prediction.temperature.max.toFixed(1)}° / ${prediction.temperature.min.toFixed(1)}°</span>
      </div>
      <div class="cell-prediction__bottom">
        <span class="cell-error">±${tempErr}°</span>
        <span class="cell-grade acc-${accuracyClass(acc.temperature.rating)}">${grade}</span>
      </div>
    </div>
  `;
}

function renderActualPrecipCell(actual) {
  return `
    <div class="cell-actual">
      ${icon("droplets")}
      <span>${actual.precipitation.sum.toFixed(1)} mm</span>
    </div>
  `;
}

function renderPredictionPrecipCell(prediction, acc) {
  const precipAmt = prediction.precipitation.sum.toFixed(1);
  const precipAcc = acc.precipitation.accuracy;
  return `
    <div class="cell-prediction">
      <div class="cell-prediction__top">
        ${icon(acc.precipitation.correct ? "check" : "x")}
        <span>${precipAmt} mm</span>
      </div>
      <div class="cell-prediction__bottom">
        <span class="cell-accuracy acc-${precipAcc === "Perfect" || precipAcc === "Excellent" ? "excellent" : precipAcc === "Good" ? "good" : precipAcc === "Fair" ? "fair" : "poor"}">${precipAcc}</span>
      </div>
    </div>
  `;
}

// ── Accuracy color helpers ─────────────────────────────────────────────────────

function getAccuracyColorClass(isMatch, type) {
  if (isMatch === undefined || isMatch === null) return "";

  if (type === "cond") {
    return isMatch ? "cell-accuracy--good" : "cell-accuracy--poor";
  }
  return isMatch ? "cell-accuracy--good" : "cell-accuracy--poor";
}

function getTempAccuracyColorClass(avgError) {
  if (avgError === undefined || avgError === null) return "";
  if (avgError <= 1) return "cell-accuracy--good";
  if (avgError <= 2) return "cell-accuracy--good";
  if (avgError <= 4) return "cell-accuracy--fair";
  return "cell-accuracy--poor";
}

function getPrecipAccuracyColorClass(accuracy) {
  if (accuracy === undefined || accuracy === null) return "";
  if (accuracy === "Perfect" || accuracy === "Excellent")
    return "cell-accuracy--good";
  if (accuracy === "Good") return "cell-accuracy--good";
  if (accuracy === "Fair") return "cell-accuracy--fair";
  return "cell-accuracy--poor";
}

// ── Day card renderers ───────────────────────────────────────────────────────

function renderDayCard(day, index) {
  const { actual: a } = day;
  const label = getRelativeDayLabel(day.daysAgo);
  const displayDate = formatDisplayDate(day.date);

  return `
    <article class="day-card" style="animation-delay:${index * 100}ms">
      <header class="day-card__header">
        <span class="day-card__label">${label}</span>
        <time class="day-card__date">${displayDate}</time>
        <div class="day-card__actual-icon">${icon(a.weather.icon)}</div>
      </header>

      <div class="day-card__arena">
        ${renderComparisonRows(day, a)}
      </div>
    </article>`;
}

function renderErrorCard(day, index) {
  const label = getRelativeDayLabel(day.daysAgo);
  const displayDate = formatDisplayDate(day.date);
  return `
    <article class="day-card day-card--error" style="animation-delay:${index * 100}ms">
      <header class="day-card__header">
        <span class="day-card__label">${label}</span>
        <time class="day-card__date">${displayDate}</time>
      </header>
      <div class="day-card__empty">
        ${icon("cloud-off", "empty-icon")}
        <p>${day.error}</p>
      </div>
    </article>`;
}

function renderSkeletonCards() {
  return Array.from(
    { length: 3 },
    (_, i) => `
    <article class="day-card day-card--skeleton" style="animation-delay:${i * 100}ms">
      <header class="day-card__header">
        <div class="skel skel-text"></div>
        <div class="skel skel-circle" style="width:32px;height:32px;margin:0 auto;border-radius:50%"></div>
      </header>
      <div class="day-card__arena">
        <div class="skel skel-bar" style="height:200px;margin:0"></div>
      </div>
    </article>`,
  ).join("");
}

// ── Summary bar ──────────────────────────────────────────────────────────────

function renderSummary(days) {
  const valid = days.filter((d) => d.accuracy);
  if (!valid.length) return "";

  const forecastAvg = Math.round(
    valid.reduce((s, d) => s + d.accuracy.overall.percentage, 0) / valid.length,
  );
  const forecastCls =
    forecastAvg >= 75
      ? "excellent"
      : forecastAvg >= 50
        ? "good"
        : forecastAvg >= 25
          ? "fair"
          : "poor";

  let medianAvg = 0;
  if (valid[0] && valid[0].monthlyMedian) {
    const medianAccuracies = valid
      .map((d) => {
        if (!d.monthlyMedian) return null;
        const medianAcc = compareActualWeatherToMedian(
          d.actual,
          d.monthlyMedian,
        );
        return medianAcc?.overall?.percentage;
      })
      .filter((val) => val !== null && !isNaN(val));
    if (medianAccuracies.length > 0) {
      medianAvg = Math.round(
        medianAccuracies.reduce((s, v) => s + v, 0) / medianAccuracies.length,
      );
    }
  }
  const medianCls =
    medianAvg >= 75
      ? "excellent"
      : medianAvg >= 50
        ? "good"
        : medianAvg >= 25
          ? "fair"
          : "poor";

  const randomAvg = Math.round(
    valid.reduce((s, d) => s + d.randomAccuracy.overall.percentage, 0) /
      valid.length,
  );
  const randomCls =
    randomAvg >= 75
      ? "excellent"
      : randomAvg >= 50
        ? "good"
        : randomAvg >= 25
          ? "fair"
          : "poor";

  return `
    <div class="summary-section">
      <div class="summary-bar summary-bar--forecast">
        <span class="summary-bar__label">${icon("cloud-sun")} Forecast</span>
        <div class="summary-bar__track">
          <div class="summary-bar__fill summary-bar--${forecastCls}" style="--pct:${forecastAvg}%"></div>
        </div>
        <span class="summary-bar__value">${forecastAvg}%</span>
      </div>
      <div class="summary-bar summary-bar--median">
        <span class="summary-bar__label">${icon("trending-up")} Median</span>
        <div class="summary-bar__track">
          <div class="summary-bar__fill summary-bar--${medianCls}" style="--pct:${medianAvg}%"></div>
        </div>
        <span class="summary-bar__value">${medianAvg}%</span>
      </div>
      <div class="summary-bar summary-bar--random">
        <span class="summary-bar__label">${icon("shuffle")} Random</span>
        <div class="summary-bar__track">
          <div class="summary-bar__fill summary-bar--${randomCls}" style="--pct:${randomAvg}%"></div>
        </div>
        <span class="summary-bar__value">${randomAvg}%</span>
      </div>
    </div>`;
}

// ── Favorites bar ────────────────────────────────────────────────────────────

function renderFavorites(favs, activeLoc) {
  if (!favs.length) return "";
  const chips = favs
    .map((f) => {
      const isActive =
        activeLoc &&
        Math.abs(f.latitude - activeLoc.latitude) < 0.01 &&
        Math.abs(f.longitude - activeLoc.longitude) < 0.01;
      return `<button class="fav-chip ${isActive ? "fav-chip--active" : ""}"
                    data-lat="${f.latitude}" data-lon="${f.longitude}"
                    data-name="${f.name}" data-country="${f.country}" data-admin1="${f.admin1 || ""}"
                    title="${f.name}, ${f.country}">
              ${icon("map-pin")} ${f.name}
            </button>`;
    })
    .join("");
  return `<div class="favorites-bar">${chips}</div>`;
}

// ── Search dropdown ──────────────────────────────────────────────────────────

function renderSearchResults(results) {
  if (!results.length)
    return '<div class="search-dropdown__empty">No cities found</div>';
  return results
    .map(
      (r) => `
    <button class="search-dropdown__item"
            data-lat="${r.latitude}" data-lon="${r.longitude}"
            data-name="${r.name}" data-country="${r.country}" data-admin1="${r.admin1 || ""}">
      ${icon("map-pin")} <strong>${r.name}</strong>${r.admin1 ? ", " + r.admin1 : ""}, ${r.country}
      <small>${r.latitude.toFixed(2)}, ${r.longitude.toFixed(2)}</small>
    </button>`,
    )
    .join("");
}

// ═════════════════════════════════════════════════════════════════════════════
// Main controller
// ═════════════════════════════════════════════════════════════════════════════

export class UIController {
  constructor() {
    this.currentLocation = null;
    this._els = {}; // cached DOM refs
    this._searchResults = []; // latest geocoding results
  }

  // ── Initialisation ─────────────────────────────────────────────────────────

  init() {
    // Cache DOM elements
    const ids = [
      "cityInput",
      "searchBtn",
      "detectBtn",
      "searchDropdown",
      "daysGrid",
      "summarySlot",
      "favoritesSlot",
      "locationName",
      "favToggle",
      "infoBanner",
      "closeBanner",
    ];
    for (const id of ids) {
      this._els[id] = document.getElementById(id);
    }

    this._bindEvents();
    this._initBanner();
    this._renderFavoritesBar();

    // Restore last location or prompt
    const saved = getActiveLocation();
    if (saved) {
      this._activateLocation(saved, false);
    }
  }

  // ── Event wiring ───────────────────────────────────────────────────────────

  _bindEvents() {
    const {
      cityInput,
      searchBtn,
      detectBtn,
      searchDropdown,
      favToggle,
      favoritesSlot,
      closeBanner: bannerBtn,
    } = this._els;

    // Search input – debounced autocomplete
    const doSearch = debounce(() => this._onSearchInput(), 350);
    cityInput.addEventListener("input", doSearch);
    cityInput.addEventListener("focus", () => {
      if (this._searchResults.length) searchDropdown.classList.add("open");
    });

    // Enter key submits search
    cityInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this._onSearchInput();
      }
    });

    // Click outside closes dropdown
    document.addEventListener("click", (e) => {
      if (!cityInput.contains(e.target) && !searchDropdown.contains(e.target)) {
        searchDropdown.classList.remove("open");
      }
    });

    // Search dropdown delegation
    searchDropdown.addEventListener("click", (e) => {
      const item = e.target.closest(".search-dropdown__item");
      if (!item) return;
      this._pickSearchResult(item.dataset);
    });

    // Buttons
    searchBtn.addEventListener("click", () => this._onSearchInput());
    detectBtn.addEventListener("click", () => this._detectLocation());

    // Favorite toggle
    favToggle.addEventListener("click", () => this._toggleFavorite());

    // Favorites bar delegation
    favoritesSlot.addEventListener("click", (e) => {
      const chip = e.target.closest(".fav-chip");
      if (!chip) return;
      this._pickSearchResult(chip.dataset);
    });

    // Banner close
    bannerBtn?.addEventListener("click", () => {
      this._els.infoBanner.hidden = true;
      closeBanner();
    });
  }

  // ── Banner ─────────────────────────────────────────────────────────────────

  _initBanner() {
    if (isBannerClosed() && this._els.infoBanner) {
      this._els.infoBanner.hidden = true;
    }
  }

  // ── Search / Location ──────────────────────────────────────────────────────

  async _onSearchInput() {
    const q = this._els.cityInput.value.trim();
    if (q.length < 2) {
      this._els.searchDropdown.classList.remove("open");
      return;
    }
    try {
      this._searchResults = await searchLocations(q);
      this._els.searchDropdown.innerHTML = renderSearchResults(
        this._searchResults,
      );
      this._els.searchDropdown.classList.add("open");
      refreshIcons();
    } catch (err) {
      console.error("Search failed", err);
      this._els.searchDropdown.innerHTML =
        '<div class="search-dropdown__empty">Search error — try again</div>';
      this._els.searchDropdown.classList.add("open");
    }
  }

  _pickSearchResult(dataset) {
    const loc = {
      name: dataset.name,
      country: dataset.country,
      admin1: dataset.admin1 || "",
      latitude: parseFloat(dataset.lat),
      longitude: parseFloat(dataset.lon),
    };
    this._els.searchDropdown.classList.remove("open");
    this._els.cityInput.value = "";
    this._activateLocation(loc);
  }

  async _detectLocation() {
    if (!navigator.geolocation) {
      this._showError("Geolocation not supported by your browser");
      return;
    }
    this._els.detectBtn.classList.add("detecting");
    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          maximumAge: 300000,
        }),
      );
      const { latitude, longitude } = pos.coords;
      const loc = {
        name: `${latitude.toFixed(2)}°N, ${longitude.toFixed(2)}°E`,
        country: "",
        admin1: "",
        latitude,
        longitude,
      };
      this._activateLocation(loc);
    } catch (err) {
      console.error("Geolocation error", err);
      this._showError(
        "Could not detect location. Check permissions or use Search.",
      );
    } finally {
      this._els.detectBtn.classList.remove("detecting");
    }
  }

  // ── Activate location & load data ──────────────────────────────────────────

  async _activateLocation(loc, save = true) {
    this.currentLocation = loc;
    if (save) setActiveLocation(loc);

    // Update header
    this._els.locationName.textContent =
      loc.name + (loc.country ? `, ${loc.country}` : "");
    this._updateFavIcon();
    this._renderFavoritesBar();

    // Show skeleton cards
    this._els.daysGrid.innerHTML = renderSkeletonCards();
    this._els.summarySlot.innerHTML = "";
    refreshIcons();

    try {
      const days = await fetchAndCompareAll(loc);
      this._renderDays(days);
    } catch (err) {
      console.error("Failed to load weather data", err);
      this._els.daysGrid.innerHTML = `
        <div class="global-error">
          ${icon("alert-triangle")}
          <p>Failed to load weather data. Please try again.</p>
          <button class="btn btn--primary" id="retryBtn">${icon("refresh-cw")} Retry</button>
        </div>`;
      refreshIcons();
      document
        .getElementById("retryBtn")
        ?.addEventListener("click", () => this._activateLocation(loc, false));
    }
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  _renderDays(days) {
    const cards = days
      .map((d, i) => (d.error ? renderErrorCard(d, i) : renderDayCard(d, i)))
      .join("");
    this._els.daysGrid.innerHTML = cards;
    this._els.summarySlot.innerHTML = renderSummary(days);
    refreshIcons();
  }

  // ── Favorites ──────────────────────────────────────────────────────────────

  _renderFavoritesBar() {
    if (!this._els.favoritesSlot) return;
    this._els.favoritesSlot.innerHTML = renderFavorites(
      getFavorites(),
      this.currentLocation,
    );
    refreshIcons();
  }

  _updateFavIcon() {
    if (!this.currentLocation || !this._els.favToggle) return;
    const fav = isFavorite(
      this.currentLocation.latitude,
      this.currentLocation.longitude,
    );
    this._els.favToggle.classList.toggle("is-fav", fav);
    this._els.favToggle.title = fav
      ? "Remove from favorites"
      : "Add to favorites";
  }

  _toggleFavorite() {
    if (!this.currentLocation) return;
    const { latitude, longitude } = this.currentLocation;
    if (isFavorite(latitude, longitude)) {
      removeFavorite(latitude, longitude);
    } else {
      addFavorite(this.currentLocation);
    }
    this._updateFavIcon();
    this._renderFavoritesBar();
  }

  // ── Errors ─────────────────────────────────────────────────────────────────

  _showError(msg) {
    // Simple inline error toast at the top
    const el = document.createElement("div");
    el.className = "toast toast--error";
    el.innerHTML = `${icon("alert-circle")} ${msg}`;
    document.body.appendChild(el);
    refreshIcons();
    setTimeout(() => el.classList.add("show"), 10);
    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 300);
    }, 4000);
  }
}
