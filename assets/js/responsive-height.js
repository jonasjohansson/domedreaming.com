/**
 * Responsive height functionality
 * Makes .block.responsive elements grow in row-height increments based on content
 */

import { getRowHeight } from "./utils.js";

/**
 * Update responsive block heights - fixed to 10 row-heights (12 on mobile)
 */
function updateResponsiveHeights() {
  const responsiveBlocks = document.querySelectorAll(".block.responsive");
  const rowHeight = getRowHeight();
  // Use 12 rows on mobile, 10 on desktop
  const isMobile = window.innerWidth <= 768;
  const rowCount = isMobile ? 12 : 10;
  const fixedHeight = rowHeight * rowCount;

  responsiveBlocks.forEach((block) => {
    // Set fixed height based on screen size
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
