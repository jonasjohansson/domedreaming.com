/**
 * Shared utility functions
 */

/**
 * Detect if the current device is mobile
 * @returns {boolean} True if mobile device
 */
export function isMobile() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0;
}

/**
 * Get the actual viewport height, accounting for iOS Safari's address bar
 * Uses visualViewport API when available, falls back to clientHeight
 */
export function getActualViewportHeight() {
  // Use visualViewport API if available (modern iOS Safari)
  if (window.visualViewport && window.visualViewport.height) {
    return window.visualViewport.height;
  }
  // Fallback to clientHeight which excludes browser UI
  return document.documentElement.clientHeight || window.innerHeight;
}

/**
 * Update the CSS custom property for actual viewport height
 * This should be called on resize and orientation change
 * Note: --actual-vh is now set via CSS (100vh default), not inline styles
 */
export function updateViewportHeightCSS() {
  // --actual-vh is now set via CSS, not inline styles
  // const actualHeight = getActualViewportHeight();
  // document.documentElement.style.setProperty("--actual-vh", `${actualHeight}px`);
}

/**
 * Get the row height from CSS
 * Used across multiple modules to avoid duplication
 */
export function getRowHeight() {
  const rootStyles = getComputedStyle(document.documentElement);
  const cssRowHeight = rootStyles.getPropertyValue("--row-height");
  const parsed = parseFloat(cssRowHeight);
  if (!isNaN(parsed) && parsed > 0) {
    return parsed;
  }
  // Fallback: use actual viewport height divided by grid rows (16)
  const gridRows = parseFloat(rootStyles.getPropertyValue("--grid-rows")) || 16;
  return getActualViewportHeight() / gridRows;
}

/**
 * Defer work to idle time or next frame
 * Uses requestIdleCallback when available, falls back to setTimeout
 * @param {Function} callback - The work to defer
 * @param {number} timeout - Max time to wait before forcing execution (ms)
 */
export function deferWork(callback, timeout = 100) {
  if ("requestIdleCallback" in window) {
    requestIdleCallback(callback, { timeout });
  } else {
    setTimeout(callback, 0);
  }
}

/**
 * Batch multiple callbacks to run in idle time
 * @param {Function[]} callbacks - Array of functions to run
 * @param {number} timeout - Max time per batch
 */
export function batchDeferWork(callbacks, timeout = 100) {
  if (!callbacks.length) return;

  deferWork(() => {
    const batch = callbacks.splice(0, 3); // Process 3 at a time
    batch.forEach(cb => cb());
    if (callbacks.length) {
      batchDeferWork(callbacks, timeout);
    }
  }, timeout);
}

