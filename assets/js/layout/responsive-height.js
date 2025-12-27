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

    // Temporarily remove height constraint to measure actual content height
    const originalHeight = section.style.height;
    const originalMinHeight = section.style.minHeight;
    const originalGridRows = section.style.getPropertyValue("--section-grid-rows");
    
    // Set section to auto height and clear the grid-rows variable to get true content measurement
    section.style.height = "auto";
    section.style.minHeight = "auto";
    section.style.removeProperty("--section-grid-rows");
    
    // Force a reflow to ensure measurements are accurate
    section.offsetHeight;

    // Measure the actual content height of the responsive block
    const contentHeight = responsiveBlock.offsetHeight;

    // Restore original styles
    section.style.height = originalHeight;
    section.style.minHeight = originalMinHeight;
    if (originalGridRows) {
      section.style.setProperty("--section-grid-rows", originalGridRows);
    }

    // Calculate how many row-heights we need (round up, can be less than default grid-rows)
    let neededRows = Math.ceil(contentHeight / rowHeight);
    
    // Ensure minimum of 1 row
    neededRows = Math.max(1, neededRows);
    
    // Add one additional row-height for breathing room
    neededRows++;

    // Set CSS variable for the number of grid rows needed
    section.style.setProperty("--section-grid-rows", neededRows.toString());
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

  // Adjust heights on resize (with debouncing)
  let resizeTimeout;
  const handleResize = () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      adjustResponsiveHeights();
    }, 100);
  };
  
  window.addEventListener("resize", handleResize);
  
  // Also listen to orientation changes and visual viewport changes (for mobile)
  window.addEventListener("orientationchange", handleResize);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", handleResize);
  }

  // Also run immediately if DOM is already loaded
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(() => {
      adjustResponsiveHeights();
    }, 100);
  }
}
