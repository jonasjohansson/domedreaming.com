/**
 * Grid dots functionality
 * Creates grid dots using DOM elements grouped by rows
 */

let dotsContainer = null;
let gridColumns = 16;
let colWidth = 0;
let rowHeight = 0;

/**
 * Initialize grid dots
 */
function initGridDots() {
  // Remove existing container if any
  const existingContainer = document.getElementById("dots");
  if (existingContainer) {
    existingContainer.remove();
  }

  // Create container
  dotsContainer = document.createElement("div");
  dotsContainer.id = "dots";
  document.body.appendChild(dotsContainer);

  updateDotsSize();
  createDotElements();
}

/**
 * Update dots size and grid calculations
 */
function updateDotsSize() {
  const rootStyles = getComputedStyle(document.documentElement);

  // Use documentElement.clientWidth instead of window.innerWidth for better iOS compatibility
  // This avoids issues with iOS Safari's dynamic viewport
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth;

  // Column width from CSS var (falls back to viewport width / columns)
  const colWidthCSS = rootStyles.getPropertyValue("--col-width");
  if (colWidthCSS) {
    colWidth = parseFloat(colWidthCSS) || viewportWidth / gridColumns;
  } else {
    colWidth = viewportWidth / gridColumns;
  }

  // Row height from CSS var (falls back to colWidth)
  const rowHeightCSS = rootStyles.getPropertyValue("--row-height");
  const parsedRowHeight = parseFloat(rowHeightCSS);
  rowHeight = !isNaN(parsedRowHeight) && parsedRowHeight > 0 ? parsedRowHeight : colWidth;
}

/**
 * Create dot elements - fixed 16x16 grid
 * Batched to avoid long main-thread tasks
 */
function createDotElements() {
  if (!dotsContainer) return;

  // Clear existing dots
  dotsContainer.innerHTML = "";

  const totalRows = 16; // Fixed 16 rows
  const totalDots = totalRows * gridColumns;
  const batchSize = 32; // Create dots in batches to avoid blocking
  let currentIndex = 0;

  function createBatch() {
    const endIndex = Math.min(currentIndex + batchSize, totalDots);
    
    for (let i = currentIndex; i < endIndex; i++) {
      const row = Math.floor(i / gridColumns);
      const col = i % gridColumns;
      
      const dot = document.createElement("div");
      dot.className = "dot";
      dot.dataset.col = col + 1; // 1-indexed
      dot.dataset.row = row + 1; // 1-indexed
      // Set grid position using CSS Grid
      dot.style.gridColumn = col + 1;
      dot.style.gridRow = row + 1;
      // Disable pointer events to prevent hover
      dot.style.pointerEvents = "none";
      // Set animation delay: data-col + ((data-row - 1) * number of cols)
      const colNum = col + 1;
      const rowNum = row + 1;
      const delayValue = colNum + ((rowNum - 1) * gridColumns);
      dot.style.setProperty("--dot-delay", delayValue);

      dotsContainer.appendChild(dot);
    }
    
    currentIndex = endIndex;
    
    if (currentIndex < totalDots) {
      // Use requestIdleCallback or setTimeout to continue batching
      if ('requestIdleCallback' in window) {
        requestIdleCallback(createBatch, { timeout: 50 });
      } else {
        setTimeout(createBatch, 0);
      }
    }
  }
  
  createBatch();
}

/**
 * Initialize and export
 */
export function initGridDotsSystem() {
  initGridDots();

  // Debounce resize handler for iOS Safari (address bar show/hide causes frequent resizes)
  let resizeTimeout;
  const handleResize = () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      updateDotsSize();
      createDotElements();
    }, 150); // Debounce resize events, especially important for iOS
  };

  // Update on resize to recalculate row height
  window.addEventListener("resize", handleResize);
  // Also listen to orientation change on mobile
  window.addEventListener("orientationchange", () => {
    // Longer delay for orientation change to allow viewport to settle
    setTimeout(() => {
      updateDotsSize();
      createDotElements();
    }, 300);
  });
}
