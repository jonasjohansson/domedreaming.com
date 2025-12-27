/**
 * Scroll increment functionality - forces page to scroll in row-height steps (no smooth scrolling)
 */

import { scrollSettings } from "./settings.js";
import { getRowHeight } from "./utils.js";

let isScrolling = false;
let lastScrollTime = 0;
const SCROLL_DELAY = 50; // Delay in milliseconds between scroll increments

// Touch event handling for mobile
let touchStartY = 0;
let touchStartTime = 0;
let touchMoved = false;
let lastTouchY = 0;
let touchScrollAccumulator = 0; // Accumulate touch movement for continuous scrolling
const MIN_SWIPE_DISTANCE = 30; // Minimum distance in pixels to trigger first scroll

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

  // On mobile/iOS, use larger tolerance to avoid interfering with momentum scrolling
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const tolerance = isMobile ? 5 : 1; // Larger tolerance on mobile

  // If we're not at a row increment, snap to it
  const distance = Math.abs(scrollTop - nearestRow);
  if (distance > tolerance) {
    snapToNearestRow();
  }
}

/**
 * Scroll to a specific row increment
 */
function scrollToRowIncrement(scrollDirection) {
  const now = Date.now();

  // Check if enough time has passed since last scroll
  if (now - lastScrollTime < SCROLL_DELAY) {
    return; // Too soon, ignore this scroll event
  }

  const rowHeight = getRowHeight();
  const currentScroll = window.pageYOffset || document.documentElement.scrollTop;

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
 * Handle wheel events to scroll in row-height increments with delay
 */
function handleWheel(e) {
  // Don't interfere with dome mode
  if (document.body.classList.contains("dome-mode")) return;

  // Prevent default scrolling
  e.preventDefault();

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
    scrollToRowIncrement(scrollDirection);
  }
}

/**
 * Handle touch events for mobile scrolling - prevent default and use incremental scroll
 */
function handleTouchStart(e) {
  // Don't interfere with dome mode
  if (document.body.classList.contains("dome-mode")) return;

  // Only handle single touch
  if (e.touches.length !== 1) return;

  touchStartY = e.touches[0].clientY;
  lastTouchY = touchStartY;
  touchStartTime = Date.now();
  touchMoved = false;
  touchScrollAccumulator = 0;
}

function handleTouchMove(e) {
  // Don't interfere with dome mode
  if (document.body.classList.contains("dome-mode")) return;

  if (e.touches.length !== 1) return;

  // Prevent default scrolling to use our incremental system
  e.preventDefault();

  const touchY = e.touches[0].clientY;
  const deltaY = lastTouchY - touchY; // Movement since last touch move
  const totalDeltaY = touchStartY - touchY; // Total movement from start

  // If moved significantly, mark as moved
  if (Math.abs(totalDeltaY) > 10) {
    touchMoved = true;
  }

  // Accumulate touch movement
  touchScrollAccumulator += deltaY;
  lastTouchY = touchY;

  // Check if we've accumulated enough movement for a scroll increment
  const rowHeight = getRowHeight();
  const scrollThreshold = rowHeight * 0.3; // Trigger scroll at 30% of row height

  if (Math.abs(touchScrollAccumulator) >= scrollThreshold) {
    // Determine scroll direction
    const scrollDirection = touchScrollAccumulator > 0 ? 1 : -1;

    // Trigger scroll increment
    scrollToRowIncrement(scrollDirection);

    // Reset accumulator (keep remainder for smooth continuous scrolling)
    touchScrollAccumulator = touchScrollAccumulator % scrollThreshold;
  }
}

function handleTouchEnd(e) {
  // Don't interfere with dome mode
  if (document.body.classList.contains("dome-mode")) return;

  // Prevent default scrolling
  e.preventDefault();

  // Reset touch state
  touchMoved = false;
  touchScrollAccumulator = 0;
}

/**
 * Initialize scroll increment
 */
export function initScrollIncrement() {
  if (!scrollSettings.enabled) return;

  // Don't interfere with dome mode
  if (document.body.classList.contains("dome-mode")) return;

  // Handle wheel events for step-based scrolling (desktop)
  window.addEventListener("wheel", handleWheel, { passive: false });

  // Handle touch events for step-based scrolling (mobile)
  // Use passive: false to prevent default scrolling and use our incremental system
  document.addEventListener("touchstart", handleTouchStart, { passive: false });
  document.addEventListener("touchmove", handleTouchMove, { passive: false });
  document.addEventListener("touchend", handleTouchEnd, { passive: false });

  // Handle scroll events to snap to nearest row if user scrolls by other means
  // On mobile, we prevent default touch scrolling, so this mainly handles programmatic scrolling
  let scrollTimeout = null;

  window.addEventListener(
    "scroll",
    () => {
      if (isScrolling) return;

      // Clear existing timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }

      // Shorter delay since we're controlling scrolling on mobile
      const delay = 50;

      // Snap after a brief delay
      scrollTimeout = setTimeout(() => {
        handleScroll();
        scrollTimeout = null;
      }, delay);
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
