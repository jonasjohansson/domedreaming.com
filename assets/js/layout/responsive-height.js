/**
 * Responsive height functionality
 * Removes any inline height styles from page-sections to let CSS handle it
 */

/**
 * Remove inline height styles from page-sections (let CSS handle heights)
 */
function removeInlineHeights() {
  const responsivePageContents = document.querySelectorAll(".page-content.responsive");
  responsivePageContents.forEach((pageContent) => {
    const pageSection = pageContent.closest(".page-section");
    if (pageSection) {
      pageSection.style.height = "";
      pageSection.style.minHeight = "";
    }
  });
}

/**
 * Initialize responsive height system
 */
export function initResponsiveHeights() {
  // Remove any inline styles to let CSS handle heights
  removeInlineHeights();

  // Also remove on resize in case any get added
  let resizeTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      removeInlineHeights();
    }, 100);
  });

  // Remove on load as well
  window.addEventListener("load", () => {
    removeInlineHeights();
  });
}
