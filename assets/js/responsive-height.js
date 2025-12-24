/**
 * Responsive height functionality
 * Makes .block.responsive elements grow in row-height increments based on content
 */

import { getRowHeight } from "./utils.js";

/**
 * Update responsive block heights - fixed to 10 row-heights
 */
function updateResponsiveHeights() {
  const responsiveBlocks = document.querySelectorAll(".block.responsive");
  const rowHeight = getRowHeight();
  const fixedHeight = rowHeight * 10; // Fixed 10 row-heights

  responsiveBlocks.forEach((block) => {
    // Set fixed height to 10 row-heights
    block.style.height = `${fixedHeight}px`;
    block.style.minHeight = `${fixedHeight}px`;
  });
}

/**
 * Initialize responsive height system
 */
export function initResponsiveHeights() {
  // Initial update
  updateResponsiveHeights();

  // Update on window resize (to recalculate row-height)
  let resizeTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      updateResponsiveHeights();
    }, 100);
  });
}
