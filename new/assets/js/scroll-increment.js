/**
 * Scroll snap functionality - JavaScript-based snapping to section boundaries
 */

import { scrollSettings } from "./settings.js";

let isScrolling = false;
let scrollTimeout = null;
let lastScrollTop = 0;

/**
 * Get the row height from CSS
 */
function getRowHeight() {
  const rootStyles = getComputedStyle(document.documentElement);
  const cssRowHeight = parseFloat(rootStyles.getPropertyValue("--row-height"));
  return !isNaN(cssRowHeight) && cssRowHeight > 0 ? cssRowHeight : window.innerHeight / 10;
}

/**
 * Get all snap points at row-height intervals
 */
function getSnapPoints() {
  const rowHeight = getRowHeight();
  const documentHeight = Math.max(
    document.body.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.clientHeight,
    document.documentElement.scrollHeight,
    document.documentElement.offsetHeight
  );

  const snapPoints = [];
  const numSnapPoints = Math.ceil(documentHeight / rowHeight);

  // Generate snap points at every row-height increment
  for (let i = 0; i <= numSnapPoints; i++) {
    const snapTop = i * rowHeight;
    snapPoints.push({
      top: snapTop,
    });
  }

  return snapPoints;
}

/**
 * Find the nearest snap point to the current scroll position
 */
function findNearestSnapPoint(scrollTop, snapPoints) {
  if (snapPoints.length === 0) return null;

  let nearest = snapPoints[0];
  let minDistance = Math.abs(scrollTop - nearest.top);

  for (let i = 1; i < snapPoints.length; i++) {
    const distance = Math.abs(scrollTop - snapPoints[i].top);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = snapPoints[i];
    }
  }

  return nearest;
}

/**
 * Snap to the nearest section
 */
function snapToNearest() {
  if (isScrolling) return;

  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const snapPoints = getSnapPoints();

  if (snapPoints.length === 0) return;

  const nearest = findNearestSnapPoint(scrollTop, snapPoints);
  if (!nearest) return;

  // Only snap if we're not already at the snap point (within 1px tolerance)
  const distance = Math.abs(scrollTop - nearest.top);
  if (distance > 1) {
    isScrolling = true;
    window.scrollTo({
      top: nearest.top,
      behavior: "smooth",
    });

    // Reset scrolling flag after animation
    setTimeout(() => {
      isScrolling = false;
    }, 500);
  }
}

/**
 * Handle scroll events
 */
function handleScroll() {
  if (isScrolling) return;

  // Clear existing timeout
  if (scrollTimeout) {
    clearTimeout(scrollTimeout);
  }

  // Set a timeout to snap after scrolling stops
  scrollTimeout = setTimeout(() => {
    snapToNearest();
    scrollTimeout = null;
  }, 100); // Wait 100ms after scrolling stops
}

/**
 * Initialize scroll snapping
 */
export function initScrollIncrement() {
  if (!scrollSettings.enabled) return;

  // Don't interfere with dome mode
  if (document.body.classList.contains("dome-mode")) return;

  // Initial snap on load
  window.addEventListener("load", () => {
    setTimeout(() => {
      snapToNearest();
    }, 100);
  });

  // Handle scroll events
  let ticking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    },
    { passive: true }
  );

  // Handle window resize to recalculate snap points
  window.addEventListener("resize", () => {
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
      scrollTimeout = null;
    }
    setTimeout(() => {
      snapToNearest();
    }, 100);
  });
}
