/**
 * Scroll increment functionality - forces page to scroll in row-height steps (no smooth scrolling)
 */

import { scrollSettings } from "./settings.js";

let isScrolling = false;
let currentScrollPosition = 0;
let targetScrollPosition = 0;
let lastScrollTime = 0;
const SCROLL_DELAY = 50; // Delay in milliseconds between scroll increments

/**
 * Get the row height from CSS
 */
function getRowHeight() {
  const rootStyles = getComputedStyle(document.documentElement);
  const cssRowHeight = parseFloat(rootStyles.getPropertyValue("--row-height"));
  return !isNaN(cssRowHeight) && cssRowHeight > 0 ? cssRowHeight : window.innerHeight / 10;
}

/**
 * Find the nearest row-height increment to the current scroll position
 */
function getNearestRowIncrement(scrollTop) {
  const rowHeight = getRowHeight();
  // Round to nearest row-height increment
  return Math.round(scrollTop / rowHeight) * rowHeight;
}

/**
 * Snap to the nearest row-height increment (instant, no smooth scrolling)
 */
function snapToNearestRow() {
  if (isScrolling) return;

  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const nearestRow = getNearestRowIncrement(scrollTop);

  // Only snap if we're not already at the row increment (within 1px tolerance)
  const distance = Math.abs(scrollTop - nearestRow);
  if (distance > 1) {
    isScrolling = true;
    // Instant scroll (no smooth behavior)
    window.scrollTo({
      top: nearestRow,
      behavior: "auto", // Instant, no smooth scrolling
    });

    // Reset scrolling flag after a brief delay
    setTimeout(() => {
      isScrolling = false;
    }, 50);
  }
}

/**
 * Handle scroll events and snap to nearest row increment
 */
function handleScroll() {
  if (isScrolling) return;

  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const nearestRow = getNearestRowIncrement(scrollTop);

  // If we're not at a row increment, snap to it
  const distance = Math.abs(scrollTop - nearestRow);
  if (distance > 1) {
    snapToNearestRow();
  }
}

/**
 * Handle wheel events to scroll in row-height increments with delay
 */
function handleWheel(e) {
  // Don't interfere with dome mode
  if (document.body.classList.contains("dome-mode")) return;

  // Prevent default scrolling
  e.preventDefault();

  const now = Date.now();

  // Check if enough time has passed since last scroll
  if (now - lastScrollTime < SCROLL_DELAY) {
    return; // Too soon, ignore this scroll event
  }

  const rowHeight = getRowHeight();
  const currentScroll = window.pageYOffset || document.documentElement.scrollTop;

  // Determine scroll direction
  const delta = e.deltaY;
  let scrollDirection = 0;

  if (delta > 0) {
    // Scrolling down - move to next row
    scrollDirection = 1;
  } else if (delta < 0) {
    // Scrolling up - move to previous row
    scrollDirection = -1;
  }

  if (scrollDirection !== 0) {
    const currentRow = Math.round(currentScroll / rowHeight);
    const targetRow = currentRow + scrollDirection;
    const targetScroll = targetRow * rowHeight;

    // Clamp to valid scroll range
    const maxScroll = Math.max(document.body.scrollHeight - window.innerHeight, document.documentElement.scrollHeight - window.innerHeight);
    const clampedTarget = Math.max(0, Math.min(targetScroll, maxScroll));

    // Only scroll if target is different from current position
    if (Math.abs(clampedTarget - currentScroll) > 1) {
      // Update last scroll time
      lastScrollTime = now;

      // Instant scroll to target row
      window.scrollTo({
        top: clampedTarget,
        behavior: "auto",
      });
    }
  }
}

/**
 * Initialize scroll increment
 */
export function initScrollIncrement() {
  if (!scrollSettings.enabled) return;

  // Don't interfere with dome mode
  if (document.body.classList.contains("dome-mode")) return;

  // Handle wheel events for step-based scrolling
  window.addEventListener("wheel", handleWheel, { passive: false });

  // Handle scroll events to snap to nearest row if user scrolls by other means
  let scrollTimeout = null;
  window.addEventListener(
    "scroll",
    () => {
      if (isScrolling) return;

      // Clear existing timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }

      // Snap after a brief delay to allow natural scroll to complete
      scrollTimeout = setTimeout(() => {
        handleScroll();
        scrollTimeout = null;
      }, 50);
    },
    { passive: true }
  );

  // Initial snap on load
  window.addEventListener("load", () => {
    setTimeout(() => {
      snapToNearestRow();
    }, 100);
  });

  // Handle window resize
  window.addEventListener("resize", () => {
    setTimeout(() => {
      snapToNearestRow();
    }, 100);
  });
}
