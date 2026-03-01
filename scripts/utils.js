/**
 * RetroCast – Utility helpers
 * Only functions that are actually used by other modules.
 */

import { LIMITS } from "./constants.js";

/**
 * Format a Date to YYYY-MM-DD (Open-Meteo's expected format).
 */
export function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Human-friendly display date, e.g. "Thu, Feb 26".
 */
export function formatDisplayDate(date) {
  const d = date instanceof Date ? date : new Date(date + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Return a human label for a past date relative to today.
 * 1 → "Yesterday", 2 → "2 days ago", etc.
 */
export function getRelativeDayLabel(daysAgo) {
  if (daysAgo === 1) return "Yesterday";
  return `${daysAgo} days ago`;
}

/**
 * Debounce a function call.
 */
export function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Retry an async function with exponential backoff.
 */
export async function retry(
  fn,
  {
    attempts = LIMITS.RETRY_ATTEMPTS,
    baseDelay = LIMITS.RETRY_BASE_DELAY_MS,
  } = {},
) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, baseDelay * 2 ** i));
      }
    }
  }
  throw lastError;
}

/**
 * Get a Date object for N days ago (midnight local time).
 */
export function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}
