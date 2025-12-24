/**
 * Grid dots functionality
 * Creates grid dots using DOM elements grouped by rows
 */

let dotsContainer = null;
let gridColumns = 15;
let colWidth = 0;
let rowHeight = 0;

/**
 * Initialize grid dots
 */
function initGridDots() {
  // Remove existing container if any
  const existingContainer = document.getElementById("grid-dots-container");
  if (existingContainer) {
    existingContainer.remove();
  }

  // Create container
  dotsContainer = document.createElement("div");
  dotsContainer.id = "grid-dots-container";
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
 * Create dot elements grouped by rows - covers full document height
 */
function createDotElements() {
  if (!dotsContainer) return;

  // Clear existing dots
  dotsContainer.innerHTML = "";

  // Calculate full document height
  const documentHeight = Math.max(
    document.body.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.clientHeight,
    document.documentElement.scrollHeight,
    document.documentElement.offsetHeight
  );

  // Calculate how many rows we need to cover the full document
  const totalRows = Math.ceil(documentHeight / rowHeight);

  // Create dots grouped by rows - covers full document
  for (let row = 0; row < totalRows; row++) {
    // Create a row container for dots
    const rowContainer = document.createElement("div");
    rowContainer.className = "dot-row";

    // Create dots for this row (one per column)
    for (let col = 0; col < gridColumns; col++) {
      const dot = document.createElement("div");
      dot.className = "animated-dot";
      dot.dataset.col = col + 1; // 1-indexed
      dot.dataset.row = row + 1; // 1-indexed
      // Set grid position using data attributes
      dot.style.gridColumn = col + 1;
      dot.style.gridRow = row + 1;
      // Disable pointer events to prevent hover
      dot.style.pointerEvents = "none";

      rowContainer.appendChild(dot);
    }

    dotsContainer.appendChild(rowContainer);
  }

  // Set container height to match the number of rows
  dotsContainer.style.height = `${totalRows * rowHeight}px`;
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

  // Update on resize to recreate dots for new document size
  window.addEventListener("resize", handleResize);
  // Also listen to orientation change on mobile
  window.addEventListener("orientationchange", () => {
    // Longer delay for orientation change to allow viewport to settle
    setTimeout(() => {
      updateDotsSize();
      createDotElements();
    }, 300);
  });

  // Also update when content changes (e.g., images load, content added)
  // Use a MutationObserver to watch for document height changes
  let lastDocumentHeight = 0;

  function checkDocumentHeight() {
    const documentHeight = Math.max(
      document.body.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.clientHeight,
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight
    );

    // Only update if document height actually changed significantly
    if (Math.abs(documentHeight - lastDocumentHeight) > rowHeight) {
      lastDocumentHeight = documentHeight;
      createDotElements();
    }
  }

  const observer = new MutationObserver(() => {
    // Debounce the update
    if (window.dotsUpdateTimeout) {
      clearTimeout(window.dotsUpdateTimeout);
    }
    window.dotsUpdateTimeout = setTimeout(() => {
      checkDocumentHeight();
    }, 500); // Longer debounce to avoid constant updates
  });

  // Observe body for changes that might affect document height
  // Only watch for childList changes (elements added/removed), not style/class changes
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    // Don't watch attributes - they change too frequently
  });

  // Initialize last height
  lastDocumentHeight = Math.max(
    document.body.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.clientHeight,
    document.documentElement.scrollHeight,
    document.documentElement.offsetHeight
  );
}
