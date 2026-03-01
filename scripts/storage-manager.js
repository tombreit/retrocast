/**
 * RetroCast – Storage Manager
 * localStorage wrapper for active location, favorites, and forecast cache.
 */

import { STORAGE_KEYS, LIMITS } from "./constants.js";

// ── Active Location ──────────────────────────────────────────────────────────

export function getActiveLocation() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_LOCATION);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setActiveLocation(loc) {
  localStorage.setItem(STORAGE_KEYS.ACTIVE_LOCATION, JSON.stringify(loc));
}

// ── Favorites ────────────────────────────────────────────────────────────────

export function getFavorites() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FAVORITES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveFavorites(favs) {
  localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favs));
}

/**
 * Add a location to favorites. Returns false if already exists or limit reached.
 */
export function addFavorite(loc) {
  const favs = getFavorites();
  const exists = favs.some(
    (f) =>
      Math.abs(f.latitude - loc.latitude) < 0.01 &&
      Math.abs(f.longitude - loc.longitude) < 0.01,
  );
  if (exists) return false;
  if (favs.length >= LIMITS.MAX_FAVORITES) return false;
  favs.push({
    name: loc.name,
    country: loc.country ?? "",
    admin1: loc.admin1 ?? "",
    latitude: loc.latitude,
    longitude: loc.longitude,
  });
  saveFavorites(favs);
  return true;
}

/**
 * Remove a favorite by coordinates.
 */
export function removeFavorite(lat, lon) {
  const favs = getFavorites().filter(
    (f) =>
      !(
        Math.abs(f.latitude - lat) < 0.01 && Math.abs(f.longitude - lon) < 0.01
      ),
  );
  saveFavorites(favs);
}

/**
 * Check if a location is in favorites.
 */
export function isFavorite(lat, lon) {
  return getFavorites().some(
    (f) =>
      Math.abs(f.latitude - lat) < 0.01 && Math.abs(f.longitude - lon) < 0.01,
  );
}

// ── Banner State ─────────────────────────────────────────────────────────────

export function isBannerClosed() {
  return localStorage.getItem(STORAGE_KEYS.BANNER_CLOSED) === "1";
}

export function closeBanner() {
  localStorage.setItem(STORAGE_KEYS.BANNER_CLOSED, "1");
}
