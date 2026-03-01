/**
 * RetroCast – UI Controller
 * Manages all DOM interactions: location search, favorites, arena rows, accuracy bars.
 */

import { searchLocations } from './api-service.js';
import { fetchAndCompareAll } from './comparison-engine.js';
import {
  getActiveLocation, setActiveLocation,
  getFavorites, addFavorite, removeFavorite, isFavorite,
  isBannerClosed, closeBanner,
} from './storage-manager.js';
import { formatDisplayDate, getRelativeDayLabel, debounce } from './utils.js';

// ── Lucide icon helper ───────────────────────────────────────────────────────

function icon(name, cls = '') {
  return `<i data-lucide="${name}" class="${cls}"></i>`;
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

// ── Accuracy colour class ────────────────────────────────────────────────────

function accClass(pct) {
  if (pct >= 75) return 'excellent';
  if (pct >= 50) return 'good';
  if (pct >= 25) return 'fair';
  return 'poor';
}

// ── Competitor panel renderer ────────────────────────────────────────────────

/**
 * Render a single competitor column (forecast / climate / random).
 *
 * @param {object} prediction  – day object (same shape as forecast/actual)
 * @param {object|null} acc    – accuracy result from compareForecastToActual, or null
 * @param {string} label       – e.g. "Forecast"
 * @param {string} emoji       – e.g. "🎯"
 * @param {string} modClass    – BEM modifier, e.g. "forecast"
 */
function renderCompetitor(prediction, acc, label, emoji, modClass) {
  const pct    = acc?.overall.percentage ?? null;
  const grade  = acc?.overall.score ?? '–';
  const cls    = pct !== null ? accClass(pct) : 'poor';
  const pctStr = pct !== null ? `${pct}%` : 'N/A';

  const tempErr = acc ? `±${acc.temperature.avgError.toFixed(1)}°` : '–';
  const rainOk  = acc
    ? `<span class="acc-${acc.precipitation.correct ? 'excellent' : 'poor'}">${icon(acc.precipitation.correct ? 'check' : 'x')}</span>`
    : '–';
  const condOk  = acc
    ? `<span class="acc-${acc.condition.match ? 'excellent' : (acc.condition.confidence === 'Medium' ? 'fair' : 'poor')}">${icon(acc.condition.match ? 'check' : 'x')}</span>`
    : '–';

  return `
    <div class="arena-competitor arena-competitor--${modClass}">
      <div class="arena-competitor__heading">
        <span class="arena-competitor__emoji">${emoji}</span> ${label}
      </div>
      <div class="arena-competitor__icon">${icon(prediction.weather.icon)}</div>
      <div class="arena-competitor__condition">${prediction.weather.description}</div>
      <div class="arena-competitor__temps">
        <span class="temp-hi">${prediction.temperature.max.toFixed(1)}°</span>
        <span class="temp-lo">${prediction.temperature.min.toFixed(1)}°</span>
      </div>
      <div class="arena-competitor__precip">
        ${icon('droplets')} ${prediction.precipitation.sum.toFixed(1)} mm
      </div>
      <div class="arena-competitor__score arena-score--${cls}">
        <div class="arena-score-bar">
          <div class="arena-score-bar__fill arena-score-bar--${cls}"
               style="width:${pct ?? 0}%"></div>
        </div>
        <span class="arena-score-grade">${grade}</span>
        <span class="arena-score-pct">${pctStr}</span>
      </div>
      <div class="arena-competitor__details">
        <span class="arena-detail" title="Temperature error">${icon('thermometer')} ${tempErr}</span>
        <span class="arena-detail" title="Rain correct">${icon('droplets')} ${rainOk}</span>
        <span class="arena-detail" title="Condition match">${icon('eye')} ${condOk}</span>
      </div>
    </div>`;
}

// ── Arena day row ────────────────────────────────────────────────────────────

function renderArenaDay(day, index) {
  const { forecast: f, actual: a, accuracy: acc,
          statistical, statAccuracy, random, randAccuracy } = day;

  const label       = getRelativeDayLabel(day.daysAgo);
  const displayDate = formatDisplayDate(day.date);

  // Determine best competitor to show a winner badge
  const scores = [
    { key: 'forecast', pct: acc.overall.percentage },
    { key: 'climate',  pct: statAccuracy?.overall.percentage ?? -1 },
    { key: 'random',   pct: randAccuracy.overall.percentage },
  ];
  const winner = scores.reduce((best, c) => c.pct > best.pct ? c : best).key;

  const climatePanel = statistical
    ? renderCompetitor(statistical, statAccuracy, 'Climate', '📊', 'climate')
    : `<div class="arena-competitor arena-competitor--climate arena-competitor--unavailable">
         <div class="arena-competitor__heading"><span class="arena-competitor__emoji">📊</span> Climate</div>
         <div class="arena-competitor__na">${icon('cloud-off')} No data</div>
       </div>`;

  return `
    <article class="arena-day" style="animation-delay:${index * 120}ms">
      <header class="arena-day__header">
        <span class="arena-day__label">${label}</span>
        <time class="arena-day__date">${displayDate}</time>
      </header>

      <div class="arena-day__body">
        <!-- Ground truth -->
        <div class="arena-actual">
          <div class="arena-actual__heading">${icon('check-circle')} Actual</div>
          <div class="arena-actual__icon">${icon(a.weather.icon)}</div>
          <div class="arena-actual__condition">${a.weather.description}</div>
          <div class="arena-actual__temps">
            <span class="temp-hi">${a.temperature.max.toFixed(1)}°</span>
            <span class="temp-lo">${a.temperature.min.toFixed(1)}°</span>
          </div>
          <div class="arena-actual__precip">${icon('droplets')} ${a.precipitation.sum.toFixed(1)} mm</div>
        </div>

        <!-- Competitors -->
        <div class="arena-competitors">
          <div class="arena-competitor-wrapper ${winner === 'forecast' ? 'arena-winner' : ''}">
            ${winner === 'forecast' ? '<div class="arena-winner-badge">🏆 Best</div>' : ''}
            ${renderCompetitor(f, acc, 'Forecast', '🎯', 'forecast')}
          </div>
          <div class="arena-competitor-wrapper ${winner === 'climate' ? 'arena-winner' : ''}">
            ${winner === 'climate' ? '<div class="arena-winner-badge">🏆 Best</div>' : ''}
            ${climatePanel}
          </div>
          <div class="arena-competitor-wrapper ${winner === 'random' ? 'arena-winner' : ''}">
            ${winner === 'random' ? '<div class="arena-winner-badge">🏆 Best</div>' : ''}
            ${renderCompetitor(random, randAccuracy, 'Random', '🎲', 'random')}
          </div>
        </div>
      </div>
    </article>`;
}

function renderArenaErrorDay(day, index) {
  const label       = getRelativeDayLabel(day.daysAgo);
  const displayDate = formatDisplayDate(day.date);
  return `
    <article class="arena-day arena-day--error" style="animation-delay:${index * 120}ms">
      <header class="arena-day__header">
        <span class="arena-day__label">${label}</span>
        <time class="arena-day__date">${displayDate}</time>
      </header>
      <div class="arena-day__empty">
        ${icon('cloud-off', 'empty-icon')} <p>${day.error}</p>
      </div>
    </article>`;
}

function renderArenaSkeletons() {
  return Array.from({ length: 3 }, (_, i) => `
    <article class="arena-day arena-day--skeleton" style="animation-delay:${i * 120}ms">
      <header class="arena-day__header">
        <div class="skel skel-text" style="width:80px"></div>
        <div class="skel skel-text" style="width:60px"></div>
      </header>
      <div class="arena-day__body">
        <div class="arena-actual">
          <div class="skel skel-circle"></div>
          <div class="skel skel-text"></div>
          <div class="skel skel-text" style="width:50%"></div>
        </div>
        <div class="arena-competitors">
          ${Array.from({ length: 3 }, () => `
            <div class="arena-competitor-wrapper">
              <div class="arena-competitor">
                <div class="skel skel-circle"></div>
                <div class="skel skel-text"></div>
                <div class="skel skel-bar" style="margin-top:auto"></div>
              </div>
            </div>`).join('')}
        </div>
      </div>
    </article>`).join('');
}

// ── Arena summary (3 accuracy bars) ─────────────────────────────────────────

function renderArenaSummary(days) {
  const valid = days.filter(d => d.accuracy);
  if (!valid.length) return '';

  const avg = arr => arr.length
    ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length)
    : null;

  const forecastAvg = avg(valid.map(d => d.accuracy.overall.percentage));
  const climateAvg  = avg(valid.filter(d => d.statAccuracy).map(d => d.statAccuracy.overall.percentage));
  const randomAvg   = avg(valid.map(d => d.randAccuracy.overall.percentage));

  function bar(emoji, name, pct, modClass) {
    const cls = accClass(pct ?? 0);
    const pctStr = pct !== null ? `${pct}%` : 'N/A';
    return `
      <div class="arena-summary__row arena-summary__row--${modClass}">
        <span class="arena-summary__label">
          <span class="arena-summary__emoji">${emoji}</span>
          <span class="arena-summary__name">${name}</span>
        </span>
        <div class="arena-summary__track">
          <div class="arena-summary__fill arena-summary--${cls}" style="--pct:${pct ?? 0}%"></div>
        </div>
        <span class="arena-summary__value acc-${cls}">${pctStr}</span>
      </div>`;
  }

  return `
    <div class="arena-summary">
      <div class="arena-summary__title">${icon('trophy')} 3-Day Prediction Arena</div>
      ${bar('🎯', 'Forecast',         forecastAvg, 'forecast')}
      ${bar('📊', 'Climate Baseline', climateAvg,  'climate')}
      ${bar('🎲', 'Random Guess',     randomAvg,   'random')}
    </div>`;
}

// ── Favorites bar ────────────────────────────────────────────────────────────

function renderFavorites(favs, activeLoc) {
  if (!favs.length) return '';
  const chips = favs.map(f => {
    const isActive = activeLoc &&
      Math.abs(f.latitude - activeLoc.latitude) < 0.01 &&
      Math.abs(f.longitude - activeLoc.longitude) < 0.01;
    return `<button class="fav-chip ${isActive ? 'fav-chip--active' : ''}"
                    data-lat="${f.latitude}" data-lon="${f.longitude}"
                    data-name="${f.name}" data-country="${f.country}" data-admin1="${f.admin1 || ''}"
                    title="${f.name}, ${f.country}">
              ${icon('map-pin')} ${f.name}
            </button>`;
  }).join('');
  return `<div class="favorites-bar">${chips}</div>`;
}

// ── Search dropdown ──────────────────────────────────────────────────────────

function renderSearchResults(results) {
  if (!results.length) return '<div class="search-dropdown__empty">No cities found</div>';
  return results.map(r => `
    <button class="search-dropdown__item"
            data-lat="${r.latitude}" data-lon="${r.longitude}"
            data-name="${r.name}" data-country="${r.country}" data-admin1="${r.admin1 || ''}">
      ${icon('map-pin')} <strong>${r.name}</strong>${r.admin1 ? ', ' + r.admin1 : ''}, ${r.country}
      <small>${r.latitude.toFixed(2)}, ${r.longitude.toFixed(2)}</small>
    </button>`).join('');
}

// ═════════════════════════════════════════════════════════════════════════════
// Main controller
// ═════════════════════════════════════════════════════════════════════════════

export class UIController {
  constructor() {
    this.currentLocation = null;
    this._els = {};
    this._searchResults = [];
  }

  // ── Initialisation ─────────────────────────────────────────────────────────

  init() {
    const ids = [
      'cityInput', 'searchBtn', 'detectBtn', 'searchDropdown',
      'daysGrid', 'summarySlot', 'favoritesSlot',
      'locationName', 'favToggle', 'infoBanner', 'closeBanner',
    ];
    for (const id of ids) {
      this._els[id] = document.getElementById(id);
    }

    this._bindEvents();
    this._initBanner();
    this._renderFavoritesBar();

    const saved = getActiveLocation();
    if (saved) this._activateLocation(saved, false);
  }

  // ── Event wiring ───────────────────────────────────────────────────────────

  _bindEvents() {
    const { cityInput, searchBtn, detectBtn, searchDropdown, favToggle, favoritesSlot, closeBanner: bannerBtn } = this._els;

    const doSearch = debounce(() => this._onSearchInput(), 350);
    cityInput.addEventListener('input', doSearch);
    cityInput.addEventListener('focus', () => {
      if (this._searchResults.length) searchDropdown.classList.add('open');
    });
    cityInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); this._onSearchInput(); }
    });

    document.addEventListener('click', e => {
      if (!cityInput.contains(e.target) && !searchDropdown.contains(e.target)) {
        searchDropdown.classList.remove('open');
      }
    });

    searchDropdown.addEventListener('click', e => {
      const item = e.target.closest('.search-dropdown__item');
      if (!item) return;
      this._pickSearchResult(item.dataset);
    });

    searchBtn.addEventListener('click', () => this._onSearchInput());
    detectBtn.addEventListener('click', () => this._detectLocation());
    favToggle.addEventListener('click', () => this._toggleFavorite());

    favoritesSlot.addEventListener('click', e => {
      const chip = e.target.closest('.fav-chip');
      if (!chip) return;
      this._pickSearchResult(chip.dataset);
    });

    bannerBtn?.addEventListener('click', () => {
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
      this._els.searchDropdown.classList.remove('open');
      return;
    }
    try {
      this._searchResults = await searchLocations(q);
      this._els.searchDropdown.innerHTML = renderSearchResults(this._searchResults);
      this._els.searchDropdown.classList.add('open');
      refreshIcons();
    } catch (err) {
      console.error('Search failed', err);
      this._els.searchDropdown.innerHTML = '<div class="search-dropdown__empty">Search error — try again</div>';
      this._els.searchDropdown.classList.add('open');
    }
  }

  _pickSearchResult(dataset) {
    const loc = {
      name:      dataset.name,
      country:   dataset.country,
      admin1:    dataset.admin1 || '',
      latitude:  parseFloat(dataset.lat),
      longitude: parseFloat(dataset.lon),
    };
    this._els.searchDropdown.classList.remove('open');
    this._els.cityInput.value = '';
    this._activateLocation(loc);
  }

  async _detectLocation() {
    if (!navigator.geolocation) {
      this._showError('Geolocation not supported by your browser');
      return;
    }
    this._els.detectBtn.classList.add('detecting');
    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000, maximumAge: 300000,
        })
      );
      const { latitude, longitude } = pos.coords;
      const loc = {
        name: `${latitude.toFixed(2)}°N, ${longitude.toFixed(2)}°E`,
        country: '', admin1: '', latitude, longitude,
      };
      this._activateLocation(loc);
    } catch (err) {
      console.error('Geolocation error', err);
      this._showError('Could not detect location. Check permissions or use Search.');
    } finally {
      this._els.detectBtn.classList.remove('detecting');
    }
  }

  // ── Activate location & load data ──────────────────────────────────────────

  async _activateLocation(loc, save = true) {
    this.currentLocation = loc;
    if (save) setActiveLocation(loc);

    this._els.locationName.textContent = loc.name + (loc.country ? `, ${loc.country}` : '');
    this._updateFavIcon();
    this._renderFavoritesBar();

    this._els.daysGrid.innerHTML = renderArenaSkeletons();
    this._els.summarySlot.innerHTML = '';
    refreshIcons();

    try {
      const days = await fetchAndCompareAll(loc);
      this._renderDays(days);
    } catch (err) {
      console.error('Failed to load weather data', err);
      this._els.daysGrid.innerHTML = `
        <div class="global-error">
          ${icon('alert-triangle')}
          <p>Failed to load weather data. Please try again.</p>
          <button class="btn btn--primary" id="retryBtn">${icon('refresh-cw')} Retry</button>
        </div>`;
      refreshIcons();
      document.getElementById('retryBtn')?.addEventListener('click', () => this._activateLocation(loc, false));
    }
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  _renderDays(days) {
    const rows = days.map((d, i) =>
      d.error ? renderArenaErrorDay(d, i) : renderArenaDay(d, i)
    ).join('');
    this._els.daysGrid.innerHTML = rows;
    this._els.summarySlot.innerHTML = renderArenaSummary(days);
    refreshIcons();
  }

  // ── Favorites ──────────────────────────────────────────────────────────────

  _renderFavoritesBar() {
    if (!this._els.favoritesSlot) return;
    this._els.favoritesSlot.innerHTML = renderFavorites(getFavorites(), this.currentLocation);
    refreshIcons();
  }

  _updateFavIcon() {
    if (!this.currentLocation || !this._els.favToggle) return;
    const fav = isFavorite(this.currentLocation.latitude, this.currentLocation.longitude);
    this._els.favToggle.classList.toggle('is-fav', fav);
    this._els.favToggle.title = fav ? 'Remove from favorites' : 'Add to favorites';
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
    const el = document.createElement('div');
    el.className = 'toast toast--error';
    el.innerHTML = `${icon('alert-circle')} ${msg}`;
    document.body.appendChild(el);
    refreshIcons();
    setTimeout(() => el.classList.add('show'), 10);
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 4000);
  }
}
