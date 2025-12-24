/**
 * Responsive height functionality
 * Makes .block.responsive elements grow in row-height increments based on content
 */

/**
 * Get the row height from CSS
 */
function getRowHeight() {
  const rootStyles = getComputedStyle(document.documentElement);
  const cssRowHeight = rootStyles.getPropertyValue("--row-height");
  const parsed = parseFloat(cssRowHeight);
  return !isNaN(parsed) && parsed > 0 ? parsed : window.innerHeight / 10;
}

/**
 * Calculate the number of row-heights needed for content
 * Expands incrementally: if content exceeds current height by at least one row-height, add one more row
 */
function calculateRowHeights(contentHeight, currentHeight, minRows = 10) {
  const rowHeight = getRowHeight();
  const currentRows = currentHeight ? Math.round(currentHeight / rowHeight) : minRows;
  const currentHeightInRows = Math.max(currentRows, minRows);
  
  // Check if content exceeds current height by at least one row-height
  const heightDifference = contentHeight - (currentHeightInRows * rowHeight);
  
  if (heightDifference >= rowHeight) {
    // Content exceeds by at least one row-height, add one more row
    return currentHeightInRows + 1;
  }
  
  // Otherwise, keep current height (but at least minimum)
  return Math.max(currentHeightInRows, minRows);
}

/**
 * Update responsive block heights
 */
function updateResponsiveHeights() {
  const responsiveBlocks = document.querySelectorAll(".block.responsive");
  
  responsiveBlocks.forEach((block) => {
    // Get current height (from style or computed)
    const currentComputedHeight = parseFloat(getComputedStyle(block).height) || 0;
    const currentStyleHeight = block.style.height ? parseFloat(block.style.height) : null;
    const currentHeight = currentStyleHeight || currentComputedHeight;
    
    // Temporarily remove height constraints to measure natural content height
    const originalHeight = block.style.height;
    const originalMinHeight = block.style.minHeight;
    block.style.height = "auto";
    block.style.minHeight = "auto";
    
    // Measure the content height
    const contentHeight = block.scrollHeight;
    
    // Calculate required row-heights based on content exceeding current height by row-height
    const requiredRows = calculateRowHeights(contentHeight, currentHeight, 10);
    const requiredHeight = requiredRows * getRowHeight();
    
    // Set the height to the calculated row-height increment
    block.style.height = `${requiredHeight}px`;
    block.style.minHeight = `${requiredHeight}px`;
    
    // Also update the grid-row span if the block has explicit row classes
    // This ensures the grid layout accommodates the new height
    const currentRowSpan = block.style.gridRowEnd || "";
    if (!currentRowSpan || currentRowSpan === "span 1") {
      // Only update if not explicitly set
      block.style.gridRowEnd = `span ${requiredRows}`;
    }
  });
  
  // Also update parent page-content.responsive if needed
  const responsivePageContents = document.querySelectorAll(".page-content.responsive");
  responsivePageContents.forEach((pageContent) => {
    const blocks = pageContent.querySelectorAll(".block.responsive");
    if (blocks.length === 0) return;
    
    // Find the maximum required rows from all blocks
    let maxRows = 10; // Default minimum
    blocks.forEach((block) => {
      const blockHeight = parseFloat(getComputedStyle(block).height);
      const blockRows = Math.ceil(blockHeight / getRowHeight());
      maxRows = Math.max(maxRows, blockRows);
    });
    
    // Update the parent page-section if it exists
    const pageSection = pageContent.closest(".page-section");
    if (pageSection) {
      const requiredHeight = maxRows * getRowHeight();
      pageSection.style.height = `${requiredHeight}px`;
      pageSection.style.minHeight = `${requiredHeight}px`;
    }
  });
}

/**
 * Initialize responsive height system
 */
export function initResponsiveHeights() {
  // Initial update
  updateResponsiveHeights();
  
  // Update on window resize
  let resizeTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      updateResponsiveHeights();
    }, 100);
  });
  
  // Update when content changes (images load, text changes, etc.)
  const observer = new MutationObserver(() => {
    // Debounce updates
    if (window.responsiveHeightUpdateTimeout) {
      clearTimeout(window.responsiveHeightUpdateTimeout);
    }
    window.responsiveHeightUpdateTimeout = setTimeout(() => {
      updateResponsiveHeights();
    }, 200);
  });
  
  // Observe all responsive blocks and their parents
  const responsiveBlocks = document.querySelectorAll(".block.responsive");
  responsiveBlocks.forEach((block) => {
    observer.observe(block, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class"],
    });
  });
  
  // Also observe page-content.responsive containers
  const responsivePageContents = document.querySelectorAll(".page-content.responsive");
  responsivePageContents.forEach((pageContent) => {
    observer.observe(pageContent, {
      childList: true,
      subtree: true,
    });
  });
  
  // Update when images load
  const images = document.querySelectorAll(".block.responsive img");
  images.forEach((img) => {
    if (!img.complete) {
      img.addEventListener("load", () => {
        updateResponsiveHeights();
      });
    }
  });
}

