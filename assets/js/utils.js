/**
 * Shared utility functions
 */

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
 */
export function updateViewportHeightCSS() {
  const actualHeight = getActualViewportHeight();
  document.documentElement.style.setProperty("--actual-vh", `${actualHeight}px`);
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
  // Fallback: use actual viewport height instead of innerHeight
  return getActualViewportHeight() / 10;
}

