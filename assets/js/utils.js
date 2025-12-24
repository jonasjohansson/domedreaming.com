/**
 * Shared utility functions
 */

/**
 * Get the row height from CSS
 * Used across multiple modules to avoid duplication
 */
export function getRowHeight() {
  const rootStyles = getComputedStyle(document.documentElement);
  const cssRowHeight = rootStyles.getPropertyValue("--row-height");
  const parsed = parseFloat(cssRowHeight);
  return !isNaN(parsed) && parsed > 0 ? parsed : window.innerHeight / 10;
}

