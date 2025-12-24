/**
 * Shared utility functions
 */

/**
 * Get the row height from CSS
 * Used across multiple modules to avoid duplication
 * On iOS, uses actual viewport height to account for dynamic address bar
 */
export function getRowHeight() {
  const rootStyles = getComputedStyle(document.documentElement);
  const cssRowHeight = rootStyles.getPropertyValue("--row-height");
  const parsed = parseFloat(cssRowHeight);
  
  // On iOS, use actual viewport height instead of CSS calc(100vh) to avoid address bar issues
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (isIOS) {
    // Use the actual visible viewport height, not 100vh which includes address bar area
    const actualViewportHeight = window.innerHeight || document.documentElement.clientHeight;
    return actualViewportHeight / 10;
  }
  
  return !isNaN(parsed) && parsed > 0 ? parsed : window.innerHeight / 10;
}

