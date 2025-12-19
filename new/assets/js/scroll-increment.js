/**
 * Scroll snap functionality
 * Allows smooth scrolling but snaps to nearest row-height when scrolling stops
 */

import * as settings from "./settings.js";

let scrollTimeout = null;
let isScrolling = false;

/**
 * Get the row height in pixels
 * Row height is 1/10th of viewport height (100vh / 10)
 */
function getRowHeight() {
  const rootStyles = getComputedStyle(document.documentElement);
  const cssRowHeight = parseFloat(rootStyles.getPropertyValue("--row-height"));
  if (!isNaN(cssRowHeight) && cssRowHeight > 0) {
    return cssRowHeight;
  }

  // Fallback: calculate from viewport height divided by grid rows
  const gridRows = settings.scrollSettings.gridRows || 10;
  const fallback = window.innerHeight / gridRows;
  return fallback;
}

/**
 * Round scroll position to nearest row height
 */
function roundToRowHeight(scrollY) {
  const rowHeight = getRowHeight();
  return Math.round(scrollY / rowHeight) * rowHeight;
}

/**
 * Snap to nearest row height
 */
function snapToRowHeight() {
  if (!settings.scrollSettings.enabled) return;
  if (document.body.classList.contains("dome-mode")) return;

  const currentScroll = window.scrollY || window.pageYOffset;
  const rowHeight = getRowHeight();
  const snappedScroll = roundToRowHeight(currentScroll);

  // Only snap if we're not already at a snap point
  if (Math.abs(snappedScroll - currentScroll) > 1) {
    window.scrollTo({
      top: snappedScroll,
      behavior: "smooth",
    });
  }
}

/**
 * Handle scroll events - detect when scrolling stops and snap
 */
function handleScroll() {
  if (!settings.scrollSettings.enabled) return;
  if (document.body.classList.contains("dome-mode")) return;

  isScrolling = true;

  // Clear existing timeout
  clearTimeout(scrollTimeout);

  // Set a new timeout to snap when scrolling stops
  scrollTimeout = setTimeout(() => {
    isScrolling = false;
    snapToRowHeight();
  }, 150); // Wait 150ms after scrolling stops before snapping
}

/**
 * Initialize scroll snap functionality
 */
export function initScrollIncrement() {
  // Listen for scroll events (works for both mouse wheel and touch)
  window.addEventListener("scroll", handleScroll, { passive: true });

  // Snap to row height on initial load if needed
  const currentScroll = window.scrollY || window.pageYOffset;
  if (currentScroll > 0) {
    const rowHeight = getRowHeight();
    const snappedScroll = roundToRowHeight(currentScroll);
    if (Math.abs(snappedScroll - currentScroll) > settings.scrollSettings.initialSnapThreshold) {
      window.scrollTo({
        top: snappedScroll,
        behavior: "auto",
      });
    }
  }
}
