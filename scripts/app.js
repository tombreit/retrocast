/**
 * RetroCast – Application entry point
 * Bootstraps the UI controller once the DOM is ready.
 */

import { UIController } from './ui-controller.js';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide icons already present in the HTML
  if (window.lucide) window.lucide.createIcons();

  const app = new UIController();
  app.init();

  // Expose for console debugging if needed
  window.__retrocast = app;
});
