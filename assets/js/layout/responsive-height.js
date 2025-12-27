/**
 * Responsive height functionality
 * Dynamically adjusts height of responsive sections based on content
 */

import { getRowHeight } from "../core/utils.js";

/**
 * Calculate and set appropriate height for responsive sections
 */
function adjustResponsiveHeights() {
  const rootStyles = getComputedStyle(document.documentElement);
  const gridRows = parseFloat(rootStyles.getPropertyValue("--grid-rows")) || 16;
  const rowHeight = getRowHeight();
  const minHeight = gridRows * rowHeight;

  // Check all page sections for responsive blocks
  const allSections = document.querySelectorAll(".page-section");

  allSections.forEach((section) => {
    // Find the responsive block inside this section
    const responsiveBlock = section.querySelector(".block.responsive");
    if (!responsiveBlock) return;

    // Temporarily set section height to auto to measure content properly
    const originalHeight = section.style.height;
    section.style.height = "auto";

    // Measure the actual content height of the responsive block
    const contentHeight = responsiveBlock.offsetHeight;

    // Restore original style
    section.style.height = originalHeight;

    // Start with minimum height (grid-rows)
    let currentRows = gridRows;
    let currentHeight = currentRows * rowHeight;

    // Increment by row-height until section is tall enough to fit content
    while (currentHeight < contentHeight) {
      currentRows++;
      currentHeight = currentRows * rowHeight;
    }

    // Add one additional row-height for breathing room
    currentRows++;

    // Set CSS variable for the number of grid rows needed
    section.style.setProperty("--section-grid-rows", currentRows.toString());
  });
}

/**
 * Initialize responsive height system
 */
export function initResponsiveHeights() {
  // Adjust heights on load
  window.addEventListener("load", () => {
    // Small delay to ensure all content is rendered
    setTimeout(() => {
      adjustResponsiveHeights();
    }, 100);
  });

  // Adjust heights on resize
  let resizeTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      adjustResponsiveHeights();
    }, 100);
  });

  // Also run immediately if DOM is already loaded
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(() => {
      adjustResponsiveHeights();
    }, 100);
  }
}
