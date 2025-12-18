/**
 * Scroll increment functionality
 * Makes the page scroll in row-height increments for a tactile, stepped scrolling experience
 */

import * as settings from "./settings.js";

let isScrolling = false;
let scrollTimeout = null;
let lastScrollTime = 0;

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
 * Handle scroll events and snap to row heights
 */
function handleScroll(event) {
  if (!settings.scrollSettings.enabled) return;

  // If already scrolling, prevent further scroll events
  if (isScrolling) {
    event.preventDefault();
    return;
  }

  event.preventDefault(); // Prevent default smooth scrolling

  const now = Date.now();
  const timeSinceLastScroll = now - lastScrollTime;

  // Throttle: only allow scroll if enough time has passed
  if (timeSinceLastScroll < settings.scrollSettings.scrollTimeout) {
    return;
  }

  const currentScroll = window.scrollY || window.pageYOffset;
  const rowHeight = getRowHeight();
  const scrollAmount = rowHeight; // Full row height
  const delta = event.deltaY || event.detail || -event.wheelDelta;

  // Determine scroll direction
  const scrollDirection = delta > 0 ? 1 : -1;

  // Calculate target scroll position - move by full row height
  let targetScroll = currentScroll + scrollDirection * scrollAmount;

  // Snap to nearest row
  targetScroll = Math.round(targetScroll / scrollAmount) * scrollAmount;

  // Clamp to valid scroll range
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  targetScroll = Math.max(0, Math.min(targetScroll, maxScroll));

  // Only scroll if we're moving to a different position
  if (Math.abs(targetScroll - currentScroll) > settings.scrollSettings.snapThreshold) {
    isScrolling = true;
    lastScrollTime = now;

    // Instant scroll - no smooth behavior for tactile feel
    window.scrollTo({
      top: targetScroll,
      behavior: "auto",
    });

    // Reset scrolling flag after a shorter timeout for more responsive feel
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      isScrolling = false;
    }, settings.scrollSettings.scrollTimeout);
  }
}

/**
 * Handle touch scroll for mobile
 */
let touchStartY = 0;
let touchStartScroll = 0;

function handleTouchStart(event) {
  touchStartY = event.touches[0].clientY;
  touchStartScroll = window.scrollY || window.pageYOffset;
}

function handleTouchMove(event) {
  if (isScrolling) {
    event.preventDefault();
    return;
  }
}

function handleTouchEnd(event) {
  if (!settings.scrollSettings.enabled) return;

  // If already scrolling, prevent further actions
  if (isScrolling) {
    event.preventDefault();
    return;
  }

  const touchEndY = event.changedTouches[0].clientY;
  const deltaY = touchStartY - touchEndY;
  const rowHeight = getRowHeight();
  const scrollAmount = rowHeight; // Full row height

  if (Math.abs(deltaY) > settings.scrollSettings.touchThreshold) {
    const now = Date.now();
    const timeSinceLastScroll = now - lastScrollTime;

    // Throttle: only allow scroll if enough time has passed
    if (timeSinceLastScroll < settings.scrollSettings.scrollTimeout) {
      return;
    }

    // Significant touch movement - snap immediately
    event.preventDefault();
    const currentScroll = window.scrollY || window.pageYOffset;
    const scrollDirection = deltaY > 0 ? 1 : -1;

    // Calculate target scroll position - move by full row height and snap
    let targetScroll = currentScroll + scrollDirection * scrollAmount;
    targetScroll = Math.round(targetScroll / scrollAmount) * scrollAmount;

    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    targetScroll = Math.max(0, Math.min(targetScroll, maxScroll));

    if (Math.abs(targetScroll - currentScroll) > settings.scrollSettings.snapThreshold) {
      isScrolling = true;
      lastScrollTime = now;

      // Immediate snap - no smooth scrolling for tactile feel
      window.scrollTo({
        top: targetScroll,
        behavior: "auto",
      });

      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        isScrolling = false;
      }, settings.scrollSettings.scrollTimeout);
    }
  }
}

/**
 * Handle keyboard scroll (arrow keys, page up/down)
 */
function handleKeyDown(event) {
  if (!settings.scrollSettings.enabled) return;

  const now = Date.now();
  const timeSinceLastScroll = now - lastScrollTime;

  // Throttle: only allow scroll if enough time has passed
  if (timeSinceLastScroll < settings.scrollSettings.scrollTimeout) {
    return;
  }

  const rowHeight = getRowHeight();
  const scrollAmount = rowHeight; // Full row height
  const currentScroll = window.scrollY || window.pageYOffset;
  let targetScroll = currentScroll;

  switch (event.key) {
    case "ArrowDown":
    case "PageDown":
      event.preventDefault();
      targetScroll = currentScroll + scrollAmount;
      targetScroll = Math.round(targetScroll / scrollAmount) * scrollAmount;
      break;
    case "ArrowUp":
    case "PageUp":
      event.preventDefault();
      targetScroll = currentScroll - scrollAmount;
      targetScroll = Math.round(targetScroll / scrollAmount) * scrollAmount;
      break;
    case "Home":
      event.preventDefault();
      targetScroll = 0;
      break;
    case "End":
      event.preventDefault();
      targetScroll = document.documentElement.scrollHeight - window.innerHeight;
      targetScroll = Math.round(targetScroll / scrollAmount) * scrollAmount;
      break;
    default:
      return; // Don't handle other keys
  }

  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  targetScroll = Math.max(0, Math.min(targetScroll, maxScroll));

  if (Math.abs(targetScroll - currentScroll) > settings.scrollSettings.snapThreshold) {
    isScrolling = true;
    lastScrollTime = now;

    window.scrollTo({
      top: targetScroll,
      behavior: "auto",
    });

    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      isScrolling = false;
    }, settings.scrollSettings.scrollTimeout);
  }
}

/**
 * Check if device is a touch device
 */
function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * Initialize scroll increment functionality
 */
export function initScrollIncrement() {
  // On touch devices, use normal scrolling behavior
  if (isTouchDevice()) {
    return; // Don't initialize custom scroll behavior on touch devices
  }

  // Wheel event (mouse wheel) - desktop only
  window.addEventListener("wheel", handleScroll, { passive: false });

  // Keyboard events - desktop only
  window.addEventListener("keydown", handleKeyDown);

  // Snap to row height on initial load if needed
  const currentScroll = window.scrollY || window.pageYOffset;
  if (currentScroll > 0) {
    const rowHeight = getRowHeight();
    const snappedScroll = Math.round(currentScroll / rowHeight) * rowHeight;
    if (Math.abs(snappedScroll - currentScroll) > settings.scrollSettings.initialSnapThreshold) {
      window.scrollTo({
        top: snappedScroll,
        behavior: "auto",
      });
    }
  }
}
