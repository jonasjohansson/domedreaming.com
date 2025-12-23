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

  // Column width from CSS var (falls back to viewport width / columns)
  const colWidthCSS = rootStyles.getPropertyValue("--col-width");
  if (colWidthCSS) {
    colWidth = parseFloat(colWidthCSS) || window.innerWidth / gridColumns;
  } else {
    colWidth = window.innerWidth / gridColumns;
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

      rowContainer.appendChild(dot);
    }

    dotsContainer.appendChild(rowContainer);
  }

  // Set container height to match the number of rows
  dotsContainer.style.height = `${totalRows * rowHeight}px`;
}

/**
 * Track cursor/touch position and update dot fade effect
 */
function initCursorTracking() {
  const dotsContainer = document.getElementById("grid-dots-container");
  if (!dotsContainer) return;

  function updateCursorPosition(x, y) {
    const xPercent = (x / window.innerWidth) * 100;
    const yPercent = (y / window.innerHeight) * 100;
    dotsContainer.style.setProperty("--cursor-x", `${xPercent}%`);
    dotsContainer.style.setProperty("--cursor-y", `${yPercent}%`);
  }

  // Mouse tracking
  document.addEventListener("mousemove", (e) => {
    updateCursorPosition(e.clientX, e.clientY);
  });

  // Touch tracking
  document.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        updateCursorPosition(touch.clientX, touch.clientY);
      }
    },
    { passive: true }
  );

  // Reset when mouse/touch leaves
  document.addEventListener("mouseleave", () => {
    dotsContainer.style.setProperty("--cursor-x", "50%");
    dotsContainer.style.setProperty("--cursor-y", "50%");
  });
}

/**
 * Initialize and export
 */
export function initGridDotsSystem() {
  initGridDots();
  initCursorTracking();

  // Update on resize to recreate dots for new document size
  window.addEventListener("resize", () => {
    updateDotsSize();
    createDotElements();
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
