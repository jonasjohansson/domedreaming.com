/**
 * Responsive height functionality
 * Makes .block.responsive elements grow in row-height increments based on content
 * Also adjusts .page-section height for .page-content.responsive elements
 */

import { getRowHeight } from "../core/utils.js";

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
 * Update page-section heights for .page-content.responsive elements
 * Calculates required rows based on content offsetHeight
 * Only applies on mobile (max-width: 768px) to match CSS media query
 */
function updatePageContentResponsiveHeights() {
  // Only run on mobile to match CSS media query
  const isMobile = window.innerWidth <= 768;
  if (!isMobile) {
    // On desktop, remove any inline styles to let CSS handle it
    const responsivePageContents = document.querySelectorAll(".page-content.responsive");
    responsivePageContents.forEach((pageContent) => {
      const pageSection = pageContent.closest(".page-section");
      if (pageSection) {
        pageSection.style.height = "";
        pageSection.style.minHeight = "";
      }
    });
    return;
  }

  const responsivePageContents = document.querySelectorAll(".page-content.responsive");
  const rowHeight = getRowHeight();
  const defaultRowCount = 10;

  responsivePageContents.forEach((pageContent) => {
    // Get the parent .page-section
    const pageSection = pageContent.closest(".page-section");
    if (!pageSection) return;

    // Temporarily remove height constraint to measure true content height
    pageSection.style.height = "auto";
    pageSection.style.minHeight = "auto";

    // Get the actual content height when unconstrained
    const contentHeight = pageContent.offsetHeight;
    const defaultHeight = rowHeight * defaultRowCount;

    // If content is taller than default (10 rows), calculate required rows
    if (contentHeight > defaultHeight) {
      const requiredRows = Math.ceil(contentHeight / rowHeight);
      // Set height using CSS calc with row-height
      pageSection.style.height = `calc(var(--row-height) * ${requiredRows})`;
      pageSection.style.minHeight = `calc(var(--row-height) * ${requiredRows})`;
    } else {
      // Reset to default if content fits (10 rows)
      pageSection.style.height = `calc(var(--row-height) * ${defaultRowCount})`;
      pageSection.style.minHeight = `calc(var(--row-height) * ${defaultRowCount})`;
    }
  });
}

/**
 * Initialize responsive height system
 */
export function initResponsiveHeights() {
  // Initial update
  updateResponsiveHeights();
  updatePageContentResponsiveHeights();

  // Update on window resize (to recalculate row-height)
  let resizeTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      updateResponsiveHeights();
      updatePageContentResponsiveHeights();
    }, 100);
  });

  // Also update on load to ensure content is measured after all assets load
  window.addEventListener("load", () => {
    updatePageContentResponsiveHeights();
  });
}
